# GRAVITY RUN
## Complete Game Architecture, Rendering, Asset Production and Mobile Performance Specification

Version 1.0 | 3 August 2026

Prepared for Michael Ndhlovu

## 1. Executive Definition

Gravity Run is a high-speed, one-input, third-person 3D traversal game built for the browser. The player is continuously propelled through a collapsing, vertically layered science-fiction world. The only primary action is to acquire a gravity target, tether to it, convert forward velocity into an orbit, and release at the correct tangent to reach the next target. The game must be readable within seconds, but its movement must support long-term mastery through timing, route choice, speed control, near misses, target skipping, and combo preservation.

The product is not an endless runner with a grappling-hook skin. Its defining system is controlled orbital motion. Every level element, camera choice, animation, visual effect, audio cue, and scoring rule must reinforce the player's understanding of trajectory, angular velocity, target validity, release quality, and danger.

The first release is a responsive browser game designed for desktop and modern mobile devices. It must install as a Progressive Web App, support mouse, keyboard, touch and gamepad, and preserve deterministic gameplay across quality tiers. Visual quality scales aggressively, but collision geometry, target placement, movement timing, score rules, seeded procedural generation, and replay data remain identical across supported devices.

The repository https://github.com/MikeyNu/gravity-run.git is the authoritative project root. At the time of this specification the repository is empty, so this document defines the initial structure rather than adapting an existing codebase.

## 2. Product Pillars and Non-Negotiable Design Rules

1. One input, several consequences. Pressing begins target acquisition and tether engagement. Holding sustains orbit and optionally increases controlled orbital energy. Releasing detaches and preserves tangential velocity.
2. Immediate restart. A failed run must restart in less than one second after the player confirms, with no route, account, or menu interruption.
3. Skill before progression. Purchasable or unlockable content may change appearance, sound, trails, emotes and presentation, but must not improve acceleration, collision size, target range or scoring potential.
4. Deterministic competition. A seed, player input timeline, game version and movement configuration must reproduce the same run closely enough for ghost racing and server validation.
5. Readable speed. Effects must communicate velocity without obscuring target silhouettes or collision hazards.
6. Cinematic framing without camera sabotage. The camera may create drama, but it may never hide the next required target, induce unearned motion sickness, or change collision outcomes.
7. Lightweight first load. The player must be able to reach the tutorial quickly. High-resolution environment packages, additional characters and cosmetic content must stream after interaction.
8. No fake realism tax. Realism comes from coherent lighting, material response, scale, motion, exposure, contact, atmosphere and animation. Expensive effects are only retained when they materially improve the image.
9. Graceful degradation. A low-tier mobile device receives a composed, attractive version of the same game rather than a broken imitation of the desktop preset.
10. No visual noise without gameplay purpose. Bloom, chromatic aberration, camera shake, particles and distortion are event-driven and intensity-limited.

## 3. Target Platforms, Browser Contract and Quality Tiers

Primary deployment:
- Desktop Chrome, Edge, Firefox and Safari on current stable versions.
- Android Chrome on mid-range and flagship devices.
- iOS Safari on supported current iOS versions.
- Installable PWA shell with offline access to the tutorial and previously cached core assets.

Renderer policy:
- The initial production baseline should use Three.js WebGLRenderer because its ecosystem, post-processing interoperability and mobile behaviour are mature.
- A WebGPURenderer path should be developed behind a feature flag. Three.js documents WebGPURenderer as a universal renderer that uses WebGPU when available and falls back to WebGL2, but also describes it as experimental and notes that ShaderMaterial, onBeforeCompile and the traditional EffectComposer stack require migration to node materials and TSL. Therefore, it should not be the only shipping path until the selected effects and target browsers pass the project's compatibility matrix.
- Gameplay code must not know which renderer is active. Renderer adapters expose a stable interface for scene submission, quality controls, post effects, environment probes and profiling.

Quality tiers:
Tier 0, Compatibility:
- WebGL2.
- Render scale 0.55 to 0.75.
- No depth of field during gameplay.
- One directional light, baked lighting contribution, blob/contact shadows.
- No screen-space reflections.
- Reduced particles, no volumetric ray marching.
- 256 to 512 px environment textures, 512 px hero textures.
- 30 FPS target with fixed 60 Hz simulation.

Tier 1, Mobile Balanced:
- WebGL2.
- Dynamic render scale 0.65 to 0.9.
- Selective bloom, color grading, lightweight vignette.
- Half-resolution ambient occlusion where stable.
- One shadowed key light with tight cascades or a single fitted shadow map.
- 512 to 1024 px textures.
- 45 or 60 FPS target depending on thermal and frame-time stability.

Tier 2, Desktop Balanced:
- WebGL2 or WebGPU.
- Dynamic render scale 0.85 to 1.0.
- Temporal or morphological antialiasing strategy selected after motion tests.
- Selective bloom, depth of field in menus/replays and restrained gameplay moments.
- Screen-space ambient occlusion, improved shadows, local reflection probes.
- 1024 to 2048 px textures.
- 60 FPS target.

Tier 3, Cinematic:
- WebGPU where validated, otherwise high-end WebGL2.
- Render scale up to 1.0 at display resolution, capped to a practical pixel budget.
- High-quality node-based depth of field, higher sample shadows, richer volumetric fog, optional SSGI or screen-space reflections, enhanced particles, more debris and higher LOD residency.
- Reserved for replays, photo mode and high-end desktop play when GPU time remains below budget.

Capability detection must combine API availability with a short startup benchmark. Hardware labels alone are unreliable. The benchmark renders representative geometry, transparency, particles and post processing for approximately two seconds, then selects a tier. Runtime adaptation may move one tier down after sustained frame-time misses, memory pressure, tab restoration or thermal throttling. Automatic upward changes should happen only between runs to avoid visible instability.

## 4. Recommended Technology Stack

Core:
- TypeScript with strict compiler settings.
- Vite for the first playable client because it provides a small, direct build surface and excellent shader/asset iteration. A marketing shell may later use Next.js separately if needed.
- Three.js as the rendering engine.
- React only for menus, account UI, store, settings and overlays. The frame-critical game simulation must live outside React render cycles.
- Zustand or a small event-driven state store for non-simulation state. The deterministic simulation uses explicit data structures and snapshots.
- Rapier 3D through @dimforge/rapier3d-compat for broad-phase queries, swept collision tests, trigger volumes and environmental rigid bodies.
- postprocessing by pmndrs for the initial WebGL2 effects chain. It provides EffectComposer, DepthOfFieldEffect, SMAA, SSAO, bloom, LUT, tone mapping and other effects. Its depth-of-field effect supports autofocus targets and reduced-resolution blur processing.
- Howler.js for straightforward cross-browser audio playback, or raw Web Audio API for advanced music stems, dynamic filters and low-latency synthesis. The final choice should be made after iOS resume and latency testing.
- Zod for runtime validation of configuration, procedural modules, asset manifests and server payloads.
- Vitest for unit tests, Playwright for browser and visual regression tests.
- glTF Transform, gltfpack, meshoptimizer and KTX-Software in the asset pipeline.
- Sentry for client errors and performance traces, with privacy-safe sampling.
- PostHog or a comparable analytics provider for event funnels, only after consent and data policy review.
- Supabase or a compact API service for identity, leaderboards, daily challenge seeds and cloud saves. Authoritative validation must run in server-side code, not database triggers alone.

