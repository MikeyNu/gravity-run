import * as THREE from 'three';

// Named attachment points on the Courier skeleton
export type SocketName =
  | 'visor'
  | 'reactor'
  | 'tether_anchor'
  | 'hand_left'
  | 'hand_right'
  | 'foot_left'
  | 'foot_right';

const BONE_NAME: Readonly<Record<SocketName, string>> = {
  visor:         'Bone_Visor',
  reactor:       'Bone_Reactor',
  tether_anchor: 'Bone_TetherAnchor',
  hand_left:     'Bone_HandL',
  hand_right:    'Bone_HandR',
  foot_left:     'Bone_FootL',
  foot_right:    'Bone_FootR',
};

export class CourierSocketMap {
  readonly #sockets = new Map<SocketName, THREE.Bone>();

  build(root: THREE.Object3D): void {
    this.#sockets.clear();
    root.traverse((object) => {
      if (!(object instanceof THREE.Bone)) return;
      for (const [socket, boneName] of Object.entries(BONE_NAME) as [SocketName, string][]) {
        if (object.name === boneName) this.#sockets.set(socket, object);
      }
    });
  }

  get(socket: SocketName): THREE.Bone | null {
    return this.#sockets.get(socket) ?? null;
  }

  worldPosition(socket: SocketName, out: THREE.Vector3): boolean {
    const bone = this.#sockets.get(socket);
    if (!bone) return false;
    bone.getWorldPosition(out);
    return true;
  }

  worldQuaternion(socket: SocketName, out: THREE.Quaternion): boolean {
    const bone = this.#sockets.get(socket);
    if (!bone) return false;
    bone.getWorldQuaternion(out);
    return true;
  }

  attach(socket: SocketName, object: THREE.Object3D): boolean {
    const bone = this.#sockets.get(socket);
    if (!bone) return false;
    bone.add(object);
    return true;
  }
}
