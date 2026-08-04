"""Reusable hard-surface geometry, UV and PBR material helpers."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


def rounded_prism(extents: tuple[float, float, float], radius: float, segments: int) -> trimesh.Trimesh:
    width, height, depth = extents
    radius = min(radius, width * 0.45, depth * 0.45)
    segments = max(1, int(segments))
    centres = (
        (width * 0.5 - radius, depth * 0.5 - radius, 0.0),
        (-width * 0.5 + radius, depth * 0.5 - radius, math.pi * 0.5),
        (-width * 0.5 + radius, -depth * 0.5 + radius, math.pi),
        (width * 0.5 - radius, -depth * 0.5 + radius, math.pi * 1.5),
    )
    ring: list[tuple[float, float]] = []
    for cx, cz, start_angle in centres:
        for step in range(segments + 1):
            angle = start_angle + (math.pi * 0.5) * (step / segments)
            point = (cx + math.cos(angle) * radius, cz + math.sin(angle) * radius)
            if not ring or np.linalg.norm(np.asarray(point) - np.asarray(ring[-1])) > 1e-8:
                ring.append(point)
    if np.linalg.norm(np.asarray(ring[0]) - np.asarray(ring[-1])) <= 1e-8:
        ring.pop()

    vertices: list[tuple[float, float, float]] = []
    for y in (-height * 0.5, height * 0.5):
        vertices.extend((x, y, z) for x, z in ring)
    bottom_centre = len(vertices)
    vertices.append((0.0, -height * 0.5, 0.0))
    top_centre = len(vertices)
    vertices.append((0.0, height * 0.5, 0.0))

    count = len(ring)
    faces: list[tuple[int, int, int]] = []
    for index in range(count):
        nxt = (index + 1) % count
        bottom_a, bottom_b = index, nxt
        top_a, top_b = index + count, nxt + count
        faces.extend(((bottom_a, bottom_b, top_b), (bottom_a, top_b, top_a)))
        faces.append((bottom_centre, bottom_b, bottom_a))
        faces.append((top_centre, top_a, top_b))

    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=True)
    mesh.fix_normals()
    return mesh


def box_mesh(extents: tuple[float, float, float], centre: tuple[float, float, float]) -> trimesh.Trimesh:
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(centre)
    return mesh


def cylinder_mesh(radius: float, height: float, centre: tuple[float, float, float], sections: int, axis: str = "y") -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=max(6, sections))
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi * 0.5, [1, 0, 0]))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi * 0.5, [0, 1, 0]))
    mesh.apply_translation(centre)
    return mesh


def beam_between(start: tuple[float, float, float], end: tuple[float, float, float], thickness: tuple[float, float]) -> trimesh.Trimesh:
    a = np.asarray(start, dtype=np.float64)
    b = np.asarray(end, dtype=np.float64)
    delta = b - a
    length = float(np.linalg.norm(delta))
    mesh = trimesh.creation.box(extents=(length, thickness[0], thickness[1]))
    transform = trimesh.geometry.align_vectors([1.0, 0.0, 0.0], delta / max(length, 1e-8))
    transform[:3, 3] = (a + b) * 0.5
    mesh.apply_transform(transform)
    return mesh


def transform(mesh: trimesh.Trimesh, translation=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0)) -> trimesh.Trimesh:
    result = mesh.copy()
    matrix = trimesh.transformations.euler_matrix(*rotation, axes="sxyz")
    matrix[:3, :3] = matrix[:3, :3] @ np.diag(scale)
    matrix[:3, 3] = translation
    result.apply_transform(matrix)
    return result


def box_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = np.asarray(mesh.vertices)
    extent = np.maximum(np.ptp(vertices, axis=0), 1e-8)
    normalized = (vertices - vertices.min(axis=0)) / extent
    thin_axis = int(np.argmin(extent))
    axes = [axis for axis in range(3) if axis != thin_axis]
    return normalized[:, axes]


def cylindrical_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = np.asarray(mesh.vertices)
    theta = (np.arctan2(vertices[:, 2], vertices[:, 0]) / (2 * math.pi) + 0.5) % 1.0
    minimum, maximum = float(vertices[:, 1].min()), float(vertices[:, 1].max())
    v = (vertices[:, 1] - minimum) / max(maximum - minimum, 1e-8)
    return np.column_stack((theta, v))


def materialize(mesh: trimesh.Trimesh, material: PBRMaterial, uv_mode: str = "box") -> trimesh.Trimesh:
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    uv = cylindrical_uv(mesh) if uv_mode == "cylindrical" else box_uv(mesh)
    mesh.visual = TextureVisuals(uv=uv, material=material)
    return mesh


def materials(textures: dict[str, Image.Image]) -> dict[str, PBRMaterial]:
    return {
        "metal": PBRMaterial(
            name="city_architecture_metal",
            baseColorFactor=(0.28, 0.32, 0.38, 1.0),
            baseColorTexture=textures["base"],
            metallicFactor=0.88,
            roughnessFactor=0.42,
            metallicRoughnessTexture=textures["orm"],
            occlusionTexture=textures["orm"],
            normalTexture=textures["normal"],
        ),
        "dark": PBRMaterial(
            name="city_dark_alloy",
            baseColorFactor=(0.08, 0.11, 0.16, 1.0),
            baseColorTexture=textures["base"],
            metallicFactor=0.72,
            roughnessFactor=0.57,
            metallicRoughnessTexture=textures["orm"],
            normalTexture=textures["normal"],
        ),
        "emissive": PBRMaterial(
            name="city_cool_emissive",
            baseColorFactor=(0.12, 0.58, 0.88, 1.0),
            emissiveFactor=(0.16, 0.72, 1.0),
            emissiveTexture=textures["emissive"],
            metallicFactor=0.12,
            roughnessFactor=0.18,
        ),
        "warning": PBRMaterial(
            name="city_warning_emissive",
            baseColorFactor=(1.0, 0.35, 0.06, 1.0),
            emissiveFactor=(1.0, 0.24, 0.035),
            metallicFactor=0.18,
            roughnessFactor=0.23,
        ),
    }
