# GRAVITY RUN
## Version 1.1 Implementation Addendum

**Date:** 3 August 2026  
**Status:** Normative engineering addendum  
**Applies to:** `docs/GRAVITY_RUN_GAME_ARCHITECTURE.md` version 1.0  
**Repository:** `MikeyNu/gravity-run`

This addendum records the validated architectural changes required before Gravity Run enters implementation. It supplements the existing version 1.0 document and resolves its highest-risk ambiguities in physics, deterministic replay, rendering, cinematography, asset production, mobile performance, online validation, and QA.

The complete version 1.1 architecture has also been regenerated as synchronized Markdown and DOCX deliverables. This repository addendum exists so that the approved changes are reviewable in Git while the binary document is handled separately.

---

## 1. Product and simulation contract

Gravity Run is a controlled orbital traversal game, not a generic rigid-body grappling game. The authoritative player controller must be analytic and fixed-step. Rapier is used for scene queries, swept collision, static colliders, triggers, and seeded kinematic hazards. A simulated rope or unconstrained rigid-body joint must not drive the player because it would make timing difficult to tune, create browser-dependent outcomes, and weaken replay validation.

The production simulation runs at a fixed 60 Hz:

```text
dt = 1 / 60 seconds
```

Rendering interpolates between the previous and current simulation snapshots. Input transitions are timestamped, quantized to ticks, and consumed on fixed ticks. Presentation frame rate and graphics quality must never alter target selection, collision, route generation, speed, timing windows, scoring, or replay state.

The movement kernel should initially be implemented in strict TypeScript for rapid prototyping. Before ranked launch, the authoritative mathematical kernel should move into a compact Rust-to-WASM package shared by browser and server validation. This avoids relying on browser-specific transcendental behavior and allows identical state hashing across environments.

Authoritative state must not use JavaScript `Math.sin` and `Math.cos` for ranked orbit progression. Use deterministic WASM mathematics or a versioned lookup table with documented maximum error. Store time as integer ticks, use stable entity IDs, centralize epsilons, avoid unordered state iteration, and split random generation into named streams so cosmetic randomness cannot change course geometry.

---

## 2. Coordinate system and endless-world precision

One world unit equals one meter. Y is up. Module-local positive Z is the authored forward direction. Character height starts at approximately 1.75 m. Standard gameplay values should initially remain within these ranges:

- tether radius: 5 m to 18 m;
- free-flight speed: 12 m/s to 42 m/s;
- well physical radius: 1.2 m to 2.5 m;
- player capsule radius: approximately 0.32 m;
- collision skin: 0.025 m to 0.05 m.

These are starting values, not universal constants. They must be tuned through playtesting while retaining consistent world scale.

The endless world must use segmented origin rebasing. Logical progress is stored separately from local scene coordinates. At safe module boundaries, subtract the same offset from the player, active modules, wells, hazards, particles, camera history, and physics objects on one fixed tick. Replays store logical module IDs and local states rather than unbounded absolute coordinates. A huge far plane or logarithmic depth buffer is not a substitute for origin management.

---

## 3. Player collision representation

The animated character mesh is never the gameplay collider. Use:

- one swept capsule or sphere for world collision;
- a smaller critical capsule for precision lethal hazards;
- a larger non-colliding near-miss probe;
- a pickup trigger;
- an optional camera avoidance proxy.

The custom movement solver proposes a transform each tick. The collision layer performs a swept shape cast from the previous position to the proposed position. On impact, move to time of impact minus skin width, classify the surface, resolve remaining motion, and emit a deterministic event containing point, normal, relative speed, material class, and hazard ID.

Rapier’s generic character controller is not the complete solution because Gravity Run requires rotational orbital motion. It may inform move-and-slide behavior for scrape surfaces, but lower-level shape casts and a custom solver remain authoritative.

No uncontrolled dynamic rigid body may affect ranked gameplay. Moving hazards are kinematic and tick-driven. Decorative debris either has no player collision or is presentation-only.

---

## 4. Gravity-well schema and target acquisition

Each gravity well requires a versioned schema containing:

```text
id
moduleId
position
orientation
physicalRadius
minimumOrbitRadius
maximumOrbitRadius
acquisitionRadius
latchRadius
allowedApproachCone
wellClass
baseOrbitAcceleration
maximumTangentialSpeed
releaseImpulseProfile
routeEdges
authoredPriority
riskRating
visualProfileId
audioProfileId
```

