# Gravity Run

Gravity Run is a high-speed browser game built around one authoritative mechanic: tether to a gravity well, convert forward velocity into a controlled orbit, and release along the tangent toward the next route decision.

This repository is scaffolded as a lightweight pnpm monorepo. The first implementation target is a movement laboratory, not a content-complete game.

## Repository map

```text
apps/game                 Three.js game client and presentation layer
apps/server               Minimal API shell for health, challenges and replay intake
packages/shared           Deterministic math, replay protocol and seeded randomness
packages/game-config      Versioned movement, scoring and quality configuration
packages/asset-pipeline   Asset-manifest validation and future glTF/KTX2 tooling
content                   Source/export conventions and runtime manifests
tools/benchmark           Device and renderer capability benchmark shell
docs                      Architecture and implementation documentation
```

## Core architectural rules

1. The simulation cannot import React, Three.js, browser APIs or rendering code.
2. Rendering consumes immutable simulation snapshots and cannot mutate gameplay state.
3. Input is converted into tick-addressed transitions before entering the simulation.
4. Ranked runs are identified by simulation version, configuration hash, seed and input timeline.
5. Device quality tiers can change presentation only. They cannot change collision, timing, target placement or scoring.
6. Gameplay code uses metres, seconds and radians.

## Setup

```bash
corepack enable
pnpm install
pnpm dev
```

The development server starts the game client. Use `pnpm dev:server` in a second terminal for the API shell.

## Initial milestone

The scaffold boots into a controlled movement laboratory containing:

- one player proxy;
- one gravity well;
- a fixed 60 Hz simulation loop;
- press/hold/release input buffering;
- an analytical tether constraint;
- an independent Three.js presentation scene;
- renderer quality detection and debug telemetry.

The next implementation step is to tune latch, orbit and release feel against the architecture document before adding procedural modules or account systems.
