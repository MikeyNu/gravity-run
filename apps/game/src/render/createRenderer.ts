import * as THREE from 'three';
import type { QualityTier } from './quality/detectQualityTier';

export interface RendererCapabilities {
  backend: 'webgpu' | 'webgl';
  renderer: THREE.WebGLRenderer;
}

// Lazy import so WebGPURenderer is never parsed on WebGL-only devices
async function tryWebGPU(
  canvas: HTMLCanvasElement,
): Promise<THREE.WebGLRenderer | null> {
  if (!('gpu' in navigator)) return null;
  try {
    const adapter = await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
    if (!adapter) return null;

    const { WebGPURenderer } = await import('three/webgpu');
    const renderer = new WebGPURenderer({ canvas, antialias: false });
    await renderer.init();
    return renderer as unknown as THREE.WebGLRenderer;
  } catch {
    return null;
  }
}

export async function createRenderer(
  host: HTMLElement,
  quality: QualityTier,
): Promise<RendererCapabilities> {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  // Prefer WebGL2 so GLSL3 (`glslVersion: THREE.GLSL3`) shaders compile.
  // Fall back to WebGL1 if WebGL2 is unavailable.
  const contextAttributes: WebGLContextAttributes = { antialias: quality === 'compatibility', powerPreference: 'high-performance', stencil: false, alpha: false } as any;
  const gl2 = canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext | null;
  const gl = gl2 ?? (canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext | null) ?? (canvas.getContext('experimental-webgl', contextAttributes) as WebGLRenderingContext | null);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl as any,
    antialias: quality === 'compatibility',
    powerPreference: 'high-performance',
    stencil: false,
    alpha: false,
  });
  renderer.shadowMap.enabled = quality !== 'compatibility';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  return { backend: 'webgl', renderer };
}
