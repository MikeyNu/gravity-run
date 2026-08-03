# Scaffolding decisions

## Why the repository starts without Turborepo

The current workspace is small enough for pnpm's topological recursive execution. Turborepo should be added only when build caching, remote CI caching or duplicated task orchestration provides measurable value.

## Why the simulation does not use Three.js vectors

Three.js objects are mutable and renderer-oriented. The simulation uses plain structural vectors so snapshots can be serialized, checksummed, tested in Node, replayed on a server, and eventually moved into a deterministic Rust/WASM kernel without rewriting presentation code.

## Why Rapier is installed but not authoritative for orbit motion

Rapier will handle broad-phase queries, shape casts, triggers, static collision and controlled kinematic hazards. The player's tether and orbit are analytical constraints because gameplay needs predictable timing and direct tuning authority. A rope joint or free rigid-body simulation would introduce unnecessary instability and tuning ambiguity.

## Why the first scene is a movement laboratory

The first technical risk is not menus, accounts or procedural city generation. It is whether press, hold and release produce readable, satisfying and learnable motion. The movement laboratory keeps iteration focused and gives QA a reproducible environment for physics and camera changes.

## Branch exit criteria

The scaffold is ready to merge when:

- workspace boundaries are present;
- the game app can boot with no missing imports after installation;
- shared math and replay protocol compile independently;
- the fixed-step loop never allows unbounded catch-up;
- simulation snapshots are immutable at the boundary;
- asset-manifest validation is available in CI;
- the API exposes health and challenge stubs without owning gameplay logic.
