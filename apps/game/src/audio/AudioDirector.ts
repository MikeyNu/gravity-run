import type { SimulationSnapshot } from '@gravity-run/simulation';
import { MusicDirector } from './MusicDirector';

const SOUND_URLS = {
  uiConfirm: '/assets/audio/ui-confirm.wav',
  tetherAttach: '/assets/audio/tether-attach.wav',
  tetherLoop: '/assets/audio/tether-loop.wav',
  releaseGood: '/assets/audio/release-good.wav',
  releasePerfect: '/assets/audio/release-perfect.wav',
  fragment: '/assets/audio/fragment.wav',
  nearMiss: '/assets/audio/near-miss.wav',
  failure: '/assets/audio/failure.wav',
  ambience: '/assets/audio/ambience-loop.ogg',
} as const;

type SoundName = keyof typeof SOUND_URLS;

interface AudioSettingsDetail {
  masterVolume: number;
  muted: boolean;
  musicVolume?: number;
  sfxVolume?: number;
  ambienceVolume?: number;
}

export class AudioDirector {
  #context: AudioContext | null = null;
  #masterGain: GainNode | null = null;
  // Separate buses for independent volume control
  #musicBus: GainNode | null = null;
  #sfxBus: GainNode | null = null;
  #ambienceBus: GainNode | null = null;
  #musicDirector: MusicDirector | null = null;
  #ambienceSource: AudioBufferSourceNode | null = null;
  #buffers = new Map<SoundName, AudioBuffer>();
  #loading: Promise<void> | null = null;
  #tetherSource: AudioBufferSourceNode | null = null;
  #tetherGain: GainNode | null = null;
  #lastProcessedTick = -1;
  #masterVolume = AudioDirector.#storedVolume();
  #muted = localStorage.getItem('gravity-run:muted') === 'true';
  #musicVolume = AudioDirector.#storedBusVolume('music', 0.72);
  #sfxVolume = AudioDirector.#storedBusVolume('sfx', 0.88);
  #ambienceVolume = AudioDirector.#storedBusVolume('ambience', 0.45);
  #tetherRequested = false;
  #waitingForTetherBuffer = false;

