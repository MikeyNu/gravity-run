# Gravity Run

Gravity Run is a high-speed browser game built around one authoritative mechanic: tether to a gravity well, convert forward velocity into a controlled orbit, and release along the tangent toward the next route decision.

## Current implementation

The repository now contains the first complete gameplay vertical slice rather than only a movement laboratory:

- deterministic authored-module course generation;
- multi-well target selection with hysteresis;
- analytical tether, orbit and tangent release movement;
- continuous sphere-versus-hazard sweeps;
- collapse pressure, failure states and immediate restart;
- distance, release, fragment and near-miss scoring;
- combo progression and decay;
- replay input capture and deterministic state checksums;
- responsive Three.js presentation and mobile/desktop input parity.

The procedural visual proxies are intentionally temporary. Final character, animation, environment, sound and texture production remains governed by the architecture and art pipeline documents.

## Repository map

```text
apps/game                 Three.js game client and presentation layer
apps/server               API shell for challenges and replay intake
packages/shared           Deterministic math, replay protocol and seeded randomness
packages/game-config      Versioned movement, scoring, course and quality configuration
packages/asset-pipeline   Asset-manifest validation and future glTF/KTX2 tooling
content                   Source/export conventions and runtime manifests
docs                      Architecture and implementation documentation
```

## Setup

```bash
corepack enable
pnpm install
pnpm dev
```

Use `pnpm dev:server` in a second terminal for the API shell.

## Controls

- Hold primary mouse, touch, Space or Enter to latch the selected gravity well.
- Continue holding to consume the well's bounded acceleration budget.
- Release to preserve tangent velocity and launch toward the next route decision.
- Press after failure to restart immediately.