Do not add a full entity-component-system library during the MVP unless profiling proves that the hand-written data-oriented model is insufficient. The playable object count is manageable, and a simple component registry is easier to debug. The architecture should still keep data and behaviour separate enough to migrate later.

## 5. Repository and Package Architecture

Recommended root structure:

gravity-run/
  apps/
    game/
      src/
        app/
        bootstrap/
        game/
          simulation/
          movement/
          targeting/
          collision/
          scoring/
          procedural/
          replay/
          difficulty/
          camera/
          animation/
          audio/
          effects/
          entities/
          systems/
          config/
        render/
          core/
          webgl/
          webgpu/
          materials/
          post/
          lighting/
          particles/
          debug/
        ui/
        workers/
        styles/
      public/
        runtime/
      tests/
    server/
      src/
        auth/
        challenges/
        leaderboard/
        replay-validation/
        cosmetics/
        telemetry/
  packages/
    shared/
      src/
        math/
        protocol/
        schemas/
        constants/
        seeded-random/
    asset-pipeline/
      scripts/
      presets/
      validators/
    game-config/
      movement/
      difficulty/
      scoring/
      quality/
    eslint-config/
    tsconfig/
  content/
    source/
      blender/
      textures/
      audio/
      concept/
    exported/
      characters/
      environments/
      modules/
      props/
      vfx/
      audio/
    manifests/
  docs/
    GRAVITY_RUN_GAME_ARCHITECTURE.md
    ART_BIBLE.md
    CAMERA_BIBLE.md
    ASSET_NAMING.md
    PERFORMANCE_BUDGETS.md
  tools/
    benchmark/
    replay-viewer/
    seed-inspector/
    asset-auditor/
  .github/
    workflows/
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md

Use pnpm workspaces and Turborepo only if the server and shared packages are created immediately. For a single-client prototype, start with pnpm workspaces without Turborepo and add task orchestration when build duplication appears.

Dependency boundaries:
- simulation may import shared math and configuration only.
- render may read simulation snapshots but cannot mutate simulation state.
- UI communicates through commands and events.
- server shares schemas, random number implementation and validation logic, but never imports browser rendering code.
- assets are addressed through manifests rather than hard-coded URLs.

## 6. Runtime Lifecycle and Game State Machine

Top-level states:
BOOT -> CAPABILITY_TEST -> CORE_LOAD -> TITLE -> TUTORIAL or RUN_SETUP -> COUNTDOWN -> RUNNING -> FAILURE_SEQUENCE -> RESULT -> RESTART or TITLE.

Secondary substates during RUNNING:
FREE_FLIGHT, TARGET_PREVIEW, TETHER_LATCH, ORBITING, PERFECT_WINDOW, RELEASE, RECOVERY, DAMAGE_STUMBLE, FINISH_TRANSITION.

Rules:
- State transitions occur only on fixed simulation ticks.
- Rendering interpolates between the previous and current simulation snapshots.
- Input is sampled every animation frame, time-stamped, and consumed on the next fixed tick.
- Pausing freezes simulation time, audio envelopes and procedural streaming decisions. Rendering may continue at reduced frame rate for menu animation.
- Visibility loss automatically pauses non-ranked runs. Ranked daily attempts become invalid if the page is backgrounded beyond a configured tolerance.
- Restart clears transient systems through pool reset, not by reloading the page or recreating all WebGL resources.

## 7. Deterministic Simulation Model

Simulation frequency:
- Fixed 60 Hz step for movement, targeting, scoring and collision.
- Maximum accumulated catch-up should be capped, for example to four steps per rendered frame. If the page falls far behind, drop presentation time rather than simulating an uncontrolled backlog.
- Render interpolation alpha = accumulator / fixedStep.

Numerical rules:
- Use single-precision-compatible operations and avoid reliance on engine-specific rigid-body integration for the player.
- Centralize epsilon values.
- Quantize replay inputs to simulation ticks.
- Use a stable seeded PRNG such as xoshiro128** implemented identically in client and validator.
- Procedural generation consumes random numbers through named streams so adding cosmetic randomness does not alter course geometry.

Player state:
position, previousPosition, velocity, orientation, angularVelocity, tetherTargetId, tetherLength, orbitPlaneNormal, orbitAngle, orbitDirection, inputHeld, groundedRecovery, combo, energy, invulnerabilityTicks, animationState and cameraHints.

The player is represented by:
- a small swept sphere or capsule for world collision;
- a smaller critical-hit capsule for dangerous precision obstacles;
- separate trigger probes for pickups and near-miss scoring;
- no triangle-mesh collider on the animated character.

Rapier responsibilities:
- static environment colliders;
- broad-phase overlap and ray or shape casts;
- swept sphere/capsule queries between previous and proposed positions;
- optional dynamic debris that cannot affect ranked gameplay;
- trigger intersections;
- deterministic-enough validation support when used with identical parameters, while the player’s core orbit is still computed analytically.

The movement controller proposes a new transform each tick. Collision resolution performs a cast along the displacement, moves to the time of impact minus skin width, projects or reflects remaining velocity according to the surface type, and emits an impact event. This avoids tunnelling at high speed.

## 8. Gravity Target Acquisition

Each gravity well has:
id, transform, attraction radius, latch radius, physical radius, target class, risk rating, orbit speed modifier, allowable approach cone, polarity, occupancy flags, visual state and procedural metadata.

Candidate collection:
1. Query the spatial hash or Rapier broad phase for wells within acquisition radius.
2. Reject wells behind the hard backward cone unless a special recovery rule applies.
3. Reject occluded wells using one or two cheap ray tests against occlusion-only collision.
4. Reject wells whose predicted latch path intersects a lethal obstruction.
5. Score remaining wells.

Suggested target score:
forward alignment weight
+ screen-centre weight
+ distance desirability
+ route continuation quality
+ current velocity compatibility
+ authored priority
+ accessibility assistance
- sharp turn penalty
- occlusion confidence penalty
- recently used penalty.

