#!/usr/bin/env python3
"""Generate the Gravity Run gravity-well family as a validated glTF binary.

The generator creates authored hard-surface assemblies, not random runtime primitives. Each
variant has three intentional LODs, stable node names, cylindrical/box UVs, shared PBR maps,
and collision/occlusion proxies. The output is deterministic and suitable for further art
refinement in Blender without changing runtime identifiers.
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

SEED = 0x47525659
RNG = np.random.default_rng(SEED)


@dataclass(frozen=True)
class Variant:
    name: str
    accent: tuple[int, int, int]
    dark: tuple[int, int, int]
    panel_count: int
    strut_count: int
    fin_scale: float
    core_scale: float


VARIANTS = (
    Variant("standard", (82, 205, 255), (25, 39, 55), 12, 6, 0.92, 1.00),
    Variant("accelerator", (255, 174, 58), (61, 39, 21), 16, 8, 1.28, 1.15),
    Variant("precision", (194, 126, 255), (44, 26, 66), 14, 7, 0.72, 0.86),
    Variant("recovery", (84, 255, 194), (22, 58, 49), 10, 5, 1.05, 1.28),
)

LOD = {
    0: {"major": 96, "minor": 16, "cylinder": 64, "sphere": 32, "decor": 1.0},
    1: {"major": 56, "minor": 10, "cylinder": 32, "sphere": 18, "decor": 0.65},
    2: {"major": 28, "minor": 6, "cylinder": 16, "sphere": 10, "decor": 0.35},
}


def _normal_from_height(height: np.ndarray, strength: float = 3.0) -> Image.Image:
    dy, dx = np.gradient(height.astype(np.float32) / 255.0)
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(nx)
    magnitude = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / magnitude, ny / magnitude, nz / magnitude), axis=-1)
    normal = ((normal * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(normal, "RGB")


def generate_textures(output: Path, size: int = 1024) -> dict[str, Image.Image]:
    output.mkdir(parents=True, exist_ok=True)
    yy, xx = np.mgrid[0:size, 0:size]
    brushed = 0.5 + 0.5 * np.sin(xx * 0.34 + np.sin(yy * 0.013) * 2.2)
    fine_noise = RNG.normal(0.0, 1.0, (size, size))
    fine_noise = np.asarray(Image.fromarray(((fine_noise - fine_noise.min()) / np.ptp(fine_noise) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.65))) / 255.0
    height = (110 + brushed * 22 + fine_noise * 28).clip(0, 255).astype(np.uint8)

    base = np.zeros((size, size, 4), dtype=np.uint8)
    base[..., 0] = (42 + brushed * 18 + fine_noise * 10).clip(0, 255)
    base[..., 1] = (49 + brushed * 17 + fine_noise * 9).clip(0, 255)
    base[..., 2] = (58 + brushed * 15 + fine_noise * 8).clip(0, 255)
    base[..., 3] = 255
    base_image = Image.fromarray(base, "RGBA")
    draw = ImageDraw.Draw(base_image, "RGBA")

    # Repeating structural seams and recessed panel channels. Widths are mip-safe.
    for offset in range(0, size, size // 8):
        draw.rectangle((offset + 4, 0, offset + 9, size), fill=(10, 14, 20, 180))
        draw.line((offset + 12, 0, offset + 12, size), fill=(118, 129, 142, 65), width=2)
    for offset in range(0, size, size // 4):
        draw.rectangle((0, offset + 5, size, offset + 10), fill=(12, 16, 22, 145))

    # Sparse directional scratches; bounded to remain plausible under tiling.
    for _ in range(180):
        x = int(RNG.integers(0, size))
        y = int(RNG.integers(0, size))
        length = int(RNG.integers(size // 80, size // 22))
        alpha = int(RNG.integers(10, 36))
        draw.line((x, y, min(size - 1, x + length), y + int(RNG.integers(-2, 3))), fill=(196, 202, 208, alpha), width=1)

    base_image.save(output / "well-painted-metal-basecolor.png", optimize=True)
    normal = _normal_from_height(height)
    normal.save(output / "well-painted-metal-normal.png", optimize=True)

    # glTF metallic-roughness: G=roughness, B=metalness. R is retained as AO so the
    # same image can be referenced by the occlusion slot with an independent sampler.
    orm = np.zeros((size, size, 3), dtype=np.uint8)
    orm[..., 0] = (205 - fine_noise * 35).clip(0, 255)  # AO
    orm[..., 1] = (92 + fine_noise * 62 + brushed * 24).clip(0, 255)  # roughness
    orm[..., 2] = 224  # metallic
    orm_image = Image.fromarray(orm, "RGB")
    orm_image.save(output / "well-painted-metal-orm.png", optimize=True)

    emissive = Image.new("RGB", (size, size), (0, 0, 0))
    edraw = ImageDraw.Draw(emissive)
    band = size // 20
    for i in range(0, size, size // 8):
        edraw.rectangle((i, 0, min(size, i + band), size), fill=(255, 255, 255))
    emissive = emissive.filter(ImageFilter.GaussianBlur(0.8))
    emissive.save(output / "well-emissive-mask.png", optimize=True)

    return {
        "base": base_image,
        "normal": normal,
        "orm": orm_image,
        "emissive": emissive,
    }


def cylindrical_uv(mesh: trimesh.Trimesh, radius_reference: float | None = None) -> np.ndarray:
    vertices = mesh.vertices
    theta = (np.arctan2(vertices[:, 1], vertices[:, 0]) / (2.0 * math.pi) + 0.5) % 1.0
    radial = np.sqrt(vertices[:, 0] ** 2 + vertices[:, 1] ** 2)
    if radius_reference is None:
        minimum, maximum = float(vertices[:, 2].min()), float(vertices[:, 2].max())
        v = (vertices[:, 2] - minimum) / max(maximum - minimum, 1e-8)
    else:
        phi = np.arctan2(vertices[:, 2], radial - radius_reference)
        v = (phi / (2.0 * math.pi) + 0.5) % 1.0
    return np.column_stack((theta, v))


def box_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = mesh.vertices
    scale = np.maximum(np.ptp(vertices, axis=0), 1e-8)
    normalized = (vertices - vertices.min(axis=0)) / scale
    # Dominant planar projection chosen by local thickness.
    thin_axis = int(np.argmin(scale))
    axes = [axis for axis in range(3) if axis != thin_axis]
    return normalized[:, axes]


def apply_material(mesh: trimesh.Trimesh, material: PBRMaterial, uv: np.ndarray) -> trimesh.Trimesh:
    mesh.visual = TextureVisuals(uv=uv, material=material)
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    return mesh


def transform_between(start: np.ndarray, end: np.ndarray, thickness: tuple[float, float]) -> trimesh.Trimesh:
    delta = end - start
    length = float(np.linalg.norm(delta))
    box = trimesh.creation.box(extents=(length, thickness[0], thickness[1]))
    direction = delta / max(length, 1e-8)
    quaternion = trimesh.transformations.quaternion_from_matrix(
        trimesh.geometry.align_vectors([1.0, 0.0, 0.0], direction)
    )
    transform = trimesh.transformations.quaternion_matrix(quaternion)
    transform[:3, 3] = (start + end) * 0.5
    box.apply_transform(transform)
    return box


def radial_panel(inner: float, outer: float, angle: float, arc: float, depth: float) -> trimesh.Trimesh:
    # Eight-vertex extruded annular wedge with clean quad-derived triangles.
    points = []
    for z in (-depth * 0.5, depth * 0.5):
        for radius, offset in ((inner, -arc), (outer, -arc), (outer, arc), (inner, arc)):
            points.append((radius * math.cos(angle + offset), radius * math.sin(angle + offset), z))
    faces = [
        (0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6),
        (0, 4, 5), (0, 5, 1), (1, 5, 6), (1, 6, 2),
        (2, 6, 7), (2, 7, 3), (3, 7, 4), (3, 4, 0),
    ]
    return trimesh.Trimesh(vertices=np.asarray(points), faces=np.asarray(faces), process=True)


def create_materials(variant: Variant, textures: dict[str, Image.Image]) -> dict[str, PBRMaterial]:
    accent = tuple(channel / 255.0 for channel in variant.accent)
    dark = tuple(channel / 255.0 for channel in variant.dark)
    return {
        "metal": PBRMaterial(
            name=f"{variant.name}_painted_metal",
            baseColorFactor=(*dark, 1.0),
            baseColorTexture=textures["base"],
            metallicFactor=0.88,
            roughnessFactor=0.34,
            metallicRoughnessTexture=textures["orm"],
            occlusionTexture=textures["orm"],
            normalTexture=textures["normal"],
        ),
        "bare": PBRMaterial(
            name=f"{variant.name}_bare_alloy",
            baseColorFactor=(0.18, 0.21, 0.25, 1.0),
            metallicFactor=0.96,
            roughnessFactor=0.23,
            baseColorTexture=textures["base"],
            metallicRoughnessTexture=textures["orm"],
            normalTexture=textures["normal"],
        ),
        "emissive": PBRMaterial(
            name=f"{variant.name}_energy",
            baseColorFactor=(*accent, 1.0),
            emissiveFactor=accent,
            emissiveTexture=textures["emissive"],
            metallicFactor=0.18,
            roughnessFactor=0.18,
        ),
        "glass": PBRMaterial(
            name=f"{variant.name}_aperture_glass",
            baseColorFactor=(*accent, 0.76),
            emissiveFactor=tuple(min(1.0, value * 1.35) for value in accent),
            metallicFactor=0.08,
            roughnessFactor=0.08,
            alphaMode="BLEND",
            doubleSided=True,
        ),
    }


def add_mesh(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str, material: PBRMaterial, uv: np.ndarray) -> None:
    mesh.metadata["asset_part"] = name
    mesh = apply_material(mesh, material, uv)
    scene.add_geometry(mesh, node_name=name, geom_name=name)


def build_variant(scene: trimesh.Scene, variant: Variant, lod: int, textures: dict[str, Image.Image]) -> dict[str, int | float | str]:
    config = LOD[lod]
    materials = create_materials(variant, textures)
    prefix = f"well_{variant.name}_lod{lod}"
    triangle_count = 0

    outer = trimesh.creation.torus(1.19, 0.15, major_sections=config["major"], minor_sections=config["minor"])
    add_mesh(scene, outer, f"{prefix}_outer_ring", materials["metal"], cylindrical_uv(outer, 1.19))
    triangle_count += len(outer.faces)

    rotor = trimesh.creation.torus(0.81, 0.075, major_sections=max(24, config["major"] // 2), minor_sections=max(5, config["minor"] // 2))
    add_mesh(scene, rotor, f"{prefix}_inner_rotor", materials["bare"], cylindrical_uv(rotor, 0.81))
    triangle_count += len(rotor.faces)

    aperture = trimesh.creation.cylinder(radius=0.45 * variant.core_scale, height=0.13, sections=config["cylinder"])
    add_mesh(scene, aperture, f"{prefix}_aperture", materials["glass"], cylindrical_uv(aperture))
    triangle_count += len(aperture.faces)

    core = trimesh.creation.icosphere(subdivisions=3 if lod == 0 else 2 if lod == 1 else 1, radius=0.17 * variant.core_scale)
    add_mesh(scene, core, f"{prefix}_core", materials["emissive"], cylindrical_uv(core))
    triangle_count += len(core.faces)

    # Radial load-bearing members with consistent naming and UV projection.
    for index in range(max(3, int(variant.strut_count * config["decor"]))):
        angle = 2.0 * math.pi * index / max(3, int(variant.strut_count * config["decor"]))
        start = np.array([0.50 * math.cos(angle), 0.50 * math.sin(angle), 0.0])
        end = np.array([1.02 * math.cos(angle), 1.02 * math.sin(angle), 0.0])
        strut = transform_between(start, end, (0.075, 0.075))
        add_mesh(scene, strut, f"{prefix}_strut_{index:02d}", materials["bare"], box_uv(strut))
        triangle_count += len(strut.faces)

    panel_count = max(6, int(variant.panel_count * config["decor"]))
    for index in range(panel_count):
        angle = 2.0 * math.pi * index / panel_count
        panel = radial_panel(1.28, 1.52 * variant.fin_scale, angle, math.pi / panel_count * 0.31, 0.18)
        z_offset = 0.035 * math.sin(index * 2.3)
        panel.apply_translation((0.0, 0.0, z_offset))
        add_mesh(scene, panel, f"{prefix}_armour_{index:02d}", materials["metal"], box_uv(panel))
        triangle_count += len(panel.faces)

    # Accent clamps and fasteners are retained only where their projected size warrants them.
    clamp_count = max(4, int(12 * config["decor"]))
    for index in range(clamp_count):
        angle = 2.0 * math.pi * index / clamp_count + math.pi / clamp_count
        radius = 1.12
        clamp = trimesh.creation.cylinder(radius=0.045, height=0.22, sections=max(8, config["minor"]))
        clamp.apply_translation((radius * math.cos(angle), radius * math.sin(angle), 0.0))
        add_mesh(scene, clamp, f"{prefix}_fastener_{index:02d}", materials["emissive"], cylindrical_uv(clamp))
        triangle_count += len(clamp.faces)

    if variant.name == "accelerator":
        for index in range(max(3, int(6 * config["decor"]))):
            angle = 2.0 * math.pi * index / max(3, int(6 * config["decor"]))
            fin = radial_panel(1.50, 1.88, angle, 0.055, 0.12)
            add_mesh(scene, fin, f"{prefix}_accelerator_fin_{index:02d}", materials["emissive"], box_uv(fin))
            triangle_count += len(fin.faces)
    elif variant.name == "precision":
        for index in range(max(2, int(4 * config["decor"]))):
            angle = math.pi * 0.25 + index * math.pi * 0.5
            antenna = transform_between(
                np.array([1.25 * math.cos(angle), 1.25 * math.sin(angle), 0.0]),
                np.array([1.72 * math.cos(angle), 1.72 * math.sin(angle), 0.0]),
                (0.035, 0.035),
            )
            add_mesh(scene, antenna, f"{prefix}_precision_antenna_{index:02d}", materials["emissive"], box_uv(antenna))
            triangle_count += len(antenna.faces)
    elif variant.name == "recovery":
        stabilizer = trimesh.creation.torus(1.62, 0.025, major_sections=max(24, config["major"] // 2), minor_sections=max(4, config["minor"] // 3))
        add_mesh(scene, stabilizer, f"{prefix}_recovery_stabilizer", materials["emissive"], cylindrical_uv(stabilizer, 1.62))
        triangle_count += len(stabilizer.faces)

    # Proxy nodes are included in the asset package but hidden by runtime convention.
    collision = trimesh.creation.cylinder(radius=0.48, height=0.22, sections=16)
    collision.visual.face_colors = [255, 0, 255, 30]
    collision.metadata.update({"proxy": "collision", "runtime_visible": False})
    scene.add_geometry(collision, node_name=f"{prefix}_COLLISION", geom_name=f"{prefix}_COLLISION")

    occlusion = trimesh.creation.cylinder(radius=1.54, height=0.24, sections=12)
    occlusion.visual.face_colors = [0, 255, 255, 20]
    occlusion.metadata.update({"proxy": "occlusion", "runtime_visible": False})
    scene.add_geometry(occlusion, node_name=f"{prefix}_OCCLUSION", geom_name=f"{prefix}_OCCLUSION")

    return {
        "variant": variant.name,
        "lod": lod,
        "triangles": triangle_count,
        "outerRadiusMetres": round(1.88 if variant.name == "accelerator" else 1.68, 3),
        "nodePrefix": prefix,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()

    texture_dir = args.repo / "content/source/textures/gravity-wells"
    model_dir = args.repo / "apps/game/public/assets/models"
    manifest_dir = args.repo / "content/manifests"
    model_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    textures = generate_textures(texture_dir)
    scene = trimesh.Scene(base_frame="GRAVITY_WELL_FAMILY")
    records = []
    for variant in VARIANTS:
        for lod in (0, 1, 2):
            records.append(build_variant(scene, variant, lod, textures))

    scene.metadata.update({
        "assetId": "gravity-well-family-v1",
        "units": "metres",
        "forwardAxis": "+Z",
        "upAxis": "+Y",
        "generator": "tools/asset-authoring/generate_gravity_wells.py",
    })
    output = model_dir / "gravity-well-family.glb"
    scene.export(output)

    loaded = trimesh.load(output, force="scene")
    metrics = {
        "assetId": "gravity-well-family-v1",
        "runtimePath": "/assets/models/gravity-well-family.glb",
        "sourceGenerator": "tools/asset-authoring/generate_gravity_wells.py",
        "fileBytes": output.stat().st_size,
        "meshCount": len(loaded.geometry),
        "materialCount": len({getattr(mesh.visual.material, "name", "") for mesh in loaded.geometry.values() if hasattr(mesh.visual, "material")}),
        "variants": records,
        "requiredNodes": [f"well_{variant.name}_lod{lod}" for variant in VARIANTS for lod in (0, 1, 2)],
        "license": "Project-owned original procedural asset",
    }
    (manifest_dir / "gravity-well-family.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
