# Gravity Run implementation gap audit

**Audit basis:** `GRAVITY_RUN_GAME_ARCHITECTURE.md`, revision 1.1  
**Audited branch:** `agent/complete-game`  
**Purpose:** prevent the project from being described as complete until each architecture exit criterion is evidenced by code, assets and QA.

## Status model

- **Implemented:** present in the branch and exercised by a test or deterministic QA tool.
- **Partial:** a working vertical slice exists, but the architecture contract is not yet complete.
- **Missing:** no production implementation exists.
- **Blocked:** implementation exists or is planned, but cannot be certified in the current environment.

## System audit

| Architecture area | Status | Evidence | Remaining acceptance work |
| --- | --- | --- | --- |
| Fixed-step simulation | Implemented | `FixedStepLoop`, `GravityRunSimulation` | Cross-browser replay fixtures and authoritative WASM kernel remain pre-launch requirements. |
| Orbit and release model | Partial | Analytical basis, constrained orbit and release grading | Replace browser trigonometry in ranked mode; complete coyote-release and energy-tuning playtests. |
| Procedural course | Partial | Seeded authored-module generator | Expand authored module library, prove reachability across large seed sets, add route difficulty envelopes. |
| Collision and failure | Partial | Continuous sphere/AABB sweep, collapse and floor failures | Rapier-backed complex hazards, scrape response, moving hazard sweeps and collision regression corpus. |
| Scoring and combo | Partial | Distance, fragments, release grades, near misses and combo | Risk-route multipliers, target skips, daily scoring rules and balancing telemetry. |
| Replay protocol | Partial | Input transitions and periodic checksums | Server reconstruction, version rejection, signed challenge proofs and ghost playback. |
| Camera and cinematography | Partial | Velocity-relative spring rig, horizontal-FOV normalization, target framing and reduced-motion mode | Camera collision, orbit-plane framing, bounded roll, shot grammar and replay camera. |
| Rendering pipeline | Partial | Tiered composer, HDR buffers, thresholded bloom, SMAA, final AgX, fog and adaptive resolution | Contact shadows, probes, material audit, GPU profiling and visual-regression certification. |
| Gravity-well assets | Partial | Four deterministic variants, three LODs, UVs, PBR maps and QA | Art-direct silhouette refinement, KTX2 compression, meshopt pass and in-engine lighting review. |
| Courier character | Missing | Procedural capsule proxy only | Final model, topology, UVs, materials, rig, sockets, IK and animation set. |
| Environment kit | Implemented | Deterministic nine-family city kit, three LODs, UVs, shared trim/decal textures, collision/occlusion proxies, route-safe streamed placement, quality-tiered LOD, fallback transition and disposal tests | KTX2/meshopt packaging, lightmap refinement and in-engine visual certification remain release work. |
| Hazards and pickups | Partial | Deterministic GLB family for spire, blade, debris, collapse gate and gravity fragment; three LODs, UVs, PBR maps, collision/occlusion proxies and runtime loading | Add moving crusher, sliding wall, energy barrier, laser sweep and per-state anticipation/cooldown VFX. Moving hazards still require authoritative swept collision. |
| VFX | Partial | Tension-aware ribbon tether, deterministic trail, speed lines, and pooled release/collect/near-miss/failure bursts | Collapse field refinement, scrape/impact variants and authored environmental particles. |
| Audio | Partial | Deterministic UI, tether, release, fragment, near-miss and failure assets with Web Audio routing | Music states, ambience, broader variation pools, mix snapshots and device listening certification. |
| UI shell | Partial | Concept-matched menu, HUD, pause and settings | Tutorial progression, results detail, character selection, daily flow, leaderboard and responsive visual QA. |
| Accessibility | Partial | Reduced motion, keyboard-safe controls, master volume and mute | Remapping, high contrast, text scale, haptics control and screen-reader flow. |
| Online services | Missing | Minimal API shell only | Persistent storage, challenge service, replay validation, leaderboards, rate limits and observability. |
| PWA and streaming | Partial | Web manifest | Service worker, cache versioning, offline replay queue, staged asset loading and context-loss recovery. |
| Performance certification | Blocked | Tiered LOD and QA budgets | Resolved production build, GPU timing, mobile thermal tests, memory captures and device matrix. |
| Anti-cheat and security | Missing | Version fields only | Server authority, signed manifests, replay limits, abuse controls and audit logging. |

## Production order

The remaining work must be delivered in dependency order:

1. **Asset and rendering foundation:** validated model pipeline, runtime loaders, post-processing, gameplay-prop family and environment module contract.
2. **Playable content:** Courier, authored city modules, hazards, pickups, VFX and audio.
3. **Session product:** complete menu/tutorial/results/settings/character/daily flows.
4. **Competitive services:** replay reconstruction, daily manifests, leaderboard and anti-cheat.
5. **Certification:** visual regression, deterministic fixtures, mobile performance, accessibility and release QA.

## Completion rule

The project is not “complete” when a feature merely has a placeholder. Completion requires:

1. production asset or intentional final procedural asset;
2. runtime integration;
3. deterministic or visual QA evidence;
4. mobile-tier behavior;
5. documented failure/fallback behavior;
6. architecture exit criterion checked off.

### Environment completion update

The modular Shattered Vertical City environment gap is closed. The runtime now streams authored architecture through a dedicated environment asset library and controller, while deterministic source generation and structural QA are available from a fresh clone. The next unresolved visual-production dependency is the authored gameplay-prop family for hazards and fragments.