Target selection must feel stable. Use hysteresis: the current preview target retains a score bonus until another candidate exceeds it by a threshold. Do not let the reticle flicker between close candidates.

Input behaviour:
- Press or touch begins selection and may latch immediately if the best candidate passes a confidence threshold.
- During a short grace window, the system can redirect to a superior target if the player has not yet entered committed orbit.
- Accessibility mode may widen acquisition cones and perfect-release timing without changing leaderboard eligibility; assisted runs use separate boards.

## 9. Tether, Orbit and Release Mathematics

The tether is a gameplay constraint, not a simulated rope. Visual rope dynamics follow the authoritative constraint but never drive it.

Latch:
- Capture target centre C, player position P and velocity V.
- Radius vector R = P - C.
- Orbit plane normal N is derived from cross(R, V). If its magnitude is too small, blend toward a camera-informed or route-authored normal.
- Tangent T = normalize(cross(N, R)) with sign chosen to best match V.
- Decompose V into tangential and radial components.
- Remove or damp dangerous inward radial velocity over a short latch blend to avoid a visible snap.
- Set tether length to clamp(length(R), target minimum, target maximum).

Orbit:
- Apply a centripetal positional constraint around C.
- Preserve and modify tangential speed through controlled acceleration.
- Add a small player-directed orbit pump while held, capped by target class and difficulty.
- Optionally shrink tether length by a limited amount to create acceleration, but do not allow uncontrolled energy creation.
- Blend the orbit plane toward the next route direction only within authored limits; this is an invisible assistance mechanism and must not overpower the player’s incoming trajectory.
- Calculate hazard collision using the swept player collider after the constrained position is proposed.

Release:
- Release velocity is the current tangential velocity plus a bounded residual radial component, authored boost and target impulse.
- Perfect quality is based on predicted route alignment, release phase, safe clearance and speed.
- A perfect release gives feedback and a modest, capped impulse. It must not correct a fundamentally wrong direction.
- Coyote release: if input is released a few ticks before latch confirmation, preserve the release intention and detach at the earliest valid tick.
- Buffered latch: if input is pressed shortly before a target enters range, allow a latch when valid.

A predictive trajectory renderer simulates a cheap, short-horizon version of the release path. It uses the same movement equations but excludes expensive collision detail. On low tiers show only the target reticle and a short tangent streak. On tutorial and accessibility modes show a clearer arc.

## 10. Scoring, Combo and Risk Economy

Base score:
distance travelled along course progress
+ target traversal score
+ pickup value
+ speed bonus
+ near-miss value
+ target-skip value
+ route risk value
+ perfect release value
multiplied by combo.

Combo:
- increases on perfect or high-quality releases, qualified near misses and dangerous route gates;
- pauses briefly during unavoidable cinematic transitions;
- decays or breaks on poor release, impact, emergency recovery or missed gate;
- has a hard maximum multiplier to keep leaderboards legible.

Release grades:
MISS, SAFE, GOOD, PERFECT, OVERDRIVE.
Grades are derived from normalized angular timing error, predicted alignment and clearance. Do not base the grade only on a hidden angular window because players will experience apparently identical releases differently at different speeds.

Near miss:
- Detect using a larger non-colliding probe swept along the movement segment.
- Score only if the inner collider does not impact and the relative approach passes a minimum speed.
- Each obstacle may score once per pass.
- Scale reward by clearance and speed but clamp extremes.

Target skip:
- The procedural route graph marks expected target edges.
- Reaching a later node without touching one or more optional intermediate nodes creates a skip reward.
- Mandatory safety nodes cannot be skipped in tutorial and low difficulty.
- Server validation reconstructs the route graph and verifies touched target IDs.

Failure:
lethal collision, falling behind the collapse plane, entering the singularity volume, leaving navigable bounds, or exhausting recovery resources. A non-lethal scrape can break combo and produce animation without ending the run if the selected difficulty allows it.

## 11. Difficulty and Procedural Course Generation

The world is generated from authored modules, not arbitrary object scatter. A module is a validated gameplay chunk with entry sockets, exit sockets, target graph, hazard volumes, camera hints, lighting anchors, streaming bounds, decorative spawn zones and difficulty metadata.

Module classes:
- onboarding straight;
- wide orbit;
- vertical climb;
- target slalom;
- narrow gate;
- rotating machinery;
- debris field;
- split route;
- recovery bay;
- landmark reveal;
- collapse chase;
- boss-like set piece;
- transition tunnel.

Generation pipeline:
1. Select macro biome and chapter.
2. Build a difficulty envelope from run distance, player consistency and daily challenge rules.
3. Select a compatible module by entry socket, recent module history, target density and memory budget.
4. Apply a seed-derived variant: rotation, mirrored decoration where valid, target type substitutions, hazard timing and pickup arrangement.
5. Validate graph reachability using conservative movement bounds.
6. Validate minimum clearance using player collider plus safety margin.
7. Bake a short look-ahead route quality score.
8. Stream the module and its asset dependencies.
9. Retire modules behind the player and return entities to pools.

Generation must never create an impossible route. Offline validation should simulate thousands of trajectories using a movement envelope, then flag modules and transitions that violate reachability. Daily challenge seeds must be generated and validated server-side before publication.

Adaptive difficulty for standard endless mode may alter future module weights based on skill indicators. It must never change an already visible or loaded route. Ranked daily challenges use fixed difficulty and fixed content.

## 12. Recovery and Fairness Systems

Fairness layers:
- input buffering;
- latch hysteresis;
- coyote release;
- target occlusion rejection;
- limited orbit-plane assistance;
- collision skin width;
- non-lethal scrape tolerance;
- recovery target spawning in non-ranked modes;
- camera target anticipation;
- clear hazard telegraphing.

Emergency recovery:
When the player leaves all valid forward trajectories but has not entered a lethal zone, a recovery well may appear or activate within a constrained cone. It provides reduced score, breaks combo and applies a visible warning state. This is preferable to quietly bending physics. Daily ranked mode may disable recovery or mark the run as assisted.

Failure attribution:
The result screen should classify the cause: late release, early release, collision, missed target, collapse caught, or route bounds. A short replay with trajectory and release marker teaches the player why the run ended.

## 13. Camera Architecture and Cinematography

Camera goals:
- preserve target legibility;
- communicate speed and scale;
- reveal route options before commitment;
- maintain character silhouette;
- reduce motion sickness;
- create authored spectacle without invalidating control.

