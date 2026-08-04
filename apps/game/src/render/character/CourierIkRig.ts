import * as THREE from 'three';
import type { CourierSocketMap } from './CourierSocketMap';

// Two-bone analytical IK solver for limbs (arm or leg chains).
// Solves for the elbow/knee joint position given root, end-effector target,
// and pole vector hint, then writes the result into the bone's local quaternion.

const _rootWorld = new THREE.Vector3();
const _midWorld = new THREE.Vector3();
const _tipWorld = new THREE.Vector3();
const _targetWorld = new THREE.Vector3();
const _poleWorld = new THREE.Vector3();
const _rootInvQ = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _toMid = new THREE.Vector3();
const _fromMid = new THREE.Vector3();

function solveTwoBone(
  root: THREE.Bone,
  mid: THREE.Bone,
  tip: THREE.Bone,
  target: THREE.Vector3,
  poleHint: THREE.Vector3,
  weight: number,
): void {
  if (weight < 0.001) return;

  root.getWorldPosition(_rootWorld);
  mid.getWorldPosition(_midWorld);
  tip.getWorldPosition(_tipWorld);

  const upperLen = _midWorld.distanceTo(_rootWorld);
  const lowerLen = _tipWorld.distanceTo(_midWorld);
  const reachLen = _targetWorld.copy(target).distanceTo(_rootWorld);
  const reach = Math.min(reachLen, upperLen + lowerLen - 0.001);

  // Angle at root using cosine rule
  const cosA = (reach * reach + upperLen * upperLen - lowerLen * lowerLen) / (2 * reach * upperLen);
  const angleA = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));

  // Direction from root to target
  _toTarget.copy(target).sub(_rootWorld).normalize();

  // Pole vector projected perpendicular to the reach direction
  _axis.copy(_poleWorld.copy(poleHint).sub(_rootWorld));
  _axis.addScaledVector(_toTarget, -_axis.dot(_toTarget)).normalize();

  if (_axis.lengthSq() < 1e-6) _axis.set(0, 1, 0);

  // Desired mid-joint world position
  _a.copy(_toTarget).multiplyScalar(Math.cos(angleA) * upperLen);
  _b.copy(_axis).multiplyScalar(Math.sin(angleA) * upperLen);
  const desiredMid = new THREE.Vector3().copy(_rootWorld).add(_a).add(_b);

  // Rotate root bone to point toward desired mid
  root.getWorldQuaternion(_rootInvQ).invert();
  _toMid.copy(desiredMid).sub(_rootWorld).normalize();
  const fromMidCurrent = _midWorld.clone().sub(_rootWorld).normalize();
  const q1 = new THREE.Quaternion().setFromUnitVectors(fromMidCurrent, _toMid);
  const rootQ = new THREE.Quaternion().copy(_rootInvQ).multiply(q1);
  root.quaternion.slerp(rootQ, weight);

  // Rotate mid bone to point toward target
  _fromMid.copy(target).sub(desiredMid).normalize();
  const fromTipCurrent = _tipWorld.clone().sub(desiredMid).normalize();
  const q2 = new THREE.Quaternion().setFromUnitVectors(fromTipCurrent, _fromMid);
  mid.quaternion.slerp(q2, weight);
}

export interface IkTarget {
  position: THREE.Vector3;
  poleHint: THREE.Vector3;
  weight: number;
}

export class CourierIkRig {
  #handLRoot: THREE.Bone | null = null;
  #handLMid: THREE.Bone | null = null;
  #handLTip: THREE.Bone | null = null;
  #handRRoot: THREE.Bone | null = null;
  #handRMid: THREE.Bone | null = null;
  #handRTip: THREE.Bone | null = null;
  #footLRoot: THREE.Bone | null = null;
  #footLMid: THREE.Bone | null = null;
  #footLTip: THREE.Bone | null = null;
  #footRRoot: THREE.Bone | null = null;
  #footRMid: THREE.Bone | null = null;
  #footRTip: THREE.Bone | null = null;

  private static readonly BONE_CHAINS: Readonly<Record<'handL' | 'handR' | 'footL' | 'footR', [string, string, string]>> = {
    handL: ['Bone_ArmUpperL', 'Bone_ArmLowerL', 'Bone_HandL'],
    handR: ['Bone_ArmUpperR', 'Bone_ArmLowerR', 'Bone_HandR'],
    footL: ['Bone_LegUpperL', 'Bone_LegLowerL', 'Bone_FootL'],
    footR: ['Bone_LegUpperR', 'Bone_LegLowerR', 'Bone_FootR'],
  };

  build(root: THREE.Object3D, _socketMap: CourierSocketMap): void {
    const boneByName = new Map<string, THREE.Bone>();
    root.traverse((object) => {
      if (object instanceof THREE.Bone) boneByName.set(object.name, object);
    });

    const get = (name: string): THREE.Bone | null => boneByName.get(name) ?? null;
    const [hlr, hlm, hlt] = CourierIkRig.BONE_CHAINS.handL;
    const [hrr, hrm, hrt] = CourierIkRig.BONE_CHAINS.handR;
    const [flr, flm, flt] = CourierIkRig.BONE_CHAINS.footL;
    const [frr, frm, frt] = CourierIkRig.BONE_CHAINS.footR;

    this.#handLRoot = get(hlr); this.#handLMid = get(hlm); this.#handLTip = get(hlt);
    this.#handRRoot = get(hrr); this.#handRMid = get(hrm); this.#handRTip = get(hrt);
    this.#footLRoot = get(flr); this.#footLMid = get(flm); this.#footLTip = get(flt);
    this.#footRRoot = get(frr); this.#footRMid = get(frm); this.#footRTip = get(frt);
  }

  update(options: {
    handLeft?: IkTarget;
    handRight?: IkTarget;
    footLeft?: IkTarget;
    footRight?: IkTarget;
  }): void {
    if (options.handLeft && this.#handLRoot && this.#handLMid && this.#handLTip) {
      solveTwoBone(this.#handLRoot, this.#handLMid, this.#handLTip,
        options.handLeft.position, options.handLeft.poleHint, options.handLeft.weight);
    }
    if (options.handRight && this.#handRRoot && this.#handRMid && this.#handRTip) {
      solveTwoBone(this.#handRRoot, this.#handRMid, this.#handRTip,
        options.handRight.position, options.handRight.poleHint, options.handRight.weight);
    }
    if (options.footLeft && this.#footLRoot && this.#footLMid && this.#footLTip) {
      solveTwoBone(this.#footLRoot, this.#footLMid, this.#footLTip,
        options.footLeft.position, options.footLeft.poleHint, options.footLeft.weight);
    }
    if (options.footRight && this.#footRRoot && this.#footRMid && this.#footRTip) {
      solveTwoBone(this.#footRRoot, this.#footRMid, this.#footRTip,
        options.footRight.position, options.footRight.poleHint, options.footRight.weight);
    }
  }
}
