import type { SimulationSnapshot } from '@gravity-run/simulation';

const SOUND_URLS = {
  uiConfirm: '/assets/audio/ui-confirm.wav',
  tetherAttach: '/assets/audio/tether-attach.wav',
  tetherLoop: '/assets/audio/tether-loop.wav',
  releaseGood: '/assets/audio/release-good.wav',
  releasePerfect: '/assets/audio/release-perfect.wav',
  fragment: '/assets/audio/fragment.wav',
  nearMiss: '/assets/audio/near-miss.wav',
  failure: '/assets/audio/failure.wav',
} as const;

type SoundName = keyof typeof SOUND_URLS;

interface AudioSettingsDetail {
  masterVolume: number;
  muted: boolean;
}

export class AudioDirector {
  #context: AudioContext | null = null;
  #masterGain: GainNode | null = null;
  #buffers = new Map<SoundName, AudioBuffer>();
  #loading: Promise<void> | null = null;
  #tetherSource: AudioBufferSourceNode | null = null;
  #tetherGain: GainNode | null = null;
  #lastProcessedTick = -1;
  #masterVolume = AudioDirector.#storedVolume();
  #muted = localStorage.getItem('gravity-run:muted') === 'true';
  #tetherRequested = false;
  #waitingForTetherBuffer = false;

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
    void this.#context?.close();
    this.#context = null;
    this.#buffers.clear();
  }

  readonly #unlock = (): void => {
    if (!this.#context) {
      const AudioContextConstructor = window.AudioContext;
      this.#context = new AudioContextConstructor({ latencyHint: 'interactive' });
      this.#masterGain = this.#context.createGain();
      this.#masterGain.connect(this.#context.destination);
      this.#applySettings();
      this.#loading = this.#loadBuffers();
    }
    if (this.#context.state === 'suspended') void this.#context.resume();
  };

  readonly #onSettings = (event: CustomEvent<AudioSettingsDetail>): void => {
    this.#masterVolume = Math.min(Math.max(event.detail.masterVolume, 0), 1);
    this.#muted = event.detail.muted;
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
    const master = this.#masterGain;
    const buffer = this.#buffers.get(name);
    if (!context || !master || this.#muted) return;
    if (!buffer) {
      void this.#loading?.then(() => this.#play(name, gainValue, playbackRate));
      return;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = gainValue;
    source.connect(gain).connect(master);
    source.start();
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
  }

  #startTether(): void {
    this.#tetherRequested = true;
    if (this.#tetherSource || !this.#context || !this.#masterGain) return;
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
    source.connect(gain).connect(this.#masterGain);
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
    if (!this.#masterGain || !this.#context) return;
    const target = this.#muted ? 0 : this.#masterVolume;
    this.#masterGain.gain.setTargetAtTime(target, this.#context.currentTime, 0.025);
  }
}
