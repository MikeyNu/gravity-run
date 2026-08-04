"""Near-architecture and route-module builders for the city kit."""
from __future__ import annotations

import math

import numpy as np
import trimesh

from city_environment_contract import LOD
from city_geometry import beam_between, box_mesh, cylinder_mesh, rounded_prism, transform


def tower_a(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    cfg = LOD[lod]
    metal = [rounded_prism((5.6, 24.0, 5.6), 0.55, cfg["round_segments"])]
    dark = [transform(rounded_prism((6.6, 3.4, 6.6), 0.42, cfg["round_segments"]), translation=(0, -8.5, 0)), transform(rounded_prism((6.2, 2.8, 6.2), 0.35, cfg["round_segments"]), translation=(0, 6.8, 0))]
    emissive: list[trimesh.Trimesh] = []
    rib_count = 9 if lod == 0 else 5 if lod == 1 else 2
    for index in range(rib_count):
        y = -8.0 + index * 2.0 * cfg["rib_step"]
        metal.append(box_mesh((6.4, 0.22, 6.4), (0, y, 0)))
    strip_count = 4 if lod < 2 else 2
    for index in range(strip_count):
        angle = index * math.tau / strip_count
        x, z = math.cos(angle) * 2.88, math.sin(angle) * 2.88
        strip = box_mesh((0.16, 15.2, 0.22), (x, 0.7, z))
        strip.apply_transform(trimesh.transformations.rotation_matrix(-angle, [0, 1, 0]))
        emissive.append(strip)
    if lod == 0:
        for side in (-1, 1):
            metal.append(transform(rounded_prism((1.1, 10.0, 3.0), 0.2, 3), translation=(side * 3.2, -1.0, 0), rotation=(0, 0, side * 0.045)))
    return {"metal": metal, "dark": dark, "emissive": emissive}


def tower_b(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    cfg = LOD[lod]
    metal = [rounded_prism((6.8, 30.0, 6.8), 0.62, cfg["round_segments"])]
    dark = [transform(rounded_prism((8.2, 5.4, 8.2), 0.48, cfg["round_segments"]), translation=(0, -10.8, 0))]
    emissive: list[trimesh.Trimesh] = []
    tiers = ((-5.0, 4.8), (4.8, 3.8), (10.4, 2.8)) if lod == 0 else ((-4.0, 4.6), (6.0, 3.4)) if lod == 1 else ((5.0, 3.2),)
    for y, size in tiers:
        metal.append(transform(rounded_prism((size + 4.8, 2.0, size + 3.0), 0.34, cfg["round_segments"]), translation=(0.8 if y > 0 else -0.5, y, 0)))
        emissive.append(box_mesh((size + 3.2, 0.18, 0.16), (0.8 if y > 0 else -0.5, y + 0.4, 3.45)))
    pod_count = 4 if lod == 0 else 2 if lod == 1 else 0
    for index in range(pod_count):
        side = -1 if index % 2 == 0 else 1
        y = -6 + index * 4.6
        metal.append(transform(rounded_prism((2.6, 3.5, 3.4), 0.28, cfg["round_segments"]), translation=(side * 4.6, y, (index - 1.5) * 0.5)))
        metal.append(beam_between((side * 3.2, y, 0), (side * 4.0, y, 0), (0.42, 0.42)))
    metal.append(cylinder_mesh(0.28, 6.5 if lod < 2 else 3.0, (0, 17.8 if lod < 2 else 16.0, 0), 16 if lod == 0 else 10))
    return {"metal": metal, "dark": dark, "emissive": emissive}


def broken_tower(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    cfg = LOD[lod]
    metal = [transform(rounded_prism((7.0, 22.0, 7.0), 0.58, cfg["round_segments"]), translation=(0, -7.0, 0))]
    dark: list[trimesh.Trimesh] = [transform(rounded_prism((8.2, 4.2, 8.2), 0.4, cfg["round_segments"]), translation=(0, -15.3, 0))]
    emissive: list[trimesh.Trimesh] = []
    shard_count = 8 if lod == 0 else 5 if lod == 1 else 3
    for index in range(shard_count):
        angle = index * math.tau / shard_count + 0.2
        radius = 1.4 + (index % 3) * 0.62
        height = 6.5 + (index % 4) * 1.8
        shard = rounded_prism((1.1 + (index % 2) * 0.45, height, 1.25), 0.16, max(1, cfg["round_segments"] - 1))
        shard = transform(shard, translation=(math.cos(angle) * radius, 6.0 + height * 0.5, math.sin(angle) * radius), rotation=((index % 3 - 1) * 0.12, angle * 0.3, (index % 2 - 0.5) * 0.16))
        metal.append(shard)
    if lod < 2:
        for side in (-1, 1):
            for depth in (-1, 1):
                dark.append(beam_between((side * 2.8, 1.5, depth * 2.8), (side * 4.8, 10.0, depth * 4.0), (0.32, 0.32)))
        emissive.append(box_mesh((0.22, 12.0, 0.22), (3.48, -5.5, 0)))
    return {"metal": metal, "dark": dark, "emissive": emissive}


def bridge_straight(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    cfg = LOD[lod]
    metal = [rounded_prism((18.0, 1.4, 5.2), 0.34, cfg["round_segments"])]
    dark = [box_mesh((19.0, 0.48, 0.48), (0, -0.95, -2.25)), box_mesh((19.0, 0.48, 0.48), (0, -0.95, 2.25))]
    emissive = [box_mesh((17.2, 0.08, 0.13), (0, 0.73, 0))]
    if lod < 2:
        bay_count = 8 if lod == 0 else 4
        for index in range(bay_count):
            x0 = -8.2 + index * (16.4 / bay_count)
            x1 = -8.2 + (index + 1) * (16.4 / bay_count)
            for z in (-2.48, 2.48):
                dark.append(beam_between((x0, -0.75, z), ((x0 + x1) * 0.5, 1.3, z), (0.22, 0.22)))
                dark.append(beam_between(((x0 + x1) * 0.5, 1.3, z), (x1, -0.75, z), (0.22, 0.22)))
        metal.extend([box_mesh((18.0, 0.18, 0.18), (0, 1.45, -2.48)), box_mesh((18.0, 0.18, 0.18), (0, 1.45, 2.48))])
    return {"metal": metal, "dark": dark, "emissive": emissive}


def platform_wide(lod: int) -> dict[str, list[trimesh.Trimesh]]:
    cfg = LOD[lod]
    metal = [rounded_prism((14.0, 1.6, 10.0), 0.75, cfg["round_segments"])]
    dark = [rounded_prism((10.5, 0.45, 6.5), 0.48, cfg["round_segments"])]
    dark[0].apply_translation((0, -1.0, 0))
    emissive = [box_mesh((12.0, 0.08, 0.14), (0, 0.83, -4.85)), box_mesh((12.0, 0.08, 0.14), (0, 0.83, 4.85))]
    if lod < 2:
        for x in (-5.2, 5.2):
            for z in (-3.5, 3.5):
                metal.append(cylinder_mesh(0.34, 3.6, (x, -2.6, z), 14 if lod == 0 else 10))
        if lod == 0:
            for x in (-3.5, 0, 3.5):
                dark.append(box_mesh((0.16, 0.12, 8.0), (x, 0.86, 0)))
    return {"metal": metal, "dark": dark, "emissive": emissive}
