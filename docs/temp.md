Creating comprehensive Gravity Run architecture document
bash -lc mkdir -p /mnt/data/gravity-run-architecture/docs && cat > /mnt/data/gravity-run-architecture/docs/GRAVITY_RUN_GAME_ARCHITECTURE.md <<'EOF'
# GRAVITY RUN
## Complete Game Architecture, Gameplay Mathematics, Rendering, Cinematography, Asset Production and Mobile Performance Specification

**Document version:** 1.1  
**Date:** 3 August 2026  
**Prepared for:** Michael Ndhlovu  
**Repository:** `MikeyNu/gravity-run`  
**Status:** Production architecture baseline

---

## 0. Document Authority and Decision Language

This document is the authoritative product and engineering specification for Gravity Run. It defines the intended game, the simulation contract, the rendering strategy, the complete initial asset inventory, the content pipeline, the mobile quality ladder, the backend responsibilities, and the validation gates required before release.

The terms below are deliberate:

- **MUST** identifies a release-critical requirement.
- **MUST NOT** identifies a prohibited implementation or content decision.
- **SHOULD** identifies the preferred implementation unless profiling or testing proves a better approach.
- **MAY** identifies an optional capability.
- **Starting value** identifies a parameter that is not universal and must be tuned through playtesting.
- **Normative equation** identifies gameplay mathematics that must remain consistent across clients, replays, and server validation.

The current repository contains documentation rather than a playable implementation. This revision therefore defines the implementation baseline and supersedes informal assumptions in earlier concept material.

---

## 1. Executive Product Definition

Gravity Run is a high-speed, one-input, third-person 3D traversal game for the web. The player moves continuously through a collapsing science-fiction city suspended around a singularity. The primary action is to acquire a gravity well, attach an energy tether, convert linear momentum into controlled orbital motion, and release along a tangent toward the next route opportunity.

The game is not an endless runner with a grappling hook attached to it. Its identity comes from four linked systems:

1. **Target judgement:** selecting the correct gravity well while the environment moves rapidly through frame.
2. **Orbital timing:** understanding when the player has accumulated a useful release direction and speed.
3. **Route risk:** choosing between safe, fast, narrow, and optional paths.
4. **Flow preservation:** chaining accurate releases without losing momentum or combo.

The game must be understandable within one tutorial minute, restart in under one second after a failure decision, and support mastery over hundreds of attempts. Cosmetic progression can create long-term motivation, but player skill must remain the primary determinant of score.

### 1.1 Intended emotional cycle

Each run should repeatedly create this sequence:

1. **Recognition:** the player sees a valid target.
2. **Commitment:** the tether connects and motion begins to curve.
3. **Compression:** risk increases while the player waits for a better tangent.
4. **Release:** the player lets go.
5. **Verification:** the trajectory either resolves cleanly or exposes an error.
6. **Reward:** audio, camera, trail, score, and world response confirm mastery.
7. **Escalation:** the next decision arrives before the reward has fully decayed.

The game becomes compelling when this loop feels fair, fast, readable, and physically coherent.

### 1.2 Product pillars

- One primary input with multiple physical consequences.
- Immediate retries with no mandatory menu interruption.
- Predictable, learnable physics rather than random rescue behaviour.
- Cinematic spectacle that never blocks gameplay information.
- Deterministic ranked challenges and reproducible ghosts.
- Lightweight delivery and aggressive quality scaling for mobile browsers.
- Realism through coherent scale, lighting, material response, animation, atmosphere, and camera behaviour rather than indiscriminate post-processing.
- Cosmetic progression only. No paid or earned statistical advantage.

### 1.3 Non-goals for the first release

The first release does not require:

- synchronous multiplayer;
- a large open world;
- free-form walking or combat;
- a physics-simulated rope;
- path-traced live gameplay;
- a broad cosmetic marketplace;
- more than one complete biome;
- narrative cutscenes longer than short replay and landmark beats.

---

