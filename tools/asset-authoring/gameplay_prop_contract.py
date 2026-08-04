"""Stable contracts for the deterministic gameplay-prop asset family."""
from __future__ import annotations

from dataclasses import dataclass

SEED = 0x47525052

LOD = {
    0: {"radial": 64, "minor": 12, "sphere": 4, "detail": 1.0},
    1: {"radial": 36, "minor": 8, "sphere": 3, "detail": 0.62},
    2: {"radial": 18, "minor": 5, "sphere": 2, "detail": 0.28},
}


@dataclass(frozen=True)
class AssetSpec:
    kind: str
    category: str
    reference_half_extents: tuple[float, float, float]


ASSETS = (
    AssetSpec("spire", "hazard", (1.2, 5.5, 1.2)),
    AssetSpec("blade", "hazard", (1.8, 1.8, 0.32)),
    AssetSpec("debris", "hazard", (1.0, 1.0, 1.0)),
    AssetSpec("collapse-gate", "hazard", (1.2, 3.8, 6.5)),
    AssetSpec("fragment", "pickup", (0.55, 0.55, 0.55)),
)