Initial well classes:

- Standard;
- Accelerator;
- Precision;
- Recovery.

Target acquisition proceeds in this order:

1. query nearby wells through a spatial hash or Rapier broad phase;
2. reject inactive or exhausted wells;
3. reject candidates beyond the hard backward cone;
4. reject candidates whose predicted latch path has insufficient clearance;
5. reject heavily occluded candidates through occlusion-only ray tests;
6. score remaining candidates;
7. apply hysteresis before changing the preview target.

The target score combines normalized forward alignment, screen centrality, distance preference, incoming velocity compatibility, route continuation quality, authored priority, turn severity, occlusion penalty, and recently used penalty. Camera orientation may affect screen centrality for presentation, but the camera must never change the physics basis or final route result.

The current candidate retains a hysteresis bonus. A replacement candidate must remain materially better for multiple ticks. A flickering reticle is treated as a control defect because the game has only one primary input.

---

## 5. Normative tether and orbit mathematics

The tether is a gameplay constraint. The rendered beam, sag, vibration, and particles follow the solver but never drive it.

Symbols:

```text
C = gravity-well centre
P = player position
V = player velocity
R = P - C
r = |R|
u = R / r
N = orbit-plane unit normal
T = normalize(N x u)
s = tangential speed
omega = s / r
```

At latch:

```text
R0 = P0 - C
u0 = normalize(R0)
Nraw = R0 x V0
```

When `Nraw` is stable:

```text
N = normalize(Nraw)
```

When the approach is nearly radial, use a route-authored fallback:

```text
Nfallback = normalize(R0 x Droute)
```

If that is also degenerate, use a module-space fallback. Do not use camera orientation in the authoritative fallback.

Choose the tangent direction that best matches incoming velocity:

```text
Tplus = normalize(N x u0)
Tminus = -Tplus
T0 = argmax(dot(Tplus, V0), dot(Tminus, V0))
```

Decompose incoming velocity:

```text
vRadial = dot(V0, u0)
vTangential = dot(V0, T0)
```

A strong inward radial component is damped over a short fixed latch blend instead of being removed instantly. A starting blend duration of three to six ticks is appropriate for testing.

Orbital phase advances from angular speed:

```text
angularAcceleration = tangentialAcceleration / r
omegaNext = clamp(omega + angularAcceleration * dt, omegaMin, omegaMax)
deltaTheta = omegaNext * dt
```

Rotate the radial vector using Rodrigues’ formula:

```text
uNext =
    u * cos(deltaTheta)
  + (N x u) * sin(deltaTheta)
  + N * dot(N, u) * (1 - cos(deltaTheta))
```

Re-orthonormalize periodically:

```text
uNext = normalize(uNext - N * dot(N, uNext))
TNext = normalize(N x uNext)
```

Then:

```text
Pconstraint = C + rNext * uNext
VtangentNext = (omegaNext * rNext) * TNext
Vnext = VtangentNext + VradialResidual + VwellMotion
```

The proposed constrained movement still passes through continuous collision detection.

Holding may increase tangential speed, but each well has an explicit energy budget:

```text
sTarget = min(
  sEntry + aHold * holdTime,
  sEntry + deltaSWellBudget,
  sMaxWell,
  sGlobalMax
)
```

The well stores consumed energy so detach-and-relatch behavior cannot reset the budget. Radius contraction, if retained after prototyping, must not create unlimited energy.

Release velocity is:

```text
Vrelease =
    Vtangent
  + radialReleaseRetention * VradialResidual
  + releaseImpulse * T
  + wellMotionContribution
  + boundedRouteAssistImpulse
```

Tangential velocity is preserved. A perfect release may add a modest capped impulse, but cannot rotate a fundamentally incorrect release into a correct one. Use a soft speed saturation curve rather than a visible hard stop.

The mathematical basis and rotation equations were numerically sanity-checked across 100,000 randomized cases. The generated basis retained orthogonality and unit length to floating-point tolerance. Production acceptance still requires deterministic browser/server golden replays.

---

## 6. Free flight and perfect-release grading

Free flight uses an explicit acceleration model:

```text
A = Gworld + Aauthored + Adrag
Vnext = V + A * dt
Pnext = P + V * dt + 0.5 * A * dt^2
```