Physical camera model:
Three.js PerspectiveCamera uses vertical field of view. Use a baseline vertical FOV around 50 to 60 degrees, then animate it modestly with speed. Avoid extreme permanent wide angles because they exaggerate edge speed and distort target judgement. Keep camera near plane as large as practical, for example 0.1 to 0.3 world units depending on character scale, and far plane only as distant as the atmospheric composition requires. A tighter near/far ratio improves depth precision. For vast backgrounds, use layered scenes, fog and impostors rather than an excessively large far plane.

Rig hierarchy:
CameraRoot follows a smoothed player reference.
AimPivot anticipates velocity and next target.
OrbitOffset defines authored framing.
ShakeNode receives bounded procedural and impact impulses.
Camera owns lens/FOV, clipping and exposure hints.

Follow behaviour:
- Position smoothing uses critically damped springs, not simple frame-rate-dependent lerp.
- Aim combines player position, velocity look-ahead and target centre.
- During orbit, the camera shifts outward and slightly above the orbit plane to make curvature readable.
- At release, lead the launch direction and widen FOV briefly.
- At high speed, lower positional lag to avoid the player leaving frame.
- Camera roll should be subtle and derived from orbit angular velocity. Provide a reduced-motion setting that disables roll.
- Occlusion handling casts from focus point to desired camera position, then moves the camera inward with damping. Do not fade the player unless unavoidable.
- Split routes receive a controlled composition that keeps both options visible before the decision point.

Cinematic grammar:
- Wide establishing shots are reserved for countdowns, landmarks and replay cutaways.
- Medium chase framing is the gameplay default.
- Close shots occur only during non-interactive failure beats or slow-motion replay.
- Strong silhouettes use backlight and atmospheric separation.
- Foreground objects may cross frame to create parallax, but cannot obscure active targets.
- Camera shake is event-layered: low-frequency body motion, high-frequency impact, and speed vibration. Each layer has independent amplitude, duration and reduced-motion scaling.
- Motion blur should be avoided in live mobile gameplay unless a tested velocity-buffer implementation is available and stable. Directional speed streaks and particles are cheaper and more controllable.

Depth of field:
- Disable or minimize during normal high-speed play because blur can hide hazards and costs fill rate.
- Enable in title screens, character selection, result screens, photo mode and cinematic replay.
- Gameplay focus target should be the player or currently active gravity well, with slow focus pulls to avoid pumping.
- Use half-resolution or lower blur buffers.
- WebGL path: pmndrs DepthOfFieldEffect.
- WebGPU path: Three.js node-based DoF after visual and compatibility validation.

Exposure and color:
- Use physically coherent scene luminance, then artistic exposure. Do not animate exposure rapidly during traversal.
- Pre-expose bright effects where practical to reduce clipping.
- Use AgX tone mapping when supported by the selected renderer path, with a restrained LUT for the project palette.
- Preserve UI colors outside scene tone mapping.

## 14. Lighting and Realism Strategy

Realism in this project is achieved through consistency rather than path tracing.

Lighting layers:
1. Environment illumination from an HDRI or authored procedural sky, converted to a prefiltered environment map.
2. A dominant directional or area-like key light that establishes world orientation.
3. Baked lightmaps or vertex lighting on large static modules.
4. Local emissive fixtures and selective real lights near gameplay.
5. Contact grounding through ambient occlusion, decals and small shadow receivers.
6. Atmospheric depth through height fog, distance fog and localized volumes.

Physically based materials:
- Use metalness/roughness workflow.
- Base color contains no baked lighting.
- Roughness carries most of the realism. Avoid uniform values.
- Metallic surfaces use metalness near one only where physically appropriate.
- Normal maps describe mid-frequency detail; geometry or baked normals handle silhouette and large bevels.
- Add small bevels to hard-surface assets. Perfectly sharp edges are a major source of synthetic-looking renders.
- Use clearcoat selectively on coated parts, not as a universal “premium” switch.
- Use transmission sparingly; transparent layered effects are expensive and sorting-sensitive.
- Emissive textures should have plausible source shapes and be paired with bloom thresholds rather than making entire surfaces glow.

Shadows:
- Desktop: one high-value shadowed key light, tightly fitted to the active gameplay volume. Consider cascaded shadow maps only after testing because they add draw calls and memory.
- Mobile: single 1024 or 1536 shadow map, reduced update frequency, or baked/static shadows plus dynamic character blob/contact shadow.
- Softness comes from light size approximation, PCF variants, contact shadow cues and baked penumbra.
- Dynamic debris usually does not cast shadows on mobile.
- Shadow camera bounds follow a smoothed region around the player to reduce shimmering.
- Use stable texel snapping when implementing cascades.

Mimicking ray tracing:
- Reflection probes or PMREM environment maps for glossy response.
- Local box-projected cubemaps for major interior or enclosed modules if justified.
- Screen-space ambient occlusion or GTAO for contact depth.
- Screen-space reflections only on high tiers and only for selected surfaces; provide probe fallback.
- Baked global illumination and emissive contribution in lightmaps.
- Light probes or spherical harmonics for moving character fill.
- Planar reflection render targets only for rare hero surfaces and at reduced resolution.
- WebGPU SSGI can be explored for cinematic tier, but it must not be required for the art direction.

Atmosphere:
- Use exponential or height-based fog to compress distant geometry.
- Represent distant megastructures as simplified silhouettes with baked lighting.
- Full volumetric ray marching is high-end only. Mobile uses layered fog cards, soft particles and analytic light cones.
- Atmospheric particles should use instancing and depth-aware fading.

## 15. Rendering Pipeline

WebGL2 baseline frame:
1. Update fixed-step simulation.
2. Interpolate render transforms.
3. Update animation mixers and procedural secondary motion.
4. Perform visibility, LOD and streaming decisions.
5. Update shadow region when necessary.
6. Render opaque depth and color through RenderPass.
7. Render transparent gameplay effects in controlled order.
8. Optional AO at reduced resolution.
9. Selective bloom.
10. Optional DoF in non-gameplay or cinematic state.
11. Color grading/tone mapping.
12. SMAA or selected antialiasing pass if MSAA is disabled.
13. Vignette/noise at very low intensity.
14. Composite UI separately.

Post-processing policy:
- Keep the chain short.
- Combine effects where the library permits.
- Avoid full-resolution intermediate buffers when half-resolution is visually adequate.
- Bloom is selective and thresholded. Only gravity cores, trails, singularity energy and specific signage enter the bloom mask.
- Chromatic aberration is a short event impulse at extreme speed or failure, never a permanent filter.
- Film grain is subtle and disabled on low mobile tiers.
- Vignette is restrained and may increase briefly during danger.
- Lens distortion should not be used in standard gameplay unless target hit testing is screen-space corrected.

