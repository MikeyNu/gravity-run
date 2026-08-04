import * as THREE from 'three';

export type CourierClipName =
  | 'idle'
  | 'idle_float'
  | 'fly_forward'
  | 'fly_backward'
  | 'fly_strafe_left'
  | 'fly_strafe_right'
  | 'orbit_start'
  | 'orbit_loop'
  | 'orbit_release'
  | 'latch_approach'
  | 'latch_hold'
  | 'latch_release'
  | 'near_miss_react'
  | 'fragment_collect'
  | 'death_collapse'
  | 'victory_pose';

export const ALL_CLIP_NAMES: readonly CourierClipName[] = [
  'idle',
  'idle_float',
  'fly_forward',
  'fly_backward',
  'fly_strafe_left',
  'fly_strafe_right',
  'orbit_start',
  'orbit_loop',
  'orbit_release',
  'latch_approach',
  'latch_hold',
  'latch_release',
  'near_miss_react',
  'fragment_collect',
  'death_collapse',
  'victory_pose',
] as const;

export class CourierClipRegistry {
  readonly #clips = new Map<CourierClipName, THREE.AnimationClip>();

  load(gltfAnimations: readonly THREE.AnimationClip[]): void {
    for (const name of ALL_CLIP_NAMES) {
      const clip = gltfAnimations.find((c) => c.name === name);
      if (clip) {
        this.#clips.set(name, clip);
      } else {
        this.#clips.set(name, CourierClipRegistry.#fallback(name));
      }
    }
  }

  get(name: CourierClipName): THREE.AnimationClip {
    const clip = this.#clips.get(name);
    if (!clip) throw new Error(`CourierClipRegistry: clip '${name}' not found — call load() first`);
    return clip;
  }

  has(name: CourierClipName): boolean {
    return this.#clips.has(name);
  }

  static #fallback(name: CourierClipName): THREE.AnimationClip {
    // Single-key procedural stand-in so the mixer never gets a null clip
    const duration = name.endsWith('_loop') || name === 'idle' || name === 'idle_float' ? 2 : 0.6;
    const track = new THREE.NumberKeyframeTrack('.quaternion[0]', [0, duration], [0, 0]);
    return new THREE.AnimationClip(name, duration, [track]);
  }
}