World gravity is weak relative to traversal momentum. It creates a readable arc and recovery pressure, not a realistic falling simulation. Linear and bounded quadratic drag should be compared in the movement laboratory.

Perfect release quality must not depend only on a hidden angular window. Compare release direction to the desired route direction without calling `acos`:

```text
Ddesired = normalize(Paim - Prelease)
Drelease = normalize(Vrelease)
alignment = dot(Drelease, Ddesired)
```

Also evaluate predicted miss distance, clearance, speed band, route phase, and risk class. For a constant-velocity closest-approach approximation:

```text
Q = Ptarget - Prelease
tClosest = clamp(dot(Q, Vrelease) / dot(Vrelease, Vrelease), 0, horizon)
missDistance = |Q - Vrelease * tClosest|
```

The real predictor reuses the free-flight acceleration model and simplified collision bounds for roughly 0.4 to 1.0 seconds. Tutorial and accessibility profiles may show a clearer trajectory arc. Standard gameplay should normally show only a reticle response and short tangent streak.

Input forgiveness includes buffered latch, coyote release, target hysteresis, scrape tolerance by difficulty, and visible recovery wells. Recovery assistance breaks combo or reduces score; it must not silently bend physics.

---

## 7. Camera and cinematography contract

The gameplay camera is a readability system first and a cinematic system second. It must preserve the player silhouette, active target, route options, release direction, and collision risk.

Three.js `PerspectiveCamera` uses vertical field of view. The design should target a stable horizontal field of view across aspect ratios, then derive vertical FOV:

```text
vFov = 2 * atan(tan(hFov / 2) / aspect)
```

Starting landscape horizontal FOV: 78 to 88 degrees. Do not use one fixed vertical FOV across phone, tablet, ultrawide, and desktop displays.

Camera rig:

```text
CameraRoot
  FollowSpring
    AimPivot
      OrbitOffset
        RollNode
          ShakeNode
            Camera
```

Use critically damped springs rather than frame-dependent lerp. Follow distance, look-ahead, FOV, roll, and shake each have separate limits. During orbit, the camera moves outward and slightly above the orbit plane. At release, it leads the launch direction. Split routes must remain visible until the commitment threshold.

Camera collision casts from focus point to desired camera position against a dedicated camera layer. It pulls inward quickly and restores slowly. The camera never pushes the player and never changes simulation state.

Recommended lens behavior:

- live gameplay: approximately 28 to 35 mm equivalent feel;
- large landmark beat: 24 to 28 mm;
- menu/replay hero view: 50 to 85 mm;
- very wide close gameplay framing is prohibited because it distorts release judgement.

Depth of field is disabled or minimal during high-speed gameplay. Use it in title, selection, results, replay, and photo mode. Focus pulls are slow and bounded. Motion blur should be limited to high-tier replay/cinematic contexts unless a stable velocity-buffer implementation is validated. Speed streaks and directional particles are cheaper and more readable in live play.

Camera shake has separate low-frequency body, impact, and speed-vibration layers. Reduced-motion mode disables roll, limits FOV animation, limits shake, removes radial blur, and shortens failure cinematics.

---

## 8. Realistic Three.js rendering without mandatory path tracing

Realism comes primarily from coherent scale, material response, reflections, indirect light, contact, atmosphere, exposure, bevels, and force-aware animation. Live path tracing is not required.

Production baseline:

- Three.js `WebGLRenderer`;
- WebGL 2;
- linear working color space;
- sRGB color textures and display output;
- HDR scene values;
- `MeshStandardMaterial` for most surfaces;
- `MeshPhysicalMaterial` only for selected hero materials;
- PMREM-filtered environment maps;
- one dominant key light;
- baked indirect illumination on large static modules;
- selective local real lights;
- restrained post-processing.

A `WebGPURenderer` path remains feature-flagged until validated. It is not the sole production renderer because the Three.js material/post stack differs from traditional WebGL and remains experimental.

Reference rendering stack:

- Three.js;
- pmndrs `postprocessing` for WebGL effects;
- Rapier for collision/query support;
- `three-mesh-bvh` for accelerated static-mesh raycasts and tooling;
- glTF Transform, meshoptimizer/gltfpack, and KTX-Software for assets;
- optional `realism-effects` for high-tier SSGI/TAA/motion-blur experiments after stability testing;
- optional `three-gpu-pathtracer` for reference stills, marketing images, and stationary photo mode only.