WebGPU experimental frame:
- Use Three.js WebGPURenderer and TSL node materials.
- Use the renderer's node post-processing stack rather than EffectComposer.
- Port custom materials from ShaderMaterial/onBeforeCompile to TSL.
- Maintain reference screenshots and feature-parity tests against WebGL2.
- Allow forceWebGL for diagnostics and fallback.

## 16. Character Asset Specification

Initial playable character: The Courier.

Source asset:
- Blender master file in meters.
- Neutral A-pose or T-pose source rig.
- Game rig with approximately 55 to 75 deform bones.
- Separate helper bones for tether hand, backpack antenna, cloth tabs and trail anchors.
- Root bone at world origin; forward convention documented and enforced.
- One material atlas for body and clothing where possible, plus optional face/visor material.
- Desktop hero LOD0: approximately 45k to 70k triangles.
- LOD1: 22k to 35k.
- LOD2: 8k to 15k.
- Mobile distant LOD3 or impostor: 2k to 5k if the player can become very small.
- Collider is not derived from the render mesh.

Character textures:
- Base color: 2048 x 2048 desktop, 1024 mobile.
- Normal: 2048 UASTC KTX2 for important hard-surface and fabric detail.
- ORM packed map: occlusion in R, roughness in G, metalness in B; 1024 or 2048.
- Emissive mask: 512 to 1024.
- Optional detail normal tile: 256 or 512, shared.
- No 4K texture in the initial browser build unless a measured close-up requires it.

Animation set:
- idle menu loop;
- countdown ready;
- free-flight neutral;
- free-flight left/right banking;
- latch anticipation;
- tether reach left/right;
- orbit compression;
- orbit extension;
- release kick;
- perfect release accent;
- near-miss flinch;
- light scrape;
- heavy impact;
- fall/tumble;
- singularity pull;
- victory/result pose;
- cosmetic emotes.

Animation implementation:
- Root motion disabled for gameplay traversal.
- Gameplay controller drives world transform.
- Animation graph blends by state, signed orbit angular velocity, acceleration, vertical velocity and impact.
- Use additive layers for look direction, hand reach, recoil and breathing.
- Two-bone IK or CCD IK aligns tether hand to the dynamic tether anchor.
- Spring bones or lightweight procedural bones animate straps and antennae. On low tiers use baked animation or fewer solvers.
- Export clips in glTF with resampling and key reduction. Validate looping seams.

## 17. Gravity Well Asset Family

Gravity wells are the most important environmental assets and require a complete visual language.

Shared construction:
- collision core;
- latch transform;
- orbit clearance volume;
- emissive energy core;
- outer mechanical frame;
- rotating ring components;
- tether connection marker;
- target reticle anchor;
- particle emitters;
- audio emitter;
- LOD group;
- optional destruction state.

Classes:
A. Standard Well: neutral blue, predictable radius.
B. Accelerator: orange, increases release impulse and risk.
C. Precision Well: small core, narrow perfect window.
D. Heavy Well: large radius, slow orbit, strong redirection.
E. Unstable Well: fluctuating but telegraphed radius.
F. Polarity Well: changes orbit direction or plane.
G. Moving Well: travels on an authored spline.
H. Collapse Well: deteriorates after contact.
I. Recovery Well: desaturated green/white, reduced score.
J. Landmark Well: unique hero asset for set pieces.

Geometry budgets:
- Hero LOD0: 15k to 30k triangles.
- Gameplay LOD1: 5k to 12k.
- Distant LOD2: 500 to 2k plus billboard energy.
- Repeated frames should use GPU instancing.
- Rotating rings share geometry and material atlases.

Textures:
- 1024 shared trim sheet for metal frame.
- 512 shared normal/ORM.
- 256 to 512 emissive masks.
- Energy core uses procedural shader/noise textures, not large flipbooks.
- Decals and markings use an atlas.

Shader:
- Fresnel edge response.
- Animated radial distortion.
- Noise-driven emissive pulse.
- Depth-faded particles.
- Event parameters for preview, selected, latched, perfect window, danger and cooldown.
- Mobile shader removes expensive distortion and uses layered emissive meshes.

## 18. Environment Biomes and Complete Asset Catalogue

Initial biome: The Shattered Vertical City.

Macro assets:
- distant broken city silhouette clusters;
- suspended tower segments;
- collapsed transit bridges;
- floating industrial platforms;
- orbital machinery;
- singularity horizon;
- sky dome or procedural sky;
- atmospheric cloud/fog layers;
- distant debris fields;
- hero landmark structures.

Modular structural kit:
- straight platform 10 m, 20 m, 40 m;
- curved platform sections;
- vertical wall fragments;
- tower facade modules;
- bridge trusses;
- support beams;
- broken floor slabs;
- tunnel shells;
- arch gates;
- maintenance rings;
- suspended signs;
- pipe bundles;
- cable bundles;
- vent and fan modules;
- antenna arrays;
- window/emissive facade cards;
- damaged edge caps;
- rubble clusters;
- interior maintenance corridor set;
- exterior rooftop set.

Gameplay hazard assets:
- rotating blades;
- piston gates;
- laser or energy barriers;
- moving crane arms;
- collapsing slabs;
- swinging cables;
- debris bursts;
- turbine tunnels;
- magnetic mines;
- singularity tendrils;
- closing aperture rings;
- rotating target shields;
- moving cargo containers;
- unstable gravity fragments.

Decorative props:
- crates;
- ducts;
- conduits;
- warning beacons;
- railings;
- ladders;
- panels;
- screens;
- signs;
- broken vehicles or drones;
- cloth banners;
- loose cables;
- maintenance bots;
- small rubble;
- sparks and steam emitters.

Every module must use a limited palette of shared trim sheets and tileable surfaces. Unique textures are reserved for landmarks and gameplay-critical objects.

## 19. Texture Library Specification

Core tileables:
1. painted industrial metal;
2. bare brushed metal;
3. rough dark alloy;
4. concrete composite;
5. weathered polymer;
6. rubberized grip;
7. carbon-like technical weave;
8. glass dirt/roughness;
9. dust and soot;
10. exposed internal machinery.

Trim sheets:
- city architectural trim, 2048 desktop / 1024 mobile;
- machinery trim, 2048 / 1024;
- signage and warning trim, 1024;
- character hard-surface trim, 1024;
- cable/pipe strip atlas, 512 or 1024.

Decal atlases:
- numbers and identifiers;
- caution lines;
- scratches;
- leaks;
- impact marks;
- grime edges;
- holographic signage;
- faction markings;
- repair patches.