## 2. Core Game Loop and Session Structure

### 2.1 Moment-to-moment loop

1. The player enters free flight with forward momentum.
2. The targeting system evaluates visible and reachable gravity wells.
3. The best candidate receives a stable preview reticle.
4. Pressing or touching attaches to the selected well when valid.
5. Holding sustains orbit and applies a bounded acceleration profile.
6. The release-quality indicator progresses as the tangent aligns with viable routes.
7. Releasing detaches and preserves authoritative release velocity.
8. The player passes gates, collects fragments, performs near misses, or skips optional wells.
9. The route generator streams the next authored module.
10. Failure produces an attributed result and an immediate restart path.

### 2.2 Run types

#### Standard Endless

- Procedurally assembled from validated authored modules.
- Adaptive module weighting may respond to recent player consistency.
- Recovery wells may appear when a route remains salvageable.
- Global, friends, and personal leaderboards.

#### Daily Challenge

- One signed seed and one versioned configuration for all players.
- Three official score attempts per day.
- Practice attempts remain available but do not replace the locked official result.
- No dynamic difficulty changes after the seed is issued.
- Server-side replay validation is mandatory.

#### Tutorial

- Authored sequence, not procedural.
- Teaches target preview, latch, orbit, release, perfect timing, and route choice.
- Uses stronger trajectory visualization and wider timing windows.
- Must be playable from cache after first successful load.

#### Practice Laboratory

- Selectable well arrangements and speed presets.
- No leaderboard submission.
- Exposes trajectory, velocity, orbit radius, phase, and release error overlays.

#### Replay and Photo Mode

- Available after a run.
- Can enable higher rendering quality because gameplay input is no longer active.
- Photo mode may use experimental path tracing only as a nonessential high-end feature.

### 2.3 Session loop

- Start game.
- Complete or skip tutorial after competency has been demonstrated.
- Play a run.
- Review score, failure cause, and short replay.
- Restart instantly or inspect progression.
- Unlock visual rewards through fragments, milestones, and daily objectives.
- Share an exact challenge seed or replay clip.

---

## 3. Platform Contract and Supported Experience

### 3.1 Primary targets

- Current stable desktop Chrome and Edge.
- Current stable desktop Firefox and Safari.
- Android Chrome on representative mid-range and flagship devices.
- iOS Safari on currently supported iOS versions.
- Installable Progressive Web App shell.

Actual browser support must be determined by automated compatibility testing at release. The project must not claim support based only on API availability.

### 3.2 Mobile orientation

The first playable mobile version SHOULD require landscape orientation during active gameplay. Menus may support portrait orientation. Landscape is recommended because:

- route choices need horizontal visual space;
- a stable minimum horizontal field of view is essential for target judgement;
- thumb input must not cover the active route;
- UI density is lower and safer;
- cross-platform camera tuning becomes materially easier.

A portrait gameplay mode MAY be developed later with a separate camera and route-composition profile. It must not simply reuse the landscape camera.

### 3.3 Renderer policy

The production baseline MUST use `WebGLRenderer` initially. Three.js now requires WebGL 2 for this renderer. The reasons are ecosystem maturity, broad browser coverage, predictable post-processing integration, and easier mobile validation.

A `WebGPURenderer` path SHOULD exist behind a feature flag. It is useful for node materials, TSL, modern post-processing, compute workloads, and high-end effects. It MUST NOT be the only shipping renderer until the complete game feature matrix is validated because Three.js still describes it as experimental and its material and post-processing workflow differs materially from the traditional WebGL path.

Simulation, scoring, procedural generation, and replay code MUST NOT depend on renderer choice.

### 3.4 Graceful degradation principle

Low-quality mode is an authored visual version, not a collection of broken effects. Each quality tier needs deliberate lighting, fog, texture, particle, and shadow choices. Removing an effect must expose a designed fallback.

---

## 4. Quality Tiers and Runtime Capability Selection

### 4.1 Tier definitions

