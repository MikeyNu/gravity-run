import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Path where the BasisUniversal WASM transcoder is served
// (copy three/examples/jsm/libs/basis/ to public/assets/basis/)
const TRANSCODER_PATH = '/assets/basis/';

let ktx2Loader: KTX2Loader | null = null;
let meshoptReady: Promise<void> | null = null;

/**
 * Create a GLTFLoader pre-configured with:
 *  - KTX2Loader (BasisUniversal GPU texture compression)
 *  - MeshoptDecoder (compressed mesh geometry)
 *
 * Both extensions are no-ops when the transcoder files are absent or the
 * device doesn't support the required WebGL extensions.
 *
 * @param renderer - The WebGLRenderer used to detect format support.
 */
export function createGLTFLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  const loader = new GLTFLoader();

  // KTX2 — initialise once globally and reuse across all loaders
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader()
      .setTranscoderPath(TRANSCODER_PATH)
      .detectSupport(renderer);
  }
  loader.setKTX2Loader(ktx2Loader);

  // MeshoptDecoder — initialise once
  const ready = meshoptReady ?? MeshoptDecoder.ready;
  meshoptReady = ready;
  void ready.then(() => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  return loader;
}

export function disposeGLTFLoaders(): void {
  ktx2Loader?.dispose();
  ktx2Loader = null;
  meshoptReady = null;
}
