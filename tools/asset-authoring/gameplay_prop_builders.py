"""Authored hazard and pickup builders for the gameplay-prop family."""
from __future__ import annotations

import math

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

from gameplay_prop_contract import AssetSpec, LOD, SEED
from gameplay_prop_geometry import add_mesh, box_uv, cone_between, cylindrical_uv, spherical_uv, transform_between


def build_spire(scene: trimesh.Scene, lod: int, mats: dict[str, PBRMaterial]) -> int:
    prefix = f"hazard_spire_lod{lod}"
    cfg = LOD[lod]
    triangles = 0
    body = cone_between(1.0, 8.4, cfg["radial"])
    body.apply_translation((0, 0.15, 0))
    triangles += add_mesh(scene, body, f"{prefix}_BODY", mats["metal"], cylindrical_uv(body))
    base = trimesh.creation.cylinder(radius=1.18, height=0.48, sections=cfg["radial"])
    base.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0]))
    base.apply_translation((0, -4.2, 0))
    triangles += add_mesh(scene, base, f"{prefix}_BASE", mats["metal"], cylindrical_uv(base))
    ring_count = 5 if lod == 0 else 3 if lod == 1 else 2
    for index in range(ring_count):
        ring = trimesh.creation.torus(0.68 - index * 0.045, 0.055, major_sections=cfg["radial"], minor_sections=cfg["minor"])
        ring.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
        ring.apply_translation((0, -2.8 + index * 1.38, 0))
        triangles += add_mesh(scene, ring, f"{prefix}_ENERGY_{index}", mats["warning"], cylindrical_uv(ring))
    fin_count = 6 if lod == 0 else 4 if lod == 1 else 3
    for index in range(fin_count):
        angle = index * (2 * math.pi / fin_count)
        start = np.array((math.cos(angle) * 0.52, -3.15, math.sin(angle) * 0.52))
        end = np.array((math.cos(angle) * 1.12, -4.0, math.sin(angle) * 1.12))
        fin = transform_between(start, end, (0.22, 0.10))
        triangles += add_mesh(scene, fin, f"{prefix}_FIN_{index}", mats["warning"], box_uv(fin))
    return triangles


def build_blade(scene: trimesh.Scene, lod: int, mats: dict[str, PBRMaterial]) -> int:
    prefix = f"hazard_blade_lod{lod}"
    cfg = LOD[lod]
    triangles = 0
    hub = trimesh.creation.cylinder(radius=0.48, height=0.55, sections=cfg["radial"])
    hub.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    triangles += add_mesh(scene, hub, f"{prefix}_HUB", mats["metal"], cylindrical_uv(hub))
    ring = trimesh.creation.torus(1.24, 0.13, major_sections=cfg["radial"], minor_sections=cfg["minor"])
    ring.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    triangles += add_mesh(scene, ring, f"{prefix}_RING", mats["metal"], cylindrical_uv(ring))
    blade_count = 4
    for index in range(blade_count):
        angle = index * math.pi * 0.5
        inner = 0.5
        outer = 1.78
        width = 0.28 if lod == 0 else 0.32
        vertices = np.array([
            (-0.13, inner, -width), (0.13, inner, -width),
            (0.09, outer, -width * 0.18), (-0.09, outer, -width * 0.18),
            (-0.13, inner, width), (0.13, inner, width),
            (0.09, outer, width * 0.18), (-0.09, outer, width * 0.18),
        ])
        faces = np.array([
            (0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6),
            (0, 4, 5), (0, 5, 1), (1, 5, 6), (1, 6, 2),
            (2, 6, 7), (2, 7, 3), (3, 7, 4), (3, 4, 0),
        ])
        blade = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
        blade.apply_transform(trimesh.transformations.rotation_matrix(angle, [1, 0, 0]))
        triangles += add_mesh(scene, blade, f"{prefix}_BLADE_{index}", mats["warning"], box_uv(blade))
    return triangles


def build_debris(scene: trimesh.Scene, lod: int, mats: dict[str, PBRMaterial]) -> int:
    prefix = f"hazard_debris_lod{lod}"
    cfg = LOD[lod]
    triangles = 0
    piece_count = 7 if lod == 0 else 4 if lod == 1 else 2
    local_rng = np.random.default_rng(SEED + lod * 53)
    for index in range(piece_count):
        points = local_rng.normal(0, 1, (14 if lod == 0 else 9, 3))
        points *= np.array((0.52, 0.78, 0.48))
        hull = trimesh.convex.convex_hull(points)
        hull.apply_translation(local_rng.uniform((-0.62, -0.58, -0.62), (0.62, 0.58, 0.62)))
        hull.apply_transform(trimesh.transformations.rotation_matrix(float(local_rng.uniform(-math.pi, math.pi)), local_rng.normal(0, 1, 3)))
        triangles += add_mesh(scene, hull, f"{prefix}_CHUNK_{index}", mats["metal"], spherical_uv(hull))
    if lod < 2:
        band = trimesh.creation.torus(0.82, 0.04, major_sections=cfg["radial"], minor_sections=cfg["minor"])
        band.apply_transform(trimesh.transformations.rotation_matrix(math.pi * 0.34, [1, 0.35, 0]))
        triangles += add_mesh(scene, band, f"{prefix}_WARNING", mats["warning"], cylindrical_uv(band))
    return triangles