| Tier | Intended hardware | Frame target | Key rendering features |
|---|---|---:|---|
| 0 Compatibility | Weak mobile, software-constrained, thermal fallback | 30 FPS | WebGL2, low render scale, no gameplay DoF, no SSR/SSGI, baked lighting, blob/contact shadow, minimal particles |
| 1 Mobile Balanced | Modern mid-range mobile | 45 or 60 FPS | Dynamic resolution, selective bloom, compact AO if stable, one fitted dynamic shadow, KTX2 textures, reduced animation solvers |
| 2 Desktop Balanced | Typical discrete or strong integrated GPU | 60 FPS | HDR post chain, improved shadows, selective AO, reflection probes, menu/replay DoF, denser particles |
| 3 Cinematic | High-end desktop or noninteractive replay | 60 FPS gameplay or 30/60 replay | WebGPU where validated, richer volumetrics, optional SSR/SSGI, velocity motion blur, enhanced DoF, denser geometry and particles |

### 4.2 Startup benchmark

Capability selection MUST combine feature detection with a representative benchmark. Device names and GPU strings are not sufficient.

The benchmark should render for approximately 1.5 to 2.5 seconds and include:

- representative opaque PBR geometry;
- one skinned character;
- one shadow map;
- alpha-blended particles;
- the intended post-processing chain;
- a KTX2 texture sample;
- a small Rapier query workload;
- shader compilation and pipeline warm-up.

The benchmark records:

- median CPU frame time;
- median GPU frame time where timer queries are available;
- 95th-percentile frame time;
- shader compilation stalls;
- estimated memory pressure;
- supported compressed texture targets;
- WebGPU and required extension availability.

### 4.3 Runtime adaptation

Quality downgrade order:

1. Lower internal render scale.
2. Reduce particles and transparent overdraw.
3. Lower AO resolution or disable AO.
4. Reduce shadow resolution and update frequency.
5. Disable volumetric ray marching.
6. Disable SSR/SSGI.
7. Disable gameplay motion blur and DoF.
8. Reduce visible debris and distant LOD residency.

Gameplay geometry, collision, input sampling, procedural route, target placement, timing windows, and score rules MUST NOT change with quality tier.

Runtime changes need hysteresis:

- downgrade only after sustained frame misses;
- upgrade only between runs;
- require a substantially safer frame-time margin to upgrade than to remain at the current tier;
- persist the last safe tier, but rerun the benchmark after major releases.

---

## 5. Recommended Technology Stack

### 5.1 Client

- TypeScript with strict compiler settings.
- Vite for the game client and shader iteration.
- Three.js.
- React only for menus, account surfaces, settings, store, and HUD composition where appropriate.
- Simulation outside React rendering and reconciliation.
- A small event-driven store such as Zustand for non-authoritative UI state.
- Rapier 3D WASM for collision queries, static colliders, triggers, and deterministic physics support.
- `postprocessing` by pmndrs for the WebGL effects chain.
- Web Audio API for adaptive music and low-level control; Howler.js MAY be used for simpler asset playback after latency testing.
- Zod for configuration and payload validation.
- Vitest for unit and property tests.
- Playwright for browser, input, screenshot, and performance smoke tests.

### 5.2 Deterministic kernel

The MVP MAY implement the movement solver in strict TypeScript. Ranked production SHOULD move the authoritative movement and replay-validation kernel into a small Rust-to-WASM package shared by browser and server.

Reasons:

- the same compiled numerical implementation can run in both places;
- custom deterministic trigonometric or lookup functions can avoid differences in JavaScript transcendental functions;
- binary snapshots and checksums are easier to version;
- the server can validate input-only replays without trusting client positions.

Rapier's JavaScript/WASM build documents cross-platform determinism when initial conditions, insertion order, parameters, and deterministic inputs are identical. The project must still avoid nondeterministic initialization and JavaScript `Math.sin`/`Math.cos` in authoritative state generation.