Ray-tracing appearance is approximated through:

- PMREM environment reflections;
- local reflection probes or box-projected cubemaps where justified;
- baked global illumination and emissive contribution;
- light probes or spherical harmonics for the moving character;
- AO/GTAO for contact depth;
- selected high-tier screen-space reflections;
- planar reflections only for rare hero surfaces;
- reflection-probe fallback when screen-space data is absent.

A screen-space effect must never define the only readable material response because off-screen information is unavailable and edge artifacts are inevitable.

---

## 9. Lighting, materials, atmosphere, and post-processing

Lighting layers:

1. HDR environment illumination converted through PMREM;
2. one dominant directional or area-like key light;
3. baked lightmaps or vertex irradiance for static modules;
4. selective local real lights near gameplay;
5. contact grounding through AO, decals, and character contact shadow;
6. height/distance fog and local atmosphere.

Hard-surface assets require real or baked bevel response. Perfectly sharp edges are a major cause of synthetic-looking renders. Roughness variation carries much of the realism and must not be uniform. Metallic values remain physically plausible. Clearcoat, sheen, transmission, anisotropy, and iridescence are used only where the material needs them because each feature adds shader cost.

Mobile lighting uses baked indirect illumination, one key shadow or blob/contact fallback, PMREM reflections, and analytic fog. Full volumetric ray marching is reserved for high-end replay/cinematic mode. Mobile uses layered fog cards, soft particles, depth fading, and analytic light cones.

Default WebGL post chain:

1. scene render;
2. optional AO;
3. selective bloom;
4. optional gameplay-safe distortion;
5. antialiasing if render-to-texture requires it;
6. LUT/color grade;
7. tone mapping/output transform;
8. vignette and subtle grain;
9. HUD outside scene tone mapping.

Chromatic aberration is limited to short failure/singularity events. Strong full-screen blur, film damage overlays, and persistent lens effects are prohibited during active traversal.

---

## 10. Complete asset and texture contract

Every runtime asset requires a stable ID, purpose, source file, LOD policy, collider, material list, texture package, memory estimate, quality-tier eligibility, and validation result.

Initial character: **The Courier**.

Required character production assets:

- concept turnarounds and proportion sheet;
- high-poly source;
- LOD0: approximately 45k to 65k triangles;
- LOD1: 22k to 35k;
- LOD2: 8k to 15k;
- LOD3/impostor: 2k to 5k or approved impostor;
- primary gameplay collider;
- camera proxy;
- skeleton and tether-hand socket;
- 16 core clips including free flight, latch, orbit directions, release, perfect release, scrape, impact, failure, revive, idle, and victory;
- two-bone arm IK and additive look/recoil layers;
- limited secondary motion with low-tier baked fallbacks.

Gravity-well family:

- shared core construction kit;
- Standard, Accelerator, Precision, and Recovery classes;
- three render LODs where visible distance requires them;
- simple authoritative colliders;
- preview, selected, latch, orbit, perfect, danger, cooldown, and disabled visual states;
- low-overdraw mobile VFX variants;
- class-specific audio profiles.

Environment biome: **The Shattered Vertical City**.

Required environment kit:

- large broken tower segments;
- modular floors, walls, beams, trusses, braces, rails, pipes, cable anchors, vents, service boxes, catwalks, panels, antennas, broken slabs, and facade fragments;
- close props such as crates, junction boxes, barriers, signs, fans, tanks, conduit, rubble, lamps, screens, and vents;
- distant silhouette clusters, proxy towers, bridge masses, and atmosphere cards;
- hazards including rotating blades, closing gates, piston arms, moving walls, electrical arcs, laser sweeps, collapsing sections, and singularity volumes;
- route gates, pickups, landmark markers, recovery markers, and telegraph assets.

Texture library:

- industrial painted metal;
- bare brushed metal;
- rough dark alloy;
- oxidized metal;
- weathered steel;
- reinforced floor;
- composite panel;
- concrete/ceramic structure;
- dirty glass;
- cable rubber;
- trim and grime overlays;
- decal atlases for numbering, warnings, arrows, maintenance labels, scratches, leaks, soot, paint chips, and faction marks;
- separate high-value Courier, well, and landmark packages.

Typical packed ORM:

```text
R = ambient occlusion
G = roughness
B = metalness
```