def build_gate(scene: trimesh.Scene, lod: int, mats: dict[str, PBRMaterial]) -> int:
    prefix = f"hazard_collapse-gate_lod{lod}"
    triangles = 0
    spine = trimesh.creation.box(extents=(1.65, 6.9, 1.18))
    triangles += add_mesh(scene, spine, f"{prefix}_SPINE", mats["metal"], box_uv(spine))
    arm_count = 5 if lod == 0 else 3 if lod == 1 else 2
    for index in range(arm_count):
        y = -2.65 + index * (5.3 / max(arm_count - 1, 1))
        arm = trimesh.creation.box(extents=(1.95, 0.42, 5.8 - abs(y) * 0.35))
        arm.apply_translation((0, y, 2.55))
        triangles += add_mesh(scene, arm, f"{prefix}_ARM_{index}", mats["metal"], box_uv(arm))
        strip = trimesh.creation.box(extents=(2.03, 0.12, 4.85 - abs(y) * 0.28))
        strip.apply_translation((0, y, 2.67))
        triangles += add_mesh(scene, strip, f"{prefix}_STRIP_{index}", mats["warning"], box_uv(strip))
    cap_top = trimesh.creation.box(extents=(2.15, 0.52, 6.45))
    cap_top.apply_translation((0, 3.45, 2.65))
    cap_bottom = cap_top.copy()
    cap_bottom.apply_translation((0, -6.9, 0))
    triangles += add_mesh(scene, cap_top, f"{prefix}_CAP_TOP", mats["metal"], box_uv(cap_top))
    triangles += add_mesh(scene, cap_bottom, f"{prefix}_CAP_BOTTOM", mats["metal"], box_uv(cap_bottom))
    return triangles


def build_fragment(scene: trimesh.Scene, lod: int, mats: dict[str, PBRMaterial]) -> int:
    prefix = f"pickup_fragment_lod{lod}"
    cfg = LOD[lod]
    triangles = 0
    crystal = trimesh.creation.icosphere(subdivisions=cfg["sphere"], radius=0.42)
    crystal.apply_scale((0.68, 1.15, 0.68))
    triangles += add_mesh(scene, crystal, f"{prefix}_CRYSTAL", mats["crystal"], spherical_uv(crystal))
    ring_count = 3 if lod == 0 else 2 if lod == 1 else 1
    for index in range(ring_count):
        ring = trimesh.creation.torus(0.48 + index * 0.055, 0.025, major_sections=cfg["radial"], minor_sections=cfg["minor"])
        ring.apply_transform(trimesh.transformations.rotation_matrix((index - 1) * math.pi / 3, [1, 0, 0]))
        triangles += add_mesh(scene, ring, f"{prefix}_CAGE_{index}", mats["cool"], cylindrical_uv(ring))
    return triangles


def build_asset(scene: trimesh.Scene, spec: AssetSpec, lod: int, mats: dict[str, PBRMaterial]) -> dict[str, object]:
    if spec.kind == "spire":
        triangles = build_spire(scene, lod, mats)
    elif spec.kind == "blade":
        triangles = build_blade(scene, lod, mats)
    elif spec.kind == "debris":
        triangles = build_debris(scene, lod, mats)
    elif spec.kind == "collapse-gate":
        triangles = build_gate(scene, lod, mats)
    elif spec.kind == "fragment":
        triangles = build_fragment(scene, lod, mats)
    else:
        raise ValueError(spec.kind)

    prefix = f"{spec.category}_{spec.kind}_lod{lod}"
    collision = trimesh.creation.box(extents=np.array(spec.reference_half_extents) * 2)
    collision.metadata["visible"] = False
    collision.visual = trimesh.visual.ColorVisuals(mesh=collision, face_colors=[0, 0, 0, 0])
    scene.add_geometry(collision, node_name=f"{prefix}_COLLISION", geom_name=f"{prefix}_COLLISION")
    occlusion = trimesh.creation.box(extents=np.array(spec.reference_half_extents) * 1.72)
    occlusion.metadata["visible"] = False
    occlusion.visual = trimesh.visual.ColorVisuals(mesh=occlusion, face_colors=[0, 0, 0, 0])
    scene.add_geometry(occlusion, node_name=f"{prefix}_OCCLUSION", geom_name=f"{prefix}_OCCLUSION")

    return {
        "kind": spec.kind,
        "category": spec.category,
        "lod": lod,
        "triangles": triangles,
        "referenceHalfExtents": list(spec.reference_half_extents),
        "nodePrefix": prefix,
    }