  static #storedBusVolume(bus: string, defaultValue: number): number {
    const value = Number(localStorage.getItem(`gravity-run:${bus}-volume`) ?? defaultValue);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : defaultValue;
  }

  static #storedVolume(): number {
    const value = Number(localStorage.getItem('gravity-run:master-volume') ?? 0.78);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.78;
  }

  constructor() {
    window.addEventListener('pointerdown', this.#unlock, { passive: true });
    window.addEventListener('keydown', this.#unlock);
    window.addEventListener('gravity-run:audio-settings', this.#onSettings as EventListener);
    window.addEventListener('gravity-run:ui-confirm', this.#onUiConfirm);
  }

  update(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    // Update music intensity based on game state
    if (this.#musicDirector && this.#context) {
      const speed01 = Math.min(Math.max(current.playerSpeed / 42, 0), 1);
      const comboFactor = Math.min(current.combo / 8, 1) * 0.35;
      const orbitFactor = current.targetLocked ? 0.2 : 0;
      const intensity = Math.min(1, speed01 * 0.65 + comboFactor + orbitFactor);
      this.#musicDirector.setIntensity(current.phase === 'failed' ? 0 : intensity);
      this.#musicDirector.update(1 / 60);
    }
    this.#updateTether(current);
    if (current.tick < this.#lastProcessedTick) {
      this.#lastProcessedTick = current.tick;
      this.#stopTether();
      return;
    }
    if (current.tick === this.#lastProcessedTick) return;
    this.#lastProcessedTick = current.tick;

    if (!previous.targetLocked && current.targetLocked) {
      this.#play('tetherAttach', 0.72, 1 + current.playerSpeed / 180);
      this.#startTether();
    }
    if (previous.targetLocked && !current.targetLocked) this.#stopTether();
    if (previous.phase !== 'released' && current.phase === 'released') {
      const perfect = current.lastReleaseGrade === 'perfect' || current.lastReleaseGrade === 'overdrive';
      this.#play(perfect ? 'releasePerfect' : 'releaseGood', perfect ? 0.86 : 0.7, 0.96 + current.playerSpeed / 220);
    }
    if (current.fragments > previous.fragments) this.#play('fragment', 0.62, 1 + Math.min(current.combo, 6) * 0.025);
    if (current.nearMisses > previous.nearMisses) this.#play('nearMiss', 0.5, 0.92 + current.playerSpeed / 150);
    if (previous.phase !== 'failed' && current.phase === 'failed') {
      this.#stopTether();
      this.#play('failure', 0.88, 1);
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.#unlock);
    window.removeEventListener('keydown', this.#unlock);
    window.removeEventListener('gravity-run:audio-settings', this.#onSettings as EventListener);
    window.removeEventListener('gravity-run:ui-confirm', this.#onUiConfirm);
    this.#stopTether();
    this.#musicDirector?.dispose();
    this.#musicDirector = null;
    if (this.#ambienceSource) {
      try { this.#ambienceSource.stop(); } catch { /* already stopped */ }
      this.#ambienceSource = null;
    }
    void this.#context?.close();
    this.#context = null;
    this.#buffers.clear();
  }

  readonly #unlock = (): void => {
    if (!this.#context) {
      const AudioContextConstructor = window.AudioContext;
      this.#context = new AudioContextConstructor({ latencyHint: 'interactive' });

      // Bus graph: masterGain → destination
      //   musicBus → masterGain
      //   sfxBus → masterGain
      //   ambienceBus → masterGain
      this.#masterGain = this.#context.createGain();
      this.#masterGain.connect(this.#context.destination);

      this.#musicBus = this.#context.createGain();
      this.#musicBus.gain.value = this.#musicVolume;
      this.#musicBus.connect(this.#masterGain);

      this.#sfxBus = this.#context.createGain();
      this.#sfxBus.gain.value = this.#sfxVolume;
      this.#sfxBus.connect(this.#masterGain);

      this.#ambienceBus = this.#context.createGain();
      this.#ambienceBus.gain.value = this.#ambienceVolume;
      this.#ambienceBus.connect(this.#masterGain);

      this.#musicDirector = new MusicDirector(this.#context, this.#musicBus);

      this.#applySettings();
      this.#loading = this.#loadBuffers().then(() => {
        this.#musicDirector?.start();
        this.#startAmbience();
      });
    }
    if (this.#context.state === 'suspended') void this.#context.resume();
  };

  readonly #onSettings = (event: CustomEvent<AudioSettingsDetail>): void => {
    this.#masterVolume = Math.min(Math.max(event.detail.masterVolume, 0), 1);
    this.#muted = event.detail.muted;
    if (event.detail.musicVolume !== undefined) this.#musicVolume = Math.min(Math.max(event.detail.musicVolume, 0), 1);
    if (event.detail.sfxVolume !== undefined) this.#sfxVolume = Math.min(Math.max(event.detail.sfxVolume, 0), 1);
    if (event.detail.ambienceVolume !== undefined) this.#ambienceVolume = Math.min(Math.max(event.detail.ambienceVolume, 0), 1);
    this.#applySettings();
  };

  readonly #onUiConfirm = (): void => {
    this.#play('uiConfirm', 0.55, 1);
  };

  async #loadBuffers(): Promise<void> {
    const context = this.#context;
    if (!context) return;
    await Promise.all(
      (Object.entries(SOUND_URLS) as [SoundName, string][]).map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio asset failed: ${url}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.#buffers.set(name, buffer);
      }),
    ).catch((error: unknown) => {
      console.warn('[Gravity Run] Audio assets unavailable; continuing silently.', error);
    });
  }

  #play(name: SoundName, gainValue: number, playbackRate: number): void {
    const context = this.#context;
    const bus = this.#sfxBus ?? this.#masterGain;
    const buffer = this.#buffers.get(name);
    if (!context || !bus || this.#muted) return;
    if (!buffer) {
      void this.#loading?.then(() => this.#play(name, gainValue, playbackRate));
      return;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = gainValue;
    source.connect(gain).connect(bus);
    source.start();
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
  }

  #startAmbience(): void {
    const context = this.#context;
    const bus = this.#ambienceBus;
    const buffer = this.#buffers.get('ambience');
    if (!context || !bus || !buffer || this.#ambienceSource) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(bus);
    source.start();
    this.#ambienceSource = source;
  }

  #startTether(): void {
    this.#tetherRequested = true;
    const bus = this.#sfxBus ?? this.#masterGain;
    if (this.#tetherSource || !this.#context || !bus) return;
    const buffer = this.#buffers.get('tetherLoop');
    if (!buffer) {
      if (!this.#waitingForTetherBuffer) {
        this.#waitingForTetherBuffer = true;
        void this.#loading?.finally(() => {
          this.#waitingForTetherBuffer = false;
          if (this.#tetherRequested) this.#startTether();
        });
      }
      return;
    }
    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(bus);
    source.start();
    gain.gain.linearRampToValueAtTime(0.22, this.#context.currentTime + 0.08);
    this.#tetherSource = source;
    this.#tetherGain = gain;
  }

  #updateTether(current: SimulationSnapshot): void {
    if (!current.targetLocked) return;
    this.#startTether();
    if (!this.#context || !this.#tetherSource || !this.#tetherGain) return;
    const speed01 = Math.min(Math.max(current.playerSpeed / 42, 0), 1);
    this.#tetherSource.playbackRate.setTargetAtTime(0.88 + speed01 * 0.55, this.#context.currentTime, 0.04);
    this.#tetherGain.gain.setTargetAtTime(this.#muted ? 0 : 0.13 + speed01 * 0.18, this.#context.currentTime, 0.05);
  }

  #stopTether(): void {
    this.#tetherRequested = false;
    const source = this.#tetherSource;
    const gain = this.#tetherGain;
    if (!source || !gain || !this.#context) return;
    gain.gain.cancelScheduledValues(this.#context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, this.#context.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.#context.currentTime + 0.06);
    source.stop(this.#context.currentTime + 0.065);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    this.#tetherSource = null;
    this.#tetherGain = null;
  }

  #applySettings(): void {
    if (!this.#context) return;
    const now = this.#context.currentTime;
    const muted = this.#muted;
    if (this.#masterGain) {
      this.#masterGain.gain.setTargetAtTime(muted ? 0 : this.#masterVolume, now, 0.025);
    }
    if (this.#musicBus) this.#musicBus.gain.setTargetAtTime(this.#musicVolume, now, 0.05);
    if (this.#sfxBus) this.#sfxBus.gain.setTargetAtTime(this.#sfxVolume, now, 0.05);
    if (this.#ambienceBus) this.#ambienceBus.gain.setTargetAtTime(this.#ambienceVolume, now, 0.05);
  }
}
