/**
 * Adaptive music system with intensity layers and variation pools.
 *
 * Three intensity layers play simultaneously; each layer's gain is controlled by the
 * current intensity value so the music evolves without hard cuts.
 *
 * Layer assets live at:
 *   /assets/audio/music/layer-calm-{n}.ogg   (low-intensity bed)
 *   /assets/audio/music/layer-active-{n}.ogg (mid-intensity rhythmic layer)
 *   /assets/audio/music/layer-intense-{n}.ogg (high-intensity melodic layer)
 *
 * Multiple {n} variants form a variation pool; one is selected at random on each loop
 * boundary so the music stays fresh across long runs.
 */

const VARIATION_COUNT = 2; // number of files per layer

function poolUrls(layer: string): string[] {
  return Array.from({ length: VARIATION_COUNT }, (_, i) =>
    `/assets/audio/music/layer-${layer}-${i + 1}.ogg`,
  );
}

const LAYER_POOL_URLS = [
  poolUrls('calm'),
  poolUrls('active'),
  poolUrls('intense'),
] as const;

// Gain curve for each layer at a given intensity [0, 1]:
// calm:    peaks at 0, fades to 0 at 0.7
// active:  peaks at 0.45, fades at both ends
// intense: silent below 0.4, peaks at 1
function layerGain(layerIndex: number, intensity: number): number {
  const t = Math.max(0, Math.min(1, intensity));
  if (layerIndex === 0) return Math.max(0, 1 - t * 1.5);
  if (layerIndex === 1) return Math.max(0, 1 - Math.abs(t - 0.45) * 2.5);
  return Math.max(0, (t - 0.35) / 0.65);
}

interface LayerState {
  buffers: (AudioBuffer | null)[];
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  currentVariation: number;
}

export class MusicDirector {
  readonly #context: AudioContext;
  readonly #outputBus: GainNode;
  readonly #layers: LayerState[];
  #intensity = 0;
  #targetIntensity = 0;
  #running = false;

  constructor(context: AudioContext, outputBus: GainNode) {
    this.#context = context;
    this.#outputBus = outputBus;
    this.#layers = LAYER_POOL_URLS.map(() => ({
      buffers: new Array<AudioBuffer | null>(VARIATION_COUNT).fill(null),
      source: null,
      gainNode: context.createGain(),
      currentVariation: 0,
    }));
    for (const layer of this.#layers) {
      layer.gainNode.gain.value = 0;
      layer.gainNode.connect(outputBus);
    }
  }

  async load(): Promise<void> {
    await Promise.all(
      LAYER_POOL_URLS.flatMap((urls, layerIndex) =>
        urls.map(async (url, varIndex) => {
          const layer = this.#layers[layerIndex];
          if (!layer) return;
          const response = await fetch(url);
          if (!response.ok) return;
          layer.buffers[varIndex] = await this.#context.decodeAudioData(await response.arrayBuffer());
        }),
      ),
    ).catch((error: unknown) => {
      console.warn('[Gravity Run] Music assets unavailable; playing without adaptive music.', error);
    });
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    for (let i = 0; i < this.#layers.length; i++) {
      this.#startLayer(i);
    }
  }

  stop(): void {
    this.#running = false;
    for (const layer of this.#layers) {
      layer.source?.stop();
      layer.source = null;
      layer.gainNode.gain.setTargetAtTime(0, this.#context.currentTime, 0.4);
    }
  }

  /** Set target intensity; gains cross-fade smoothly. */
  setIntensity(intensity: number): void {
    this.#targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /** Called each frame with the real-time delta. */
  update(deltaSeconds: number): void {
    // Smooth the intensity toward the target
    const rate = 2.5;
    this.#intensity += (this.#targetIntensity - this.#intensity) * Math.min(rate * deltaSeconds, 1);

    for (let i = 0; i < this.#layers.length; i++) {
      const target = layerGain(i, this.#intensity);
      const layer = this.#layers[i];
      if (!layer) continue;
      layer.gainNode.gain.setTargetAtTime(target, this.#context.currentTime, 0.12);
    }
  }

  dispose(): void {
    this.stop();
    for (const layer of this.#layers) {
      layer.gainNode.disconnect();
    }
  }

  #startLayer(index: number): void {
    const layer = this.#layers[index];
    if (!layer || !this.#running) return;

    const buffers = layer.buffers.filter((b): b is AudioBuffer => b !== null);
    if (buffers.length === 0) return;

    layer.currentVariation = (layer.currentVariation + 1) % buffers.length;
    const buffer = buffers[layer.currentVariation];
    if (!buffer) return;

    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.connect(layer.gainNode);
    source.start();
    layer.source = source;

    // On each loop end, pick next variation from pool
    source.addEventListener(
      'ended',
      () => {
        layer.source = null;
        if (this.#running) this.#startLayer(index);
      },
      { once: true },
    );
  }
}
