import { describe, expect, it } from 'vitest';
import { environmentLodProfile } from './EnvironmentAssetLibrary';

describe('environment LOD profiles', () => {
  it('never gives lower-power devices a more expensive near LOD', () => {
    expect(environmentLodProfile('compatibility').highestLod).toBe(2);
    expect(environmentLodProfile('mobile').highestLod).toBe(1);
    expect(environmentLodProfile('desktop').highestLod).toBe(0);
    expect(environmentLodProfile('cinematic').highestLod).toBe(0);
  });

  it('increases transition distance with presentation capability', () => {
    expect(environmentLodProfile('mobile').farDistance).toBeLessThan(
      environmentLodProfile('desktop').farDistance,
    );
    expect(environmentLodProfile('desktop').farDistance).toBeLessThan(
      environmentLodProfile('cinematic').farDistance,
    );
  });
});
