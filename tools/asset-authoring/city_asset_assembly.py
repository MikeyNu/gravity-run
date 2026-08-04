"""glTF scene assembly for deterministic city asset families."""
from __future__ import annotations

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

from city_detail_builders import antenna_cluster, debris_chunk, far_cluster, truss_support
from city_environment_contract import AssetSpec
from city_geometry import materialize
from city_structure_builders import bridge_straight, broken_tower, platform_wide, tower_a, tower_b

BUILDERS = {
    "tower-a": tower_a,
    "tower-b": tower_b,
    "tower-broken": broken_tower,
    "bridge-straight": bridge_straight,
    "platform-wide": platform_wide,
    "truss-support": truss_support,
    "antenna-cluster": antenna_cluster,
    "far-cluster": far_cluster,
}


def add_geometry(scene: trimesh.Scene, meshes: list[trimesh.Trimesh], name: str, material: PBRMaterial, uv_mode: str = "box") -> int:
    if not meshes:
        return 0
    combined = trimesh.util.concatenate(meshes)
    combined = materialize(combined, material, uv_mode)
    scene.add_geometry(combined, node_name=name, geom_name=name)
    return int(len(combined.faces))


def add_proxy(scene: trimesh.Scene, name: str, half_extents: tuple[float, float, float], purpose: str, scale: float = 1.0) -> None:
    mesh = trimesh.creation.box(extents=np.asarray(half_extents) * 2.0 * scale)
    mesh.visual.face_colors = [255, 0, 255, 18] if purpose == "COLLISION" else [0, 255, 255, 12]
    mesh.metadata.update({"proxy": purpose.lower(), "runtime_visible": False})
    scene.add_geometry(mesh, node_name=f"{name}_{purpose}", geom_name=f"{name}_{purpose}")


def add_socket(scene: trimesh.Scene, prefix: str, socket: str, half_extents: tuple[float, float, float]) -> None:
    x, _, _ = half_extents
    location = {
        "entry": (-x, 0.0, 0.0),
        "exit": (x, 0.0, 0.0),
        "decor-a": (-x * 0.45, 1.1, -half_extents[2] * 0.55),
        "decor-b": (x * 0.45, 1.1, half_extents[2] * 0.55),
    }[socket]
    marker = trimesh.creation.icosphere(subdivisions=0, radius=0.06)
    marker.apply_translation(location)
    marker.visual.face_colors = [255, 255, 0, 10]
    marker.metadata.update({"socket": socket, "runtime_visible": False})
    scene.add_geometry(marker, node_name=f"{prefix}_SOCKET_{socket}", geom_name=f"{prefix}_SOCKET_{socket}")


def build_asset(scene: trimesh.Scene, spec: AssetSpec, lod: int, mats: dict[str, PBRMaterial], rng: np.random.Generator) -> dict[str, object]:
    prefix = f"environment_{spec.kind}_lod{lod}"
    parts = debris_chunk(lod, rng) if spec.kind == "debris-chunk-large" else BUILDERS[spec.kind](lod)
    triangle_count = 0
    triangle_count += add_geometry(scene, parts["metal"], f"{prefix}_metal", mats["metal"])
    triangle_count += add_geometry(scene, parts["dark"], f"{prefix}_dark", mats["dark"])
    triangle_count += add_geometry(scene, parts["emissive"], f"{prefix}_emissive", mats["warning"] if spec.kind in {"tower-broken", "debris-chunk-large"} else mats["emissive"])
    add_proxy(scene, prefix, spec.reference_half_extents, "COLLISION", 0.94)
    add_proxy(scene, prefix, spec.reference_half_extents, "OCCLUSION", 0.82)
    for socket in spec.sockets:
        add_socket(scene, prefix, socket, spec.reference_half_extents)
    return {
        "kind": spec.kind,
        "role": spec.role,
        "lod": lod,
        "triangles": triangle_count,
        "referenceHalfExtents": spec.reference_half_extents,
        "nodePrefix": prefix,
        "sockets": list(spec.sockets),
    }