Color textures are sRGB. Normal, ORM, masks, height, and lightmaps remain linear. Use KTX2/Basis Universal. ETC1S is appropriate for compact color and many mask textures; UASTC is preferred for normal maps, detailed decals, and assets sensitive to block artifacts.

Starting texel density:

- hero close-up: 256 to 512 px/m;
- normal gameplay architecture: 96 to 192 px/m;
- distant structures: 16 to 64 px/m;
- landmark surfaces: 128 to 256 px/m where composition requires it.

Do not make every texture 2K or 4K. Resolution follows observed screen-space need.

---

## 11. Asset pipeline and export validation

Source files remain under `content/source`. Runtime assets are generated and never manually edited.

Recommended export collections:

```text
EXPORT_RENDER_LOD0
EXPORT_RENDER_LOD1
EXPORT_RENDER_LOD2
EXPORT_COLLISION
EXPORT_OCCLUSION
EXPORT_SOCKETS
EXPORT_LIGHT_ANCHORS
EXPORT_DECOR_SPAWN
EXPORT_CAMERA_HINTS
EXPORT_METADATA
```

Export stages:

1. source validation;
2. Blender export;
3. glTF structural validation;
4. animation key reduction;
5. vertex/index optimization;
6. geometry compression selection;
7. texture resizing and KTX2 encoding;
8. pruning and deduplication;
9. manifest generation;
10. runtime load smoke test;
11. screenshot/budget report;
12. content-addressed publication.

CI fails on duplicate IDs, unsupported textures, uncompressed production textures, excess material slots, missing LODs, pivot mismatch, excessive geometry/bones, missing collision, invalid sockets, impossible module paths, naming errors, transfer/residency regression, shader-variant explosion, or glTF validation errors.

---

## 12. Procedural modules and reachability

The world is assembled from authored modules, not random object scatter. A module contains entry/exit sockets, target graph, hazards, collision, camera hints, lighting anchors, decorative zones, streaming bounds, and difficulty metadata.

Generation process:

1. select biome/chapter;
2. build a difficulty envelope;
3. choose a socket-compatible module;
4. apply a seed-derived safe variant;
5. validate graph reachability;
6. validate collider clearance;
7. compute look-ahead route quality;
8. stream dependencies;
9. activate at a fixed boundary;
10. retire modules behind the collapse plane.

Use a conservative sampled reachable-set validator over finite horizons. Sample position, velocity, tether state, orbit phase, and energy budget. Propagate allowed input transitions, cluster near-equivalent states, and reject modules or transitions with no plausible solution. Daily challenge seeds are pre-generated and validated before signing.

Module QA includes clearance tests, nominal routes, early/late release sweeps, min/max speed sweeps, target selection sweeps, camera visibility, target occlusion, collapse pacing, mobile performance, and deterministic replay.

---

## 13. Mobile performance and delivery budgets

The mobile version is a first-class profile. Landscape orientation is recommended for active play. Menus may support portrait.

Frame budgets:

| Target | Total | Main thread | GPU | Reserve |
|---|---:|---:|---:|---:|
| 60 Hz | 16.67 ms | <= 7.0 ms | <= 8.0 ms | >= 1.6 ms |
| 45 Hz | 22.22 ms | <= 9.0 ms | <= 11.0 ms | >= 2.2 ms |
| 30 Hz | 33.33 ms | <= 12.0 ms | <= 17.0 ms | >= 4.3 ms |

Dynamic render scale ranges:

- compatibility: 0.55 to 0.75;
- mobile balanced: 0.65 to 0.95;
- desktop balanced: 0.80 to 1.00;
- cinematic: 0.85 to 1.00 with a pixel cap.

Downgrade order:

1. render scale;
2. particles/transparent overdraw;
3. AO resolution or disablement;
4. shadow resolution/update frequency;
5. volumetrics;
6. SSR/SSGI;
7. motion blur and DoF;
8. decorative distance and LOD residency.

The fixed gameplay simulation remains 60 Hz.

Tutorial-ready transfer target:

- mobile: <= 10 MB;
- desktop: <= 16 MB.

First-run-ready cumulative target:

- mobile: <= 22 MB;
- desktop: <= 35 MB.

Loading groups separate shell, movement core, first run, biome expansion, social/account, cosmetics, and cinematic content. Maintain active, ready, prefetch, and retire module rings. Missing decoration may degrade; missing collision, target graph, or hazards may not.

