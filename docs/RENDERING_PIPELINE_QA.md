# Gravity Run rendering pipeline QA contract

## Scope

This document covers the second production tranche: camera mathematics, quality-tier scaling, HDR post-processing, tether rendering, player trail, speed lines, lighting, and deterministic world dressing.

## Frame pipeline

The renderer follows one of two paths:

### Compatibility tier

1. WebGL render directly to the canvas.
2. AgX tone mapping on the renderer.
3. No post-processing framebuffer allocation.
4. Reduced particle and world-dressing counts.

### Mobile, desktop, and cinematic tiers

1. WebGL scene render into the post-processing composer.
2. Half-float intermediate buffers on desktop/cinematic; unsigned-byte buffers on mobile.
3. Restrained luminance-thresholded bloom.
4. SMAA selected by quality tier.
5. Subtle vignette.
6. AgX tone mapping as the final effect.

The renderer remains in `NoToneMapping` while the composer path is active so tone mapping is not applied twice.

## Camera invariants

- Horizontal field of view is the stable creative value. Vertical FOV is derived from aspect ratio.
- The camera is placed in a velocity-relative basis so route direction, not world axes, controls framing.
- Position, focus, and FOV use stable critically damped springs.
- Reduced-motion mode removes speed-driven lens expansion and uses faster, lower-lag camera settling.
- Target framing is bounded so the gravity well informs composition without pulling the player off screen.

## Adaptive-resolution invariants

- Quality profiles define hard minimum and maximum render scales.
- Resolution changes only after sustained frame-time pressure or sustained headroom.
- A cooldown prevents oscillation.
- Frames above 100 ms are ignored so background-tab or debugger stalls do not permanently lower quality.
- Resolution affects presentation only. It never changes simulation, collision, target placement, input timing, or score.

## VFX invariants

- The tether is a camera-facing quadratic ribbon, not a one-pixel line.
- Tether width, sag, color, and emissive intensity communicate tension.
- Player trail and speed lines are deterministic and pooled.
- Reduced-motion mode suppresses speed lines, lowers trail opacity, and reduces gravity-well movement.
- Additive effects remain narrow and thresholded so bloom does not flatten the image.

## QA evidence

- TypeScript/TSX parser pass: no syntax errors after the tranche rewrite.
- Camera conversion check: 72° horizontal at 16:9 resolves to approximately 44.46° vertical.
- Spring check: 240 fixed 60 Hz steps converge without overshoot or non-finite values.
- Adaptive-resolution check: sustained 36 ms mobile frames reduce scale to the configured floor without crossing it.
- Background-spike check: isolated frames above 100 ms do not alter scale.
- Resource-ownership check: shared GLB geometry/materials and VFX-owned buffers are disposed exactly once.

## Outstanding certification

A resolved dependency build, GPU captures, visual-regression screenshots, and real-device thermal testing remain required before release certification.
