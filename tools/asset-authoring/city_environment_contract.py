"""Stable contracts for the deterministic Shattered Vertical City kit."""
from __future__ import annotations

from dataclasses import dataclass

SEED = 0x47524349

LOD = {
    0: {"round_segments": 6, "rib_step": 1, "detail": 1.0},
    1: {"round_segments": 3, "rib_step": 2, "detail": 0.58},
    2: {"round_segments": 1, "rib_step": 4, "detail": 0.24},
}


@dataclass(frozen=True)
class AssetSpec:
    kind: str
    reference_half_extents: tuple[float, float, float]
    role: str
    sockets: tuple[str, ...] = ()


ASSETS = (
    AssetSpec("tower-a", (4.0, 16.0, 4.0), "near-architecture"),
    AssetSpec("tower-b", (5.0, 22.0, 5.0), "near-architecture"),
    AssetSpec("tower-broken", (5.0, 20.0, 5.0), "landmark"),
    AssetSpec("bridge-straight", (10.0, 1.4, 3.0), "route-module", ("entry", "exit")),
    AssetSpec("platform-wide", (8.0, 1.2, 6.0), "route-module", ("entry", "exit", "decor-a", "decor-b")),
    AssetSpec("truss-support", (4.0, 6.0, 1.2), "support"),
    AssetSpec("antenna-cluster", (2.5, 7.0, 2.5), "set-dressing"),
    AssetSpec("debris-chunk-large", (3.0, 2.5, 3.0), "set-dressing"),
    AssetSpec("far-cluster", (14.0, 30.0, 10.0), "far-silhouette"),
)