VFX textures:
- soft particle disc;
- spark streak;
- smoke noise;
- electric arc strip;
- distortion normal;
- radial energy gradient;
- star/glint sprite;
- debris dust;
- fog card noise;
- tether pulse profile.

Texture rules:
- Color maps use sRGB.
- Normal, roughness, metalness, AO, masks and data textures use linear/no-color space.
- Pack ORM channels.
- Use KTX2/Basis Universal for runtime delivery.
- Use UASTC for normal maps and high-quality masks; ETC1S for many color textures where artefacts are acceptable.
- Generate mipmaps.
- Keep alpha only where required.
- Avoid large transparent textures with mostly empty pixels.
- Set anisotropy according to tier and camera angle need.
- Use texel-density targets: approximately 256 px/m for hero close-up assets, 128 px/m for gameplay structures, 32 to 64 px/m for distant structures.
- Inspect compression artefacts under final tone mapping, not only in the texture viewer.

## 20. VFX and Particle Architecture

VFX systems:
- tether beam;
- latch burst;
- orbit trail;
- perfect release flash;
- speed streaks;
- gravity core particles;
- target preview pulse;
- near-miss wake;
- impact sparks;
- debris;
- dust;
- fog motes;
- singularity accretion;
- collapse wave;
- pickup fragments;
- combo escalation aura;
- failure disintegration.

Implementation:
- GPU instanced particles for repeated sprites and meshes.
- Fixed-capacity pools with ring-buffer allocation.
- Particle simulation may run in shader for high tiers; CPU update is acceptable for small mobile pools.
- Effects receive semantic events from gameplay, not direct input polling.
- Each effect has tier-specific budgets and an importance value.
- Critical feedback, such as latch confirmation, cannot be culled.
- Decorative effects are culled by distance, screen size, occlusion and GPU time.
- Transparent particle overdraw is a major mobile risk. Use small quads, soft depth intersection, limited layering and low-resolution buffers where possible.

Tether visual:
- Use a camera-facing ribbon or tube with 8 to 16 segments.
- Simulate secondary sag and vibration visually using a damped chain between player hand and well.
- Core line is emissive; outer halo may be rendered through bloom rather than multiple transparent shells.
- Color conveys target class and release state.
- The tether must remain visible against bright and dark backgrounds through luminance-aware intensity or a restrained dark outline.

## 21. Audio Architecture

Audio layers:
- adaptive music stems;
- continuous wind/speed bed;
- gravity well hum;
- target preview cue;
- latch transient;
- orbit tension loop;
- perfect window cue;
- release transient;
- combo escalation;
- near-miss pass-by;
- collision;
- collapse threat;
- pickups;
- UI;
- character effort;
- failure/result.

Adaptive music:
- Base rhythm starts immediately.
- Additional percussion, bass and harmonic stems enter at combo thresholds.
- Intensity follows sustained performance, not every single score event.
- Failure transitions to a short resolved sting without waiting for a full bar if the run is brief.
- Daily challenge can use a fixed arrangement for comparable rhythm cues.

Spatial audio:
- Gravity wells and hazards are positional.
- High-speed pass-by uses pitch and gain automation, not expensive full Doppler on every emitter.
- Limit simultaneous voices through priority and virtualization.
- iOS audio context resumes only after user gesture.
- Compress source audio to Opus where supported, with AAC fallback if deployment testing requires it.
- Preload only the core UI and movement cues. Stream music and biome ambience after interaction.

## 22. UI, HUD and Onboarding

HUD:
- distance and score;
- best score;
- combo and release grade;
- active target reticle;
- collapse proximity warning;
- optional trajectory assistance;
- pause;
- accessibility indicators;
- daily attempt count.

UI is DOM-based for accessibility, localization and crisp scaling. World-space target markers use Three.js sprites or instanced quads but are driven by gameplay data.

Tutorial:
1. Launch into a protected straight corridor.
2. Show one obvious well.
3. Player presses and holds.
4. Camera exaggerates orbit readability.
5. A release zone is visualized.
6. Player releases into a wide safety catcher.
7. Repeat with two wells.
8. Introduce a perfect window.
9. Introduce one optional risky route.
10. End with a short scored run.

The tutorial must teach by interaction, not paragraphs. It adapts after repeated failure by slowing collapse, widening valid timing, and adding trajectory preview. These assists are transparent.

Menus:
title, play, daily challenge, character, cosmetics, settings, accessibility, credits, privacy, account, leaderboard and replay viewer.

## 23. Accessibility and Input

Input mappings:
- Mouse: hold primary button.
- Keyboard: hold Space, Enter or configurable key.
- Touch: hold anywhere in an exclusion-safe gameplay region.
- Gamepad: hold primary face button or trigger.
- Optional haptic vibration on supported devices.

Accessibility:
- remappable controls;
- left-handed UI;
- reduced camera motion;
- disable camera roll;
- reduced flashes;
- reduced particle density;
- high-contrast target outlines;
- color-blind-safe target shapes in addition to colors;
- subtitle/caption support for voiced content;
- separate music, effects and ambience volume;
- trajectory assistance;
- widened latch cone and release window;
- 30 FPS compatibility mode;
- text scaling;
- screen-reader-compatible menus.

Ranked policy:
Assists that change acquisition or timing create an assisted category rather than excluding players entirely. Pure presentation assists do not affect ranking.

## 24. Networking, Accounts and Leaderboards

The core run is client-side and requires no continuous multiplayer connection.

Server endpoints:
- issue daily challenge manifest and signed seed;
- submit run summary and replay input stream;
- validate replay;
- return leaderboard slice;
- manage profile and cosmetic inventory;
- sync settings and unlocked content;
- publish remote configuration and minimum supported version.

Replay payload:
game version, physics config hash, seed, course manifest hash, quality-independent input events by tick, selected assists, touched target IDs, checkpoint state hashes and final score summary.

Validation:
- Server reconstructs the course and runs the deterministic simulation.
- Checkpoint hashes detect divergence.
- Scores are computed server-side.
- Impossible input rates, version mismatches and excessive divergence reject the run.
- Visual quality and frame rate are not part of the replay.
- Dynamic decorative debris never influences ranked collision.

Leaderboards:
daily global, country, friends, assisted, all-time distance and seasonal events. Use pagination and anti-scraping limits. Do not expose sensitive profile data.

## 25. Asset Streaming and Loading

Loading groups:
A. Shell: HTML, CSS, minimal JS, logo, loading screen.
B. Core game: player LOD1, standard well, tutorial module, core audio, baseline shaders.
C. First biome: near modules, shared textures, hazards.
D. Enhanced: player LOD0, higher texture mips, cinematic post effects.
E. Cosmetics and future biomes.