### 5.3 Rendering support libraries

Preferred:

- `postprocessing`: EffectComposer, bloom, SMAA, DoF, SSAO, LUT, tone mapping.
- `three-mesh-bvh`: accelerated static-mesh raycasts and editor/debug spatial queries where Rapier colliders are not the correct source.
- `gltf-transform`: validation, deduplication, pruning, mesh compression, texture resizing, KTX2 compression.
- `meshoptimizer` or gltfpack: vertex-cache optimization, simplification, and compact glTF delivery.
- KTX-Software: KTX2 inspection, validation, and Basis Universal encoding.

Experimental, high-tier only:

- `realism-effects`: candidate for SSGI, temporal anti-aliasing, and motion blur after stability and device testing.
- `three-gpu-pathtracer`: reference renders, marketing stills, and optional stationary photo mode only. It is not a live gameplay dependency.

### 5.4 Backend

- Compact TypeScript API or serverless functions for accounts, signed challenge manifests, score submissions, inventory, and cloud save.
- PostgreSQL or Supabase for persistence.
- Object storage for replay files and share clips.
- Queue or worker for expensive replay validation and clip generation.
- CDN for immutable versioned game assets.

### 5.5 Package version policy

Exact package versions MUST be pinned in the lockfile. Experimental rendering APIs MUST be isolated behind adapters. Upgrades require:

- release-note review;
- deterministic replay comparison;
- screenshot comparison;
- performance benchmark comparison;
- asset-loader compatibility tests.

---

## 6. Repository Architecture