Thermal validation requires sustained 20-minute physical-device runs. Quality may downgrade during a session but should not oscillate upward repeatedly. A battery-saver profile caps presentation and selects the compatibility renderer profile.

---

## 14. Replay validation and online architecture

A replay is an input log plus hashes, not a video and not a trusted position recording.

Replay identity includes:

- game build;
- simulation kernel hash;
- movement/scoring/content configuration hashes;
- challenge ID or course seed;
- fixed simulation rate;
- assist flags;
- input transitions by delta tick;
- periodic checkpoints and state hashes;
- final failure/score metadata.

The server reconstructs the signed challenge, initializes the exact simulation kernel, consumes inputs, verifies checkpoints and events, recomputes score, and commits the result atomically. Final client score, positions, touched target list, and elapsed wall-clock time are untrusted.

A daily challenge manifest is signed and immutable. It includes seed, module set, configuration hashes, attempt limit, times, content hash, and signature. Invalid or defective challenges are revoked and replaced, not silently edited.

Local play, tutorial, cached endless mode, settings, and local progression remain available during service failure. Eligible signed replays can queue offline for later upload. Ranked placement appears only after validation.

---

## 15. QA and release gates

Mandatory test layers:

- pure math unit tests;
- randomized property/invariant tests;
- simulation tests;
- golden deterministic replays;
- cross-browser/server determinism matrix;
- module reachability/content tests;
- visual regression scenes;
- performance regression;
- network/offline tests;
- security/fuzz tests;
- physical-device playtests.

Required invariants:

- no non-finite state;
- no unbounded orbit energy;
- no duplicate latch/near-miss rewards;
- collision resolution does not increase penetration;
- release removes the orbit constraint;
- quality-tier changes do not alter state hashes;
- identical seed/config/input produces identical checkpoint hashes;
- pause does not advance ranked ticks;
- module retirement never removes active gameplay state.

Golden replays include standard orbit, radial-degenerate approach, early/perfect release, target skip, near miss, scrape, lethal collision, moving hazard, origin rebase, module transition, assisted run, and long stress run.

Every gameplay feature is incomplete until it has documented state, deterministic behavior, debug visualization, tests, replay/server implications, accessibility behavior, quality-tier behavior, asset/VFX/audio requirements, performance measurement, and human playtest evidence.

---

## 16. Implementation decisions

The architecture is accepted only with these contracts:

1. analytic orbital movement, not a generic grappling rigid body;
2. fixed-step deterministic simulation;
3. renderer and presentation decoupled from gameplay;
4. WebGL2 production baseline and optional WebGPU path;
5. realism through coherent raster techniques rather than mandatory path tracing;
6. limited gameplay DoF, blur, aberration, and shake;
7. complete asset/texture/collider/LOD manifests;
8. validated authored procedural modules;
9. signed immutable ranked challenges;
10. server-validated input replays;
11. mobile-specific budgets and sustained thermal tests;
12. cosmetic-only progression with no gameplay advantage;
13. immediate restart as a release-critical requirement.

---

## 17. Primary technical references

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer.html
- Three.js PerspectiveCamera: https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
- Three.js WebGLRenderer: https://threejs.org/docs/#api/en/renderers/WebGLRenderer
- Three.js PMREMGenerator: https://threejs.org/docs/#api/en/extras/PMREMGenerator
- Three.js MeshPhysicalMaterial: https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial
- Rapier JavaScript determinism: https://rapier.rs/docs/user_guides/javascript/determinism/
- Rapier scene queries: https://rapier.rs/docs/user_guides/javascript/scene_queries/
- Rapier character controller: https://rapier.rs/docs/user_guides/javascript/character_controller/
- pmndrs postprocessing: https://pmndrs.github.io/postprocessing/public/docs/
- Khronos KTX 2.0: https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html
- Khronos glTF: https://registry.khronos.org/glTF/
- glTF Transform: https://gltf-transform.dev/
- Blender color management: https://docs.blender.org/manual/en/latest/render/color_management.html
- Blender motion blur: https://docs.blender.org/manual/en/latest/render/cycles/render_settings/motion_blur.html
- three-mesh-bvh: https://github.com/gkjohnson/three-mesh-bvh

Exact package versions must be pinned and revalidated through deterministic replay, screenshot, asset-loader, and performance comparison before upgrades.
