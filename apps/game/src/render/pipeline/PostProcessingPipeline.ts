import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import type { QualityTier } from '../quality/detectQualityTier';

export class PostProcessingPipeline {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene: THREE.Scene;
  readonly #camera: THREE.Camera;
  readonly #composer: EffectComposer | null;
  readonly #direct: boolean;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    quality: QualityTier,
  ) {
    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#direct = quality === 'compatibility';

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 1.03;

    if (this.#direct) {
      renderer.toneMapping = THREE.AgXToneMapping;
      this.#composer = null;
      return;
    }

    renderer.toneMapping = THREE.NoToneMapping;
    const composer = new EffectComposer(renderer, {
      frameBufferType: quality === 'mobile' ? THREE.UnsignedByteType : THREE.HalfFloatType,
    });
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new BloomEffect({
      intensity: quality === 'cinematic' ? 0.72 : quality === 'desktop' ? 0.58 : 0.34,
      luminanceThreshold: 1.05,
      luminanceSmoothing: 0.22,
      mipmapBlur: true,
    });
    const vignette = new VignetteEffect({ offset: 0.28, darkness: quality === 'mobile' ? 0.32 : 0.38 });
    const smaa = new SMAAEffect({
      preset: quality === 'cinematic' ? SMAAPreset.ULTRA : quality === 'desktop' ? SMAAPreset.HIGH : SMAAPreset.MEDIUM,
    });
    composer.addPass(new EffectPass(camera, bloom, smaa, vignette));
    composer.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.AGX })));
    this.#composer = composer;
  }

  render(deltaSeconds: number): void {
    if (this.#composer) this.#composer.render(deltaSeconds);
    else this.#renderer.render(this.#scene, this.#camera);
  }

  setSize(cssWidth: number, cssHeight: number, devicePixelRatio: number, renderScale: number): void {
    const width = Math.max(1, Math.floor(cssWidth * devicePixelRatio * renderScale));
    const height = Math.max(1, Math.floor(cssHeight * devicePixelRatio * renderScale));
    this.#renderer.setPixelRatio(1);
    this.#renderer.setSize(width, height, false);
    this.#composer?.setSize(width, height);
  }

  dispose(): void {
    this.#composer?.dispose();
  }
}
