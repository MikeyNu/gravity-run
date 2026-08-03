export interface RandomState {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

export class Xoshiro128StarStar {
  #state: RandomState;

  constructor(seed: RandomState) {
    if ((seed.s0 | seed.s1 | seed.s2 | seed.s3) === 0) {
      throw new Error('xoshiro128** cannot be initialized with an all-zero state.');
    }
    this.#state = { ...seed };
  }

  nextUint32(): number {
    const state = this.#state;
    const result = Math.imul(rotateLeft(Math.imul(state.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (state.s1 << 9) >>> 0;

    state.s2 ^= state.s0;
    state.s3 ^= state.s1;
    state.s1 ^= state.s2;
    state.s0 ^= state.s3;
    state.s2 ^= t;
    state.s3 = rotateLeft(state.s3, 11);

    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  snapshot(): RandomState {
    return { ...this.#state };
  }
}