```text
gravity-run/
  apps/
    game/
      src/
        bootstrap/
        app/
        simulation/
          kernel/
          state/
          input/
          targeting/
          tether/
          free-flight/
          collision/
          scoring/
          procedural/
          replay/
          difficulty/
          tests/
        presentation/
          camera/
          animation/
          audio/
          vfx/
          hud/
        render/
          core/
          webgl/
          webgpu/
          materials/
          lighting/
          post/
          particles/
          debug/
        streaming/
        ui/
        workers/
        config/
      public/
      tests/
    server/
      src/
        auth/
        challenge/
        leaderboard/
        replay-validation/
        progression/
        cosmetics/
        telemetry/
  packages/
    simulation-wasm/
    shared-protocol/
    game-config/
    asset-pipeline/
    eslint-config/
    tsconfig/
  content/
    source/
      blender/
      substance/
      textures/
      audio/
      concept/
    exported/
      characters/
      wells/
      environments/
      modules/
      hazards/
      vfx/
      ui/
      audio/
    manifests/
  docs/
    GRAVITY_RUN_GAME_ARCHITECTURE.md
  tools/
    benchmark/
    seed-inspector/
    replay-viewer/
    module-validator/
    asset-auditor/
    screenshot-runner/
  .github/workflows/
6.1 Dependency boundaries
Authoritative simulation imports only deterministic math, configuration, schemas, and collision-query interfaces.

Presentation consumes immutable simulation snapshots and events.

Rendering cannot mutate simulation state.

UI issues commands; it does not directly change player state.

Server and client share protocol schemas and the authoritative kernel version.

Assets are addressed by manifest IDs, never hard-coded URLs.

Experimental renderer code cannot leak into gameplay modules.

6.2 Data-oriented runtime model
A full ECS framework is not required for MVP. Use compact typed arrays or stable object pools for repeated runtime entities:

gravity wells;

hazards;

pickups;

debris;

particles;

module instances;

ghosts.

The architecture should preserve clear component data boundaries so migration to an ECS remains possible if profiling proves necessary.

7. Runtime Lifecycle and State Machines
7.1 Top-level lifecycle
BOOT
  -> CAPABILITY_TEST
  -> CORE_LOAD
  -> TITLE
  -> TUTORIAL | RUN_SETUP
  -> COUNTDOWN
  -> RUNNING
  -> FAILURE_SEQUENCE | RUN_COMPLETE
  -> RESULT
  -> RESTART | TITLE
7.2 Movement state machine
FREE_FLIGHT
  -> TARGET_PREVIEW
  -> LATCH_BLEND
  -> ORBITING
  -> RELEASE_PENDING
  -> RELEASED
  -> FREE_FLIGHT
Exceptional states:

SCRAPE_RECOVERY

EMERGENCY_RECOVERY

FAILURE_LOCK

CINEMATIC_HANDOFF

State transitions occur only on fixed simulation ticks.

7.3 Input contract
Primary input:

pointer down, touch start, keyboard press, or gamepad button down = hold intent;

pointer up, touch end, keyboard release, or gamepad button up = release intent.

Input events are time-stamped, quantized to simulation ticks, and stored as transitions rather than per-frame booleans.

Recommended starting values:

input buffer before valid latch: 4 simulation ticks;

release buffer before latch completes: 3 simulation ticks;

minimum committed latch: 1 tick;

target-switch hysteresis: 8% to 15% score advantage, tuned by testing.

7.4 Pause and visibility
Non-ranked runs pause automatically when the document becomes hidden.

Ranked attempts become invalid if the page is backgrounded beyond a short tolerance.

Audio envelopes pause with simulation time.

Loading and network operations may continue.

Rendering may continue at a reduced rate behind a pause overlay.

7.5 Restart
Restart MUST:

reset simulation through pooled state;

preserve compiled shaders and loaded resources;

reuse module allocations when seed permits;

avoid page reload;

return to active control in under one second after confirmation on supported devices.

8. Coordinate System, Scale and World Origin
8.1 Units
One world unit = one meter.

Character height starting value = 1.75 m.

Standard well radius starting range = 1.2 m to 2.5 m.

Typical tether radius starting range = 5 m to 18 m.

Typical free-flight speed starting range = 12 m/s to 42 m/s.

Overdrive speed may exceed this only for short authored sequences.

These values establish believable animation and camera scale. Gameplay tuning may change them, but all content must retain consistent unit interpretation.

8.2 Axes
Y up.

Forward route direction is local module positive Z by convention.

Blender export conversion MUST be standardized and validated.

Transform scale MUST be applied before export.

8.3 Endless-world precision
The visual world must not drift to arbitrarily large coordinates.

Use segmented origin rebasing:

logical run progress is stored separately as a 64-bit or bigint-compatible scalar/module index;

active simulation geometry remains within a local origin radius;

at safe module boundaries, subtract a shared offset from player, active modules, wells, hazards, particles, and camera history;

rebase only on a fixed tick and emit an explicit rebase event;

replay data stores logical module IDs and local states, not unbounded absolute positions.

Large far planes and logarithmic depth buffers should not be used as a substitute for origin management. Three.js documents reversed depth buffering as more accurate and efficient than logarithmic depth buffering where the required extension is available; it remains an optional renderer capability, not a gameplay dependency.

9. Fixed-Step Simulation and Determinism
9.1 Simulation clock
Normative fixed step:

dt = 1 / 60 seconds
Presentation can render at any supported refresh rate. It interpolates between the previous and current authoritative snapshots.

accumulator += min(realFrameDelta, maxFrameDelta)
while accumulator >= dt and steps < maxCatchUpSteps:
    simulateOneTick(dt)
    accumulator -= dt
alpha = accumulator / dt
render(interpolate(previousState, currentState, alpha))
Starting values:

maxFrameDelta = 0.10 s

maxCatchUpSteps = 4

If the game falls further behind, presentation time is dropped. The simulation must not execute an unbounded backlog.

9.2 Deterministic input and random streams
Replay identity includes:

game build version;

simulation kernel version;

movement configuration hash;

procedural configuration hash;

seed;

input transitions by tick;

optional periodic checksums;

selected assist flags.

Randomness MUST be split into named streams:

course geometry;

hazards;

pickups;

cosmetics;

particles;

audio variation.

Adding a cosmetic random call must not alter course geometry.

A stable generator such as xoshiro128** may be used, but its implementation and seed expansion must be versioned and shared.

9.3 Floating-point policy
Authoritative code MUST:

avoid frame-rate-dependent interpolation;

avoid unordered iteration over maps where order changes state;

centralize epsilons and clamping;

normalize vectors through a deterministic implementation;

avoid JavaScript transcendental functions in ranked state evolution;

use the same Rapier version, insertion order, and parameters on validator and client;

serialize configuration values exactly.

Recommended production approach:

integer tick time;

float32-compatible state values;

deterministic sine/cosine lookup table or software math in shared WASM;

quantized phase for orbit progression;

snapshot checksum every 120 ticks.

9.4 Replay validation modes
Exact validation
Use the same WASM kernel and Rapier version. Input-only replay should reproduce checksums exactly.

Tolerant validation fallback
During early development, a Node validator may accept bounded positional and velocity error at checkpoints. This is not sufficient for a high-value competitive economy and must be replaced before ranked launch.

10. Player Physical Representation
The rendered character is not the collision body.

10.1 Colliders
Primary swept capsule or sphere for environment collision.

Smaller critical capsule for precision lethal hazards.

Larger non-colliding near-miss probe.

Pickup trigger sphere.

Camera avoidance proxy where needed.

Starting values for a 1.75 m character:

capsule radius: 0.32 m;

capsule segment half-height: 0.45 m;

collision skin: 0.025 m to 0.05 m;

near-miss expansion: 0.35 m to 0.9 m by hazard class.

The final values require speed and fairness testing.

10.2 Kinematic control
The player SHOULD be a position-based kinematic body or an analytically controlled collider. The movement solver proposes the next transform; Rapier performs shape casts and collision queries.

The generic Rapier character controller is useful for move-and-slide movement, but Gravity Run requires rotational orbital motion and game-specific response. Its documented lack of rotational movement support makes it inappropriate as the entire player controller. Use lower-level shape casts and a custom response solver.

10.3 Collision sequence per tick
Compute desired movement from the current state.

Cast the player shape from previous to proposed position.

If no hit, accept movement.

If hit, move to time of impact minus skin.

Classify surface: lethal, scrape, slide, bounce, trigger, or ignored decorative.

Resolve remaining velocity according to surface policy.

Emit collision event with point, normal, relative speed, material ID, and hazard ID.

Update score, animation, VFX, audio, and failure state through events.

Continuous shape casting is mandatory at high speed to prevent tunnelling.

11. Gravity Well Data Model and Target Acquisition
11.1 Well schema
Each gravity well contains:

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
polarity
baseOrbitAcceleration
maximumTangentialSpeed
releaseImpulseProfile
routeEdges[]
authoredPriority
riskRating
state
visualProfileId
audioProfileId
11.2 Well classes
Standard: neutral timing and radius.

Accelerator: higher bounded speed gain and stronger release.

Precision: smaller radius and narrower perfect window.

Heavy: slower orbital build, large readable curve.

Recovery: safe forward correction, combo break, reduced score.

Split: deliberately reveals two route edges.

Decaying: expires or destabilizes after attachment.

Hazard polarity: repels or reverses expected orbit direction in advanced modules.

The first playable only requires Standard, Accelerator, Precision, and Recovery.

11.3 Candidate collection
Query wells in acquisition radius through a spatial hash or Rapier broad phase.

Reject disabled and recently exhausted wells.

Reject candidates beyond the hard backward cone unless recovery logic applies.

Reject candidates with insufficient predicted clearance.

Reject heavily occluded targets using occlusion-only ray tests.

Score remaining candidates.

11.4 Target score
Use normalized terms in [0, 1]:

score =
  wForward      * forwardAlignment
+ wScreen       * screenCentrality
+ wDistance     * distancePreference
+ wVelocity     * velocityCompatibility
+ wContinuation * routeContinuation
+ wPriority     * authoredPriority
+ wAssist       * accessibilityBias
- wTurn         * turnSeverity
- wOcclusion    * occlusionPenalty
- wRecent       * recentlyUsedPenalty
Suggested starting weights:

wForward      0.24
wScreen       0.12
wDistance     0.12
wVelocity     0.18
wContinuation 0.22
wPriority     0.12
Weights are starting values, not final facts.

11.5 Stable selection
The current preview target retains a hysteresis bonus. A new candidate must exceed the current candidate by a configured margin for multiple ticks before selection changes. Reticle flicker is unacceptable because it makes one-input control feel random.

11.6 Predictive reachability
A candidate is considered reachable only if a conservative short-horizon simulation finds at least one viable latch state within:

maximum acquisition time;

allowed approach cone;

maximum steering assistance;

collision clearance;

minimum forward progress.

The prediction uses simplified colliders and the same authoritative movement equations.

12. Tether, Orbit and Release Mathematics
This section is normative. The visual tether follows the solver; it does not drive it.

12.1 Symbols
C  = gravity well centre
P  = player position
V  = player velocity
R  = P - C
r  = |R|
u  = R / r                     radial unit vector
N  = orbit plane unit normal
T  = normalize(N x u)          tangent unit vector
s  = tangential speed
omega = angular speed = s / r
dt = fixed simulation step
12.2 Robust latch basis
At latch:

R0 = P0 - C
u0 = normalize(R0)
Nraw = R0 x V0
If |Nraw| exceeds the minimum threshold:

N = normalize(Nraw)
If the incoming velocity is nearly radial and the cross product is unstable:

Nfallback = normalize(R0 x Droute)
where Droute is the authored route-forward direction. If that is also degenerate, use a camera-independent module up/right fallback. The authoritative solver must not use current camera orientation because camera settings must never change gameplay.

Choose tangent sign:

Tplus  = normalize(N x u0)
Tminus = -Tplus
T0 = argmax(dot(Tplus, V0), dot(Tminus, V0))
Then flip N if required so T = normalize(N x u0) matches T0.

12.3 Incoming velocity decomposition
vRadial     = dot(V0, u0)
vTangential = dot(V0, T0)
Vradial     = vRadial * u0
Vtangent    = vTangential * T0
A large inward radial component can cause an apparent snap. During LATCH_BLEND, radial velocity is damped over a short fixed interval rather than deleted instantly.

Recommended blend:

radialRetention(t) = exp(-kLatch * t)
In the deterministic kernel, use the equivalent precomputed per-tick coefficient.

Starting latch blend duration: 3 to 6 ticks.

12.4 Orbit radius
Initial radius:

r0 = clamp(|R0|, rMin, rMax)
The radius may ease toward an authored target rTarget, but radius change must not create unlimited energy.

Recommended policy:

radius change is small and bounded;

tangential speed is controlled explicitly;

any angular-momentum-like speed gain from radius reduction is clamped by the well's energy budget;

repeatedly relatching the same well cannot accumulate unlimited speed.

12.5 Angular state update
Store orbital phase as a deterministic integer phase or a deterministic fixed-point angle.

For conceptual clarity:

angularAcceleration = tangentialAcceleration / r
omegaNext = clamp(omega + angularAcceleration * dt, omegaMin, omegaMax)
deltaTheta = omegaNext * dt
Rotate the radial unit vector with Rodrigues' formula:

uNext =
    u * cos(deltaTheta)
  + (N x u) * sin(deltaTheta)
  + N * dot(N, u) * (1 - cos(deltaTheta))
Because u should remain perpendicular to N, the final term is near zero. Re-orthonormalize periodically to prevent drift:

uNext = normalize(uNext - N * dot(N, uNext))
TNext = normalize(N x uNext)
Authoritative sine and cosine MUST come from deterministic WASM math or a versioned lookup table, not browser Math.sin and Math.cos.

12.6 Position and velocity in orbit
Pconstraint = C + rNext * uNext
VtangentNext = (omegaNext * rNext) * TNext
VradialResidual = radialRetention * vRadial * uNext
Vnext = VtangentNext + VradialResidual + VwellMotion
VwellMotion is included only for seeded moving wells and must be deterministic.

The proposed constrained position is then passed through continuous collision detection.

12.7 Orbit pump and energy budget
Holding may increase tangential speed, but the rule must be explicit and bounded:

sTarget = min(
  sEntry + aHold * holdTime,
  sEntry + deltaSWellBudget,
  sMaxWell,
  sGlobalMax
)
Use a critically damped or acceleration-limited approach to sTarget. The well stores consumed energy so detach/re-latch exploits cannot reset the budget.

Alternative advanced wells may modify the curve, but every class requires a documented speed budget.

12.8 Orbit-plane assistance
Route assistance may rotate N slightly toward a desirable exit plane. It MUST be:

bounded by degrees per second;

disabled or reduced in ranked expert modes if it changes outcomes materially;

based on route data, never camera orientation;

visually subtle;

logged in replay state.

Starting maximum assistance: 6 to 12 degrees over a full orbit, subject to testing.

12.9 Release velocity
At release tick:

Vrelease =
    Vtangent
  + radialReleaseRetention * VradialResidual
  + releaseImpulse * T
  + wellMotionContribution
  + boundedRouteAssistImpulse
Rules:

Tangential velocity is preserved.

The release impulse is small relative to accumulated speed.

Assistance cannot rotate a fundamentally incorrect release into a perfect one.

Maximum speed is clamped with a soft saturation curve, not a visible hard stop.

A useful soft cap:

sSoft = sCap * tanh(sRaw / sCap)
The deterministic implementation may use a rational approximation or table.

12.10 Free-flight integration
In normal free flight:

A = Gworld + Aauthored + Adrag
Vnext = V + A * dt
Pnext = P + V * dt + 0.5 * A * dt^2
World gravity should be weak relative to traversal momentum. It provides visual arc and recovery pressure rather than realistic falling.

Drag SHOULD be quadratic only if it improves control:

Adrag = -kDrag * |V| * V
A linear or capped drag model may be easier to tune and validate. The first prototype should compare both.

12.11 Perfect release evaluation
Do not evaluate perfection using only a hidden angular window.

Let:

Ddesired = normalize(Paim - Prelease)
Drelease = normalize(Vrelease)
alignment = dot(Drelease, Ddesired)
Avoid acos in authoritative scoring. Compare alignment against precomputed cosine thresholds.

Also evaluate:

predicted closest approach to the target or route gate;

collision clearance;

minimum forward progress;

speed band;

optional phase target;

route risk class.

For constant-velocity closest approach:

Q = Ptarget - Prelease
tClosest = clamp(dot(Q, Vrelease) / dot(Vrelease, Vrelease), 0, horizon)
missDistance = |Q - Vrelease * tClosest|
The actual short-horizon predictor uses the free-flight acceleration model and simplified collision volumes.

Suggested grade model:

quality =
  wA * alignmentScore
+ wM * missDistanceScore
+ wC * clearanceScore
+ wS * speedScore
+ wP * phaseScore
Grades:

MISS

SAFE

GOOD

PERFECT

OVERDRIVE

12.12 Input forgiveness
Buffered latch: hold input shortly before a candidate becomes valid.

Coyote release: release intent shortly before latch confirmation is preserved.

Hysteresis: current target remains stable.

Scrape tolerance: outer capsule may produce a non-lethal impact at lower difficulty.

Recovery well: visible, score-reducing, and logged. Do not secretly bend the route.

12.13 Predictive trajectory display
The predictor reuses the movement equations for 0.4 to 1.0 seconds at a reduced step count.

Tutorial: visible arc and target intercept.

Accessibility: optional stronger arc.

Standard gameplay: short tangent streak and reticle response.

Mobile low tier: no long translucent ribbon.