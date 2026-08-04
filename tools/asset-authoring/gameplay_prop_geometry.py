"""Shared geometry, UV and material helpers for gameplay props."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


def cylindrical_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = mesh.vertices
    theta = (np.arctan2(vertices[:, 2], vertices[:, 0]) / (2 * math.pi) + 0.5) % 1.0
    minimum, maximum = float(vertices[:, 1].min()), float(vertices[:, 1].max())
    v = (vertices[:, 1] - minimum) / max(maximum - minimum, 1e-8)
    return np.column_stack((theta, v))


def spherical_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = mesh.vertices
    radius = np.linalg.norm(vertices, axis=1)
    safe = np.maximum(radius, 1e-8)
    u = (np.arctan2(vertices[:, 2], vertices[:, 0]) / (2 * math.pi) + 0.5) % 1.0
    v = np.arccos(np.clip(vertices[:, 1] / safe, -1, 1)) / math.pi
    return np.column_stack((u, v))


def box_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = mesh.vertices
    scale = np.maximum(np.ptp(vertices, axis=0), 1e-8)
    normalized = (vertices - vertices.min(axis=0)) / scale
    thin_axis = int(np.argmin(scale))
    axes = [axis for axis in range(3) if axis != thin_axis]
    return normalized[:, axes]


def apply_material(mesh: trimesh.Trimesh, material: PBRMaterial, uv: np.ndarray) -> trimesh.Trimesh:
    mesh.visual = TextureVisuals(uv=np.clip(uv, 0, 1), material=material)
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    return mesh


def add_mesh(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str, material: PBRMaterial, uv: np.ndarray) -> int:
    mesh.metadata["asset_part"] = name
    mesh = apply_material(mesh, material, uv)
    scene.add_geometry(mesh, node_name=name, geom_name=name)
    return int(len(mesh.faces))


def transform_between(start: np.ndarray, end: np.ndarray, thickness: tuple[float, float]) -> trimesh.Trimesh:
    delta = end - start
    length = float(np.linalg.norm(delta))
    mesh = trimesh.creation.box(extents=(length, thickness[0], thickness[1]))
    direction = delta / max(length, 1e-8)
    rotation = trimesh.geometry.align_vectors([1.0, 0.0, 0.0], direction)
    transform = np.eye(4) if rotation is None else rotation
    transform[:3, 3] = (start + end) * 0.5
    mesh.apply_transform(transform)
    return mesh


def materials(textures: dict[str, Image.Image]) -> dict[str, PBRMaterial]:
    return {
        "metal": PBRMaterial(
            name="gameplay_dark_alloy",
            baseColorFactor=(0.13, 0.15, 0.19, 1),
            baseColorTexture=textures["base"],
            metallicFactor=0.92,
            roughnessFactor=0.34,
            metallicRoughnessTexture=textures["orm"],
            occlusionTexture=textures["orm"],
            normalTexture=textures["normal"],
        ),
        "warning": PBRMaterial(
            name="gameplay_warning_energy",
            baseColorFactor=(1.0, 0.27, 0.055, 1),
            emissiveFactor=(1.0, 0.08, 0.015),
            emissiveTexture=textures["emissive"],
            metallicFactor=0.25,
            roughnessFactor=0.2,
        ),
        "cool": PBRMaterial(
            name="gameplay_cool_energy",
            baseColorFactor=(0.2, 0.78, 1.0, 1),
            emissiveFactor=(0.04, 0.48, 1.0),
            emissiveTexture=textures["emissive"],
            metallicFactor=0.18,
            roughnessFactor=0.16,
        ),
        "crystal": PBRMaterial(
            name="fragment_crystal",
            baseColorFactor=(1.0, 0.64, 0.12, 1),
            baseColorTexture=textures["crystal"],
            emissiveFactor=(1.0, 0.23, 0.02),
            metallicFactor=0.08,
            roughnessFactor=0.13,
        ),
    }


def cone_between(radius: float, height: float, sections: int) -> trimesh.Trimesh:
    mesh = trimesh.creation.cone(radius=radius, height=height, sections=sections)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0]))
    return mesh
