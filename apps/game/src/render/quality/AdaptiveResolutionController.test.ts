import { describe, expect, it } from 'vitest';
import { qualityProfiles } from '@gravity-run/game-config';
import { AdaptiveResolutionController } from './AdaptiveResolutionController';

describe('adaptive resolution', () => {
  it('reduces scale under sustained GPU pressure but respects the tier floor', () => {
    const controller = new AdaptiveResolutionController('mobile');
    for (let frame = 0; frame < 1500; frame += 1) controller.sample(36);
    expect(controller.scale).toBeGreaterThanOrEqual(qualityProfiles.mobile.renderScaleMin);
    expect(controller.scale).toBeLessThan(qualityProfiles.mobile.renderScaleMax);
  });

  it('does not react to isolated background-tab frame spikes', () => {
    const controller = new AdaptiveResolutionController('desktop');
    controller.sample(500);
    expect(controller.scale).toBe(qualityProfiles.desktop.renderScaleMax);
  });
});
