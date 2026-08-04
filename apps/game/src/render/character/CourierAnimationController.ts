import * as THREE from 'three';
import type { SimulationSnapshot } from '@gravity-run/simulation';
import type { QualityTier } from '../quality/detectQualityTier';
import { createGLTFLoader } from '../assets/createGLTFLoader';
import { CourierClipRegistry } from './CourierClipRegistry';
import type { CourierClipName } from './CourierClipRegistry';
import { CourierSocketMap } from './CourierSocketMap';
import { CourierIkRig } from './CourierIkRig';

const MODEL_URL = '/assets/models/courier-character.glb';

type AnimState =
  | 'idle'
  | 'flying'
  | 'orbiting'
  | 'latch_approach'
  | 'released'
  | 'collect'
  | 'near_miss'
  | 'dead';

const CROSS_FADE_DURATION = 0.18;
const IK_BLEND_SPEED = 4;

const _wellPos = new THREE.Vector3();
const _handPole = new THREE.Vector3();

export class CourierAnimationController {
  readonly #registry = new CourierClipRegistry();
  readonly #socketMap = new CourierSocketMap();
  readonly #ikRig = new CourierIkRig();

  #mixer: THREE.AnimationMixer | null = null;
  #root: THREE.Object3D | null = null;
  #state: AnimState = 'idle';
  #currentAction: THREE.AnimationAction | null = null;
  #pendingTransient: CourierClipName | null = null;
  #ikWeight = 0;
  #readyPromise: Promise<void> | null = null;

  preload(renderer: THREE.WebGLRenderer): Promise<void> {
    if (this.#readyPromise) return this.#readyPromise;
    const promise = createGLTFLoader(renderer)
      .loadAsync(MODEL_URL)
      .then((gltf) => {
        this.#root = gltf.scene;
        this.#mixer = new THREE.AnimationMixer(gltf.scene);
        this.#registry.load(gltf.animations);
        this.#socketMap.build(gltf.scene);
        this.#ikRig.build(gltf.scene, this.#socketMap);
        // Start in idle
        this.#play('idle', true);
      })
      .catch((err: unknown) => {
        console.warn('[Gravity Run] Courier character GLB unavailable; running without mesh.', err);
      });
    this.#readyPromise = promise;
    return promise;
  }

  get object(): THREE.Object3D | null { return this.#root; }
  get socketMap(): CourierSocketMap { return this.#socketMap; }

  update(
    snapshot: SimulationSnapshot,
    prevSnapshot: SimulationSnapshot,
    frameDelta: number,
    _quality: QualityTier,
  ): void {
    if (!this.#mixer || !this.#root) return;
    this.#mixer.update(frameDelta);

    const next = this.#resolveState(snapshot, prevSnapshot);
    if (next !== this.#state) {
      this.#transition(next, snapshot);
      this.#state = next;
    }

    // Transient one-shot reactions run independently
    if (this.#pendingTransient) {
      const name = this.#pendingTransient;
      this.#pendingTransient = null;
      const action = this.#mixer.clipAction(this.#registry.get(name));
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = false;
      action.reset().play();
      action.crossFadeFrom(this.#currentAction ?? action, CROSS_FADE_DURATION, true);
      this.#mixer.addEventListener('finished', (e: THREE.Event) => {
        if ((e as unknown as { action: THREE.AnimationAction }).action === action) {
          this.#currentAction?.play();
          this.#mixer?.removeEventListener('finished', () => {/* noop */});
        }
      });
    }

    // IK blending — ramp weight while orbiting/latched
    const targetIkWeight = (this.#state === 'orbiting' || this.#state === 'latch_approach') ? 1 : 0;
    this.#ikWeight = THREE.MathUtils.damp(this.#ikWeight, targetIkWeight, IK_BLEND_SPEED, frameDelta);

    if (this.#ikWeight > 0.01) {
      const target = snapshot.wells.find((w) => w.id === snapshot.activeTargetId);
      if (target) {
        _wellPos.set(target.position.x, target.position.y, target.position.z);
        _handPole.set(_wellPos.x, _wellPos.y + 0.8, _wellPos.z);
        this.#ikRig.update({
          handRight: { position: _wellPos, poleHint: _handPole, weight: this.#ikWeight },
        });
      }
    }
  }

  dispose(): void {
    this.#mixer?.stopAllAction();
    this.#mixer = null;
    this.#root = null;
  }

  // ── private ──────────────────────────────────────────────────────────────

  #resolveState(snap: SimulationSnapshot, prev: SimulationSnapshot): AnimState {
    if (snap.phase === 'failed') return 'dead';

    // Edge-triggered transients
    if (snap.fragments > prev.fragments) this.#pendingTransient = 'fragment_collect';
    if (snap.nearMisses > prev.nearMisses) this.#pendingTransient = 'near_miss_react';

    if (snap.phase === 'orbiting') return 'orbiting';
    if (snap.phase === 'latching') return 'latch_approach';
    if (snap.phase === 'released') return 'released';
    if (snap.phase === 'free-flight') {
      const speed = snap.playerSpeed;
      const maxSpeed = 18; // matches movementConfig roughly
      return speed > maxSpeed * 0.6 ? 'flying' : 'idle';
    }
    return 'idle';
  }

  #transition(next: AnimState, _snap: SimulationSnapshot): void {
    const clip = this.#clipForState(next);
    this.#play(clip, next === 'orbiting' || next === 'idle' || next === 'flying');
  }

  #clipForState(state: AnimState): CourierClipName {
    switch (state) {
      case 'idle':          return 'idle_float';
      case 'flying':        return 'fly_forward';
      case 'orbiting':      return 'orbit_loop';
      case 'latch_approach':return 'latch_approach';
      case 'released':      return 'orbit_release';
      case 'collect':       return 'fragment_collect';
      case 'near_miss':     return 'near_miss_react';
      case 'dead':          return 'death_collapse';
    }
  }

  #play(name: CourierClipName, loop: boolean): void {
    if (!this.#mixer) return;
    const clip = this.#registry.get(name);
    const next = this.#mixer.clipAction(clip);
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;

    if (this.#currentAction && this.#currentAction !== next) {
      next.reset().play();
      next.crossFadeFrom(this.#currentAction, CROSS_FADE_DURATION, true);
    } else {
      next.reset().play();
    }
    this.#currentAction = next;
  }
}