Strategies:
- hashed immutable CDN assets;
- HTTP/2 or HTTP/3 delivery;
- service worker caches shell and core package;
- manifest-based dependency resolution;
- AbortController cancels obsolete streams;
- decode compressed meshes and KTX2 textures in workers where supported;
- cap decoder worker count on mobile;
- prefetch the next two to four modules based on memory tier;
- retain shared materials and texture atlases across modules;
- dispose retired unique GPU resources deterministically.

Initial transfer budgets:
- shell plus executable JS: target under 500 to 800 KB compressed for the game route, excluding WASM decoders;
- core playable assets: target 3 to 6 MB compressed;
- first biome incremental package: 8 to 15 MB streamed;
- no single non-landmark runtime asset over roughly 2 MB without review;
- mobile texture residency target approximately 128 to 256 MB depending on detected device;
- desktop balanced residency target approximately 512 MB, with a hard configured cap.

These are production targets, not guarantees. CI reports actual bundle and asset sizes and fails on unapproved regression.

## 26. Mobile Performance Engineering

Frame budgets:
60 FPS: 16.67 ms total.
45 FPS: 22.22 ms.
30 FPS: 33.33 ms.

Target at 60 FPS desktop balanced:
- simulation and game logic: 1.5 ms;
- animation: 1.5 ms;
- visibility/streaming work: 1.0 ms average;
- CPU render submission: 3.0 ms;
- GPU opaque/transparency: 5.0 ms;
- post processing: 3.0 ms;
- safety margin: 1.67 ms.

Mobile balanced should avoid saturating the GPU continuously. Sustainable thermal performance matters more than a brief benchmark.

Techniques:
- dynamic resolution based on rolling GPU or total frame time;
- cap device pixel ratio, typically 1.0 to 1.5 depending on tier;
- instancing for repeated props, wells, debris and particles;
- merged static geometry per module where it does not break culling;
- LOD and hysteresis;
- frustum culling plus module-level occlusion strategy;
- baked lightmaps and shared probes;
- texture atlases and KTX2;
- meshopt-compressed and quantized glTF;
- pooled entities;
- no per-frame allocations in simulation and rendering hot paths;
- typed arrays for particle and replay data;
- update distant animation and effects at lower frequency;
- shadow updates throttled or event-driven;
- half/quarter-resolution post effects;
- avoid excessive transparent layers;
- avoid many small materials and shader variants;
- precompile critical shaders during loading;
- use requestIdleCallback only for non-critical preparation and always provide a fallback;
- lower active audio voice count on mobile;
- pause or reduce to a few FPS when hidden.

Adaptive quality controller:
- Maintain exponential moving averages of frame time.
- Use separate thresholds for downgrade and upgrade.
- Downgrade one expensive feature at a time: render scale, particles, AO, shadows, volumetrics, reflections, DoF.
- Never change collision, module generation or input sampling.
- Persist a safe tier per device, but rebenchmark after major version changes.

## 27. Asset Optimization Pipeline

Source:
- Blender files remain high quality and non-destructive.
- Apply naming, transforms, material assignment and LOD collections through validation scripts.
- Use meters and a single axis convention.

Export:
- glTF/GLB.
- Preserve named sockets and gameplay anchors.
- Export tangents only where required by normal mapping.
- Remove hidden source meshes, unused bones and unused materials.
- Separate static module collision into simplified meshes.

Optimization:
1. Validate source scene.
2. Export GLB.
3. Run glTF Validator.
4. Use gltfpack/meshoptimizer to optimize vertex cache, quantize data, merge safe meshes, simplify LODs and compress.
5. Preserve named gameplay nodes with appropriate gltfpack options.
6. Convert textures to KTX2.
7. Generate manifest with hashes, dependencies, bounds, LOD metrics and memory estimates.
8. Render automated turntables and in-game reference shots.
9. Compare against approved baselines.
10. Publish to content-addressed storage.

Meshopt versus Draco:
- Meshopt is preferred for the main pipeline because gltfpack can optimize GPU layout, quantize, merge, simplify and use EXT_meshopt_compression. Three.js supports the decoder through GLTFLoader.
- Draco remains supported for third-party assets and may achieve strong geometry compression, but it adds decode cost and does not itself optimize the complete scene.
- Select based on measured total transfer, decode time, memory and render performance rather than file size alone.

Texture compression:
- KTX2/Basis Universal reduces transfer size and allows runtime transcoding to GPU-native compressed formats. Three.js KTX2Loader detects renderer support before loading.
- ETC1S for compact albedo and many masks.
- UASTC for normal maps, detailed UI-like decals and assets sensitive to block artefacts.

## 28. Collision and Physics Asset Rules

Collider types:
- primitive boxes, spheres and capsules where possible;
- convex hulls for irregular props;
- simplified static triangle meshes for large architecture;
- no render-mesh collision;
- no thin single-sided collision surfaces;
- moving hazards use simple analytic colliders.

Naming:
COL_STATIC_*
COL_HAZARD_*
COL_OCCLUSION_*
TRG_PICKUP_*
TRG_NEARMISS_*
SOCKET_ENTRY_*
SOCKET_EXIT_*
ANCHOR_WELL_*
ANCHOR_CAMERA_*

Collision layers:
player, static, hazard, gravity-well body, pickup, near-miss, debris, occlusion-only, camera and trigger.

Ranked dynamic bodies:
No uncontrolled dynamic body may alter the player path. Moving hazards are kinematic and seeded. Decorative rigid bodies either have no player collision or are client-only.

## 29. Animation and Secondary Motion Pipeline

Animation quality depends on readable force transfer:
- shoulders lead tether reach;
- torso compresses toward gravity centre;
- legs trail under acceleration;
- release extends through hips and feet;
- head and chest anticipate next target;
- impact propagates through the body.

Procedural layers:
- aim and look-at;
- tether-hand IK;
- body lean from acceleration;
- banking from signed orbit speed;
- velocity-aligned foot and cloth drag;
- camera-relative silhouette correction;
- additive hit reactions.

Use animation curves for effect events such as hand grip, tether flash, foot kick and impact sparks. Do not rely on arbitrary frame numbers in code.

Animation LOD:
- full graph and IK near camera;
- reduced IK and secondary motion on mobile;
- lower update rate for remote ghosts;
- baked simplified clips for distant/menu previews.

## 30. Testing and Rigorous Validation

Unit tests:
- orbit basis construction;
- tangent release;
- target scoring;
- hysteresis;
- release grading;
- combo rules;
- PRNG stability;
- procedural graph reachability;
- replay serialization;
- quality-tier selection.

