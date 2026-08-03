# Gravity Run asset provenance

Every production asset requires a stable ID, rights basis, source path, runtime path, budget and QA record.

## Project-owned interface assets

| Asset | Source | Rights basis | Runtime format | Production note |
| --- | --- | --- | --- | --- |
| Gravity Run wordmark | `apps/game/public/brand/gravity-run-logo.svg` | Project-owned original vector construction | SVG | Layered orbital paths, tonal gradients, accessible title/description and deterministic rendering. |
| Character roster | `apps/game/public/ui/characters/gravity-characters.svg` | Project-owned original vector construction | SVG symbol sprite | Five distinct silhouettes with shared palette, material language, gradients and bounded filters. |
| Tutorial and challenge art | `apps/game/public/ui/flow/gravity-flow-cards.svg` | Project-owned original vector construction | SVG symbol sprite | Four instructional cards and one challenge route, designed for crisp scaling and low transfer cost. |
| UI iconography | `apps/game/public/ui/icons/gravity-ui-icons.svg` | Project-owned original vector construction | SVG symbol sprite | Small symbolic controls only; no raster art masquerading as vector illustration. |

## External asset research, not yet integrated

The following sources were reviewed as candidates because they publish assets under CC0. No external model has been copied into the repository in this tranche.

- Quaternius Modular Sci-Fi MegaKit
- Quaternius Cyberpunk Game Kit
- Quaternius Sci-Fi Essentials Kit
- Kenney Modular Space Kit
- Poly Haven CC0 models, HDRIs and PBR textures
- ambientCG CC0 PBR materials

Before an external asset enters `content/source`, record the canonical page, creator, license snapshot, version, original checksum, modifications, topology/UV findings, runtime budget and final checksum. Search-result mirrors and unclear licenses are rejected.
