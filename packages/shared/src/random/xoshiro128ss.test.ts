import { describe, expect, it } from 'vitest';
import { Xoshiro128StarStar } from './xoshiro128ss';

describe('Xoshiro128StarStar', () => {
  it('repeats the same sequence for the same state', () => {
    const seed = { s0: 1, s1: 2, s2: 3, s3: 4 };
    const left = new Xoshiro128StarStar(seed);
    const right = new Xoshiro128StarStar(seed);

    expect(Array.from({ length: 16 }, () => left.nextUint32())).toEqual(
      Array.from({ length: 16 }, () => right.nextUint32()),
    );
  });
});
