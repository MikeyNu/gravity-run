# Gameplay props production QA

## Scope

This QA record covers the deterministic authored family used for gameplay hazards and pickups:

- spire;
- rotating blade;
- debris cluster;
- collapse gate;
- gravity fragment.

Each family has explicit LOD0, LOD1 and LOD2 nodes, normalized UVs, shared PBR texture sources, collision proxies and occlusion proxies.

## Deterministic regeneration

The original monolithic generator was split into upload-safe modules without changing the output contract. A clean regeneration produced byte-for-byte identical files:

| Output | SHA-256 |
| --- | --- |
| `gameplay-props.glb` | `d01335d082ed727e870c45d5eb58880632d3bbdc75ba065c79527300b39897c7` |
| `gameplay-props.json` | `691ae01a37098318668aa741b107c8aca8bba784bab4a56c0946334c74c95cae` |
| `fragment-crystal-basecolor.png` | `0aa64d1cdcbf05ccf3fe4b3332171e0be5ecde32ab95f5263968e5903410905d` |
| `gameplay-emissive-mask.png` | `0ecbf0e30dde83544a3b7f79ad1dbc86746ec781fec5bf712f23694e45563eb4` |
| `gameplay-metal-basecolor.png` | `7884e009388065aec8fdbba5b93936a0b3940fa936dc9637dd7dcd5624d069b2` |
| `gameplay-metal-normal.png` | `76bc033081cde11f90261b08b245d2b688c3bfa19d6f07a0f9413c4b7f03a211` |
| `gameplay-metal-orm.png` | `89685d3c8b6abd8c3f2137a375ef9003af806d4d29f1cda53a46a3277976f823` |

## Structural results

- GLB size: **3,621,536 bytes**, below the 4.5 MB source budget.
- Geometry count: **130 meshes**.
- Material count: **4 shared PBR materials**.
- Structural QA failures: **0**.
- Structural QA warnings: **0**.
- Every LOD record has render nodes, a collision proxy and an occlusion proxy.
- Every non-proxy mesh has finite normalized UV coordinates.
- No non-finite vertices or degenerate faces were detected.
- Triangle counts decrease strictly from LOD0 to LOD2 for all five families.

## Texture results

- Five source textures at **1024 × 1024**.
- Base colour and crystal maps use RGBA.
- Normal, ORM and emissive maps use RGB.
- Normal-map mean unit-length error: **0.00721**.
- ORM roughness channel range: **102–153**, proving non-constant roughness variation.
- Source textures are project-owned deterministic outputs.

## Runtime integration

- `GameplayAssetLibrary` selects LOD2 for compatibility, LOD1 for mobile and LOD0 for desktop/cinematic profiles.
- Course streaming retains geometric fallbacks if the GLB is unavailable.
- Shared geometries, materials and textures are explicitly disposed by the asset library.
- Runtime copies are marked as library-managed so course streaming cannot double-dispose shared resources.

## Timings

Standalone bounded validation on the working environment:

- generation: **11.02 seconds**;
- structural QA: **1.14 seconds**;
- headless contact-sheet render: **3.02 seconds**.

## Remaining release work

The current authored family closes the source, LOD, UV, material, proxy and runtime-loading requirements for the existing gameplay objects. Additional moving hazard types, anticipation states, cooldown states, mesh compression and final device-level visual certification remain separate architecture work.
