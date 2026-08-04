"""Support, signal, debris and far-silhouette builders for the city kit."""
from __future__ import annotations

import math

import numpy as np
import trimesh

from city_environment_contract import LOD
from city_geometry import beam_between, box_mesh, cylinder_mesh, rounded_prism, transform


def truss_support(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    metal: list[trimesh.Trimesh] = []
    dark: list[trimesh.Trimesh] = []
    emissive: list[trimesh.Trimesh] = []
    for z in (-0.7, 0.7):
        metal.append(beam_between((-3.2, -5.0, z), (0, 5.0, z), (0.36, 0.36)))
        metal.append(beam_between((0, 5.0, z), (3.2, -5.0, z), (0.36, 0.36)))
        metal.append(beam_between((-3.2, -5.0, z), (3.2, -5.0, z), (0.42, 0.42)))
    if lod == 0:
        dark.append(beam_between((-2.7, -3.7, -0.7), (2.7, 1.6, 0.7), (0.22, 0.22)))
        dark.append(beam_between((-2.7, -3.7, 0.7), (2.7, 1.6, -0.7), (0.22, 0.22)))
        dark.append(beam_between((-1.7, -0.4, -0.7), (1.7, 3.6, 0.7), (0.20, 0.20)))
        dark.append(beam_between((-1.7, -0.4, 0.7), (1.7, 3.6, -0.7), (0.20, 0.20)))
    elif lod == 1:
        dark.append(beam_between((-2.4, -3.2, -0.7), (2.4, 2.2, 0.7), (0.24, 0.24)))
    emissive.append(box_mesh((0.16, 4.8, 0.16), (0, 0.6, 0.82)))
    return {"metal": metal, "dark": dark, "emissive": emissive}


def antenna_cluster(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    metal = [cylinder_mesh(1.6, 0.8, (0, -5.8, 0), 20 if lod == 0 else 12)]
    dark: list[trimesh.Trimesh] = []
    emissive: list[trimesh.Trimesh] = []
    mast_count = 5 if lod == 0 else 3 if lod == 1 else 1
    for index in range(mast_count):
        angle = index * math.tau / max(mast_count, 1)
        x, z = math.cos(angle) * (0.5 + (index % 2) * 0.65), math.sin(angle) * (0.5 + (index % 2) * 0.65)
        height = 7.5 + (index % 3) * 2.2
        metal.append(cylinder_mesh(0.11 + (index % 2) * 0.04, height, (x, -5.4 + height * 0.5, z), 10 if lod == 0 else 7))
        emissive.append(cylinder_mesh(0.18, 0.22, (x, -5.4 + height, z), 10 if lod == 0 else 7))
    if lod == 0:
        dish = trimesh.creation.annulus(r_min=0.35, r_max=1.2, height=0.12, sections=32)
        dish = transform(dish, translation=(0.8, 0.8, 0), rotation=(0, 0, math.pi * 0.35))
        dark.append(dish)
    return {"metal": metal, "dark": dark, "emissive": emissive}


def debris_chunk(lod: int, rng: np.random.Generator) -> dict[str, list[trimesh.Trimesh]]:
    count = 22 if lod == 0 else 12 if lod == 1 else 7
    points = rng.normal(0.0, 1.0, (count, 3))
    points *= np.asarray((2.7, 2.2, 2.8))
    hull = trimesh.convex.convex_hull(points)
    metal = [hull]
    dark: list[trimesh.Trimesh] = []
    emissive: list[trimesh.Trimesh] = []
    plate_count = 5 if lod == 0 else 2 if lod == 1 else 0
    for index in range(plate_count):
        angle = index * 1.37
        dark.append(transform(rounded_prism((1.7, 0.18, 1.1), 0.14, 2), translation=(math.cos(angle) * 1.7, math.sin(angle * 0.7) * 0.9, math.sin(angle) * 1.7), rotation=(angle * 0.3, angle, angle * 0.17)))
    if lod < 2:
        emissive.append(box_mesh((0.12, 1.6, 0.12), (1.3, 0.2, 1.5)))
    return {"metal": metal, "dark": dark, "emissive": emissive}


def far_cluster(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    cfg = LOD[lod]
    metal: list[trimesh.Trimesh] = []
    dark: list[trimesh.Trimesh] = []
    emissive: list[trimesh.Trimesh] = []
    cluster = (
        (-7.0, -7.0, -3.0, 5.0, 26.0, 5.0),
        (0.5, -2.0, 1.0, 7.0, 38.0, 6.0),
        (7.0, -9.0, 2.0, 4.5, 22.0, 4.5),
        (3.0, -12.0, -5.0, 3.6, 15.0, 3.6),
    )
    limit = 4 if lod == 0 else 3 if lod == 1 else 2
    for index, (x, y, z, w, h, d) in enumerate(cluster[:limit]):
        metal.append(transform(rounded_prism((w, h, d), min(w, d) * 0.1, cfg["round_segments"]), translation=(x, y + h * 0.5 - 15.0, z), rotation=(0, (index - 1.5) * 0.05, (index - 1) * 0.025)))
        emissive.append(box_mesh((0.12, h * 0.52, 0.12), (x + w * 0.48, y + h * 0.5 - 15.0, z + d * 0.5)))
    return {"metal": metal, "dark": dark, "emissive": emissive}
