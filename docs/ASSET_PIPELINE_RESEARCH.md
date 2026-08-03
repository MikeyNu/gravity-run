# Asset pipeline research and production contract

## Runtime format decisions

- Runtime 3D assets use **glTF 2.0 binary (`.glb`)**.
- Large texture sets are authored as lossless source maps, then packaged as **KTX2/Basis Universal** for production delivery.
- Geometry is delivered with explicit LOD groups and is eligible for **meshopt** compression after validation.
- Collision and occlusion proxies are named nodes inside the asset package and are excluded from visible rendering.
- Generated 3D binaries are build outputs. Their deterministic generators, manifests and QA reports are versioned instead.
- Interface assets remain directly versioned SVG sources when vector geometry is the appropriate final medium.

## Geometry acceptance contract

Every production model must pass:

- finite vertices and normals;
- no zero-area faces;
- intentional hard/soft edge handling;
- no accidental duplicated shells or interior faces;
- origin, forward axis and metre scale compliance;
- stable component naming;
- UV channel presence where the material requires it;
- normalized UVs with gutters suitable for mipmapping;
- strictly decreasing LOD triangle counts;
- collision and occlusion proxy checks;
- in-engine silhouette review at target screen sizes.

Triangle count alone is not a quality metric. Silhouette fidelity, projected size, draw-call count, material count and overdraw are reviewed together.

## Texture acceptance contract

Each texture set declares:

- semantic role and color space;
- source and runtime resolution;
- tiling or unique-UV policy;
- packed-channel layout;
- compression mode;
- alpha requirements;
- mip-safe edge padding;
- memory and transfer budget.

Base-color and emissive color maps use sRGB interpretation. Normal, roughness, metallic, occlusion and masks use linear interpretation. ORM packing is `R=occlusion`, `G=roughness`, `B=metallic`.

## Provenance and external assets

External assets may be integrated only when all of the following are recorded:

- canonical source page;
- creator;
- license and redistribution terms;
- original file checksum;
- modifications performed;
- runtime output path;
- attribution requirement, if any.

A search result or download mirror is not sufficient provenance. Assets with unclear licensing are rejected. CC0 libraries are preferred, but every imported model still passes the same topology, UV, naming, material, LOD and performance gates as project-owned work.

## Current deterministic authoring tools

- `generate_gravity_wells.py`: authors the first gravity-well family, PBR maps, LODs and proxies.
- `qa_gravity_wells.py`: validates topology, UVs, texture dimensions and LOD budgets.
- `generate_runtime_assets.py`: rebuilds all deterministic runtime outputs from versioned text sources.

These scripts are foundations, not an excuse to accept procedural-looking final art. Every generated family must still pass an art-direction review and may be refined in Blender while preserving its runtime identifiers and export contract.
