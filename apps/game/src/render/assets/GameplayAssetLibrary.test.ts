import { describe, expect, it } from 'vitest';
import { gameplayAssetLodForQuality } from './GameplayAssetLibrary';

describe('gameplay asset quality contract', () => {
  it('selects lower-cost authored LODs for constrained devices', () => {
    expect(gameplayAssetLodForQuality('compatibility')).toBe(2);
    expect(gameplayAssetLodForQuality('mobile')).toBe(1);
    expect(gameplayAssetLodForQuality('desktop')).toBe(0);
    expect(gameplayAssetLodForQuality('cinematic')).toBe(0);
  });
});