Simulation tests:
- fixed replay fixtures produce expected checkpoint hashes;
- high-speed swept collision does not tunnel;
- identical input under 30, 60 and 144 Hz rendering gives the same simulation result;
- pause/resume does not advance ranked state;
- seeded moving hazards reproduce.

Asset tests:
- glTF Validator passes;
- textures have correct color space and dimensions;
- triangle, material, bone and texture budgets;
- all named anchors exist;
- collision is watertight enough for intended use;
- LODs preserve silhouette;
- no missing mipmaps;
- KTX2 transcodes on test devices.

Visual tests:
- approved screenshots for representative modules and tiers;
- target visibility against bright and dark scenes;
- bloom clipping;
- shadow acne/peter-panning;
- fog readability;
- DoF focus;
- camera occlusion;
- ultrawide and portrait mobile layouts.

Performance tests:
- low, mid and high device matrix;
- cold and warm load;
- sustained 15 to 30 minute thermal run;
- memory after repeated restarts;
- tab background/restore;
- network throttling;
- decoder worker contention;
- worst-case particles and transparent overdraw.

Gameplay QA:
- impossible modules;
- unfair blind targets;
- camera-induced misses;
- recovery exploits;
- score farming;
- target selection flicker;
- touch occlusion;
- daily seed validation.

CI gates:
typecheck, lint, unit tests, deterministic replay tests, asset validation, bundle budget, screenshot regression and build.

## 31. Security and Anti-Cheat

- Treat all client scores as untrusted.
- Validate daily challenge runs server-side.
- Sign challenge manifests and include expiry/version.
- Rate-limit submissions.
- Store replay hashes and anomaly metrics.
- Reject unknown physics hashes.
- Do not ship server secrets or administrative endpoints in the client.
- Use Content Security Policy and dependency auditing.
- Sanitize display names and user-generated text.
- Apply privacy minimization to analytics.
- Cosmetic inventory changes are server-authoritative.

## 32. Production Roadmap

Phase 0, movement laboratory:
- empty scene;
- one player capsule;
- one gravity well;
- orbit/release;
- deterministic fixed step;
- debug trajectory;
- immediate restart.

Exit criterion: movement is enjoyable for ten consecutive minutes without progression or art.

Phase 1, graybox vertical slice:
- 10 authored modules;
- targeting;
- collision;
- scoring;
- combo;
- basic camera;
- seeded generation;
- one failure sequence;
- desktop and mobile input.

Phase 2, visual target:
- hero character;
- three gravity well classes;
- first biome kit;
- final lighting model;
- baseline post stack;
- audio identity;
- quality tiers.

Phase 3, content-complete MVP:
- tutorial;
- daily challenge;
- replay;
- leaderboard;
- cosmetics;
- accessibility;
- PWA caching;
- performance matrix.

Phase 4, polish and validation:
- animation polish;
- visual regression;
- anti-cheat;
- thermal testing;
- device compatibility;
- analytics;
- store and progression tuning.

Phase 5, WebGPU cinematic path:
- renderer adapter parity;
- TSL material migration;
- node post processing;
- optional SSGI/advanced DoF;
- photo mode and enhanced replays.

Do not begin account systems, cosmetic store breadth or a second biome before Phase 1 movement and route generation meet the exit criteria.

## 33. Initial Production Asset Checklist

Required for first playable:
- Courier graybox and final character.
- Character rig and 16 core clips.
- Standard, accelerator and precision wells with three LODs.
- Tether visual and five critical VFX.
- Ten graybox modules, then ten final modules.
- Structural trim sheet and machinery trim sheet.
- Six tileable materials.
- One decal atlas.
- One VFX atlas.
- Twelve hazard assets.
- Twenty decorative prop assets.
- Distant skyline kit.
- Singularity sky/background system.
- One HDRI or procedural environment setup.
- Core UI icon set.
- Logo lockup.
- Core sound pack.
- One adaptive music set.
- Collision meshes and sockets for every module.
- LODs and KTX2 textures for all runtime assets.
- Benchmark scene containing worst-case materials, particles, hazards and post effects.

Required before public MVP:
- 30 to 50 validated modules.
- At least five well classes.
- Three character cosmetic sets.
- Complete failure/result animations.
- Daily challenge UI.
- Leaderboard UI.
- Replay camera assets and presets.
- Accessibility visual variants.
- Mobile-specific texture and LOD manifests.

## 34. Key Technical Decisions

1. WebGL2 is the stable production baseline; WebGPU is an enhanced, feature-flagged path.
2. The player uses a custom deterministic orbital controller.
3. Rapier supplies collision queries and environmental physics, not the feel of orbit motion.
4. Levels are assembled from authored, validated modules.
5. glTF/GLB with meshopt optimization and KTX2 textures is the runtime asset standard.
6. Realism is produced by PBR discipline, bevels, roughness variation, coherent lighting, baked GI, probes, AO, atmosphere, restrained post processing and strong animation.
7. Live gameplay depth of field is limited; cinematics and menus receive the strongest lens effects.
8. The simulation remains fixed at 60 Hz across device tiers.
9. Visual quality changes dynamically, gameplay does not.
10. Ranked scores are replay-validated server-side.

## 35. Research Validation and Sources

[S1] Three.js WebGPURenderer manual and API documentation. Confirms WebGPU-first with WebGL2 fallback, TSL/node materials, node post-processing, migration limitations, and experimental status.
[S2] Three.js KTX2Loader documentation. Confirms KTX2/Basis Universal transcoding and renderer capability detection.
[S3] Three.js DRACOLoader documentation. Confirms significant geometry compression with client decode cost and glTF integration.
[S4] pmndrs postprocessing documentation. Confirms EffectComposer workflow and available WebGL effects.
[S5] pmndrs DepthOfFieldEffect documentation. Confirms focus target, focus distance/range, bokeh scale and reduced resolution controls.
[S6] Rapier JavaScript documentation. Used for collider, query and rigid-body architecture.
[S7] Khronos glTF and KTX documentation. Confirms KTX2/Basis Universal as a GPU texture delivery route that reduces download and GPU memory pressure.
[S8] meshoptimizer and gltfpack documentation. Confirms cache optimization, quantization, simplification, scene pruning, EXT_meshopt_compression, instancing and KTX2 conversion options.
[S9] MDN and browser capability documentation for WebGPU/WebGL/PWA compatibility checks. Final supported-browser matrix must be generated by automated device testing at release time rather than frozen in this document.

Implementation teams must pin exact package versions in the lockfile and review release notes before upgrading. The architectural recommendations are deliberately based on capabilities and constraints rather than assuming that an experimental renderer or individual post effect will remain API-compatible.
