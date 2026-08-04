#!/usr/bin/env python3
"""Deterministic structural and texture QA for the Shattered Vertical City kit."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
import trimesh

TRANSFER_LIMIT_BYTES = 12_000_000
TRIANGLE_LIMITS = {0: 50_000, 1: 20_000, 2: 6_000}
EXPECTED_TEXTURES = {
    "city-architecture-trim-basecolor.png": ((2048, 2048), "RGBA"),
    "city-architecture-trim-normal.png": ((2048, 2048), "RGB"),
    "city-architecture-trim-orm.png": ((2048, 2048), "RGB"),
    "city-architecture-trim-emissive.png": ((2048, 2048), "RGB"),
    "city-decal-atlas.png": ((2048, 2048), "RGBA"),
}


def edge_rms(image: np.ndarray) -> dict[str, float]:
    array = image.astype(np.float32) / 255.0
    horizontal = float(np.sqrt(np.mean((array[:, 0] - array[:, -1]) ** 2)))
    vertical = float(np.sqrt(np.mean((array[0] - array[-1]) ** 2)))
    return {"horizontal": round(horizontal, 6), "vertical": round(vertical, 6)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()

    model_path = args.repo / "apps/game/public/assets/models/city-environment-kit.glb"
    manifest_path = args.repo / "content/manifests/city-environment-kit.json"
    texture_dir = args.repo / "content/source/textures/city-environment"
    output_path = args.repo / "docs/qa/city-environment-kit-qa.json"

    manifest = json.loads(manifest_path.read_text())
    scene = trimesh.load(model_path, force="scene")
    failures: list[str] = []
    warnings: list[str] = []

    report: dict[str, object] = {
        "assetId": manifest.get("assetId"),
        "model": str(model_path),
        "fileBytes": model_path.stat().st_size,
        "meshCount": len(scene.geometry),
        "bounds": np.asarray(scene.bounds).round(5).tolist(),
        "uvMeshes": 0,
        "triangleCounts": {},
        "nodeChecks": {},
        "textures": {},
        "failures": failures,
        "warnings": warnings,
    }

    if model_path.stat().st_size > TRANSFER_LIMIT_BYTES:
        failures.append(f"GLB transfer budget exceeded: {model_path.stat().st_size} > {TRANSFER_LIMIT_BYTES}")

    geometry_names = set(scene.geometry.keys())
    for name, mesh in scene.geometry.items():
        vertices = np.asarray(mesh.vertices)
        if not np.isfinite(vertices).all():
            failures.append(f"{name}: non-finite vertex")
        if len(mesh.faces) and np.any(np.asarray(mesh.area_faces) <= 1e-11):
            failures.append(f"{name}: degenerate faces")
        if name.endswith("_COLLISION") or name.endswith("_OCCLUSION") or "_SOCKET_" in name:
            continue
        uv = getattr(mesh.visual, "uv", None)
        if uv is None:
            failures.append(f"{name}: missing UV channel")
            continue
        report["uvMeshes"] = int(report["uvMeshes"]) + 1
        uv_array = np.asarray(uv)
        if len(uv_array) != len(vertices):
            failures.append(f"{name}: UV/vertex count mismatch")
        if not np.isfinite(uv_array).all():
            failures.append(f"{name}: non-finite UV")
        if uv_array.min() < -1e-4 or uv_array.max() > 1.0001:
            failures.append(f"{name}: UV outside normalized range")

    by_asset: dict[str, dict[int, int]] = {}
    for record in manifest["assets"]:
        kind = str(record["kind"])
        lod = int(record["lod"])
        triangles = int(record["triangles"])
        by_asset.setdefault(kind, {})[lod] = triangles
        if triangles > TRIANGLE_LIMITS[lod]:
            failures.append(f"{kind} LOD{lod}: {triangles} triangles exceeds {TRIANGLE_LIMITS[lod]}")

        prefix = str(record["nodePrefix"])
        render_nodes = [name for name in geometry_names if name.startswith(prefix) and not name.endswith("_COLLISION") and not name.endswith("_OCCLUSION") and "_SOCKET_" not in name]
        collision = f"{prefix}_COLLISION" in geometry_names
        occlusion = f"{prefix}_OCCLUSION" in geometry_names
        socket_results = {socket: f"{prefix}_SOCKET_{socket}" in geometry_names for socket in record.get("sockets", [])}
        report["nodeChecks"][prefix] = {
            "renderNodeCount": len(render_nodes),
            "collision": collision,
            "occlusion": occlusion,
            "sockets": socket_results,
        }
        if not render_nodes:
            failures.append(f"{prefix}: no render nodes")
        if not collision:
            failures.append(f"{prefix}: missing collision proxy")
        if not occlusion:
            failures.append(f"{prefix}: missing occlusion proxy")
        for socket, present in socket_results.items():
            if not present:
                failures.append(f"{prefix}: missing socket {socket}")

    for kind, values in by_asset.items():
        if set(values) != {0, 1, 2}:
            failures.append(f"{kind}: missing LOD entries {values}")
            continue
        if not (values[0] > values[1] > values[2]):
            failures.append(f"{kind}: LOD triangles must strictly decrease: {values}")
    report["triangleCounts"] = by_asset

    texture_report: dict[str, object] = {}
    for filename, (expected_size, expected_mode) in EXPECTED_TEXTURES.items():
        path = texture_dir / filename
        if not path.exists():
            failures.append(f"missing texture: {filename}")
            continue
        image = Image.open(path)
        array = np.asarray(image)
        texture_report[filename] = {
            "size": list(image.size),
            "mode": image.mode,
            "bytes": path.stat().st_size,
            "edgeRms": edge_rms(array[..., :3] if array.ndim == 3 else array),
        }
        if image.size != expected_size:
            failures.append(f"{filename}: expected {expected_size}, received {image.size}")
        if image.mode != expected_mode:
            failures.append(f"{filename}: expected {expected_mode}, received {image.mode}")

    normal_path = texture_dir / "city-architecture-trim-normal.png"
    if normal_path.exists():
        normal = np.asarray(Image.open(normal_path)).astype(np.float32) / 255.0 * 2.0 - 1.0
        magnitudes = np.linalg.norm(normal, axis=-1)
        mean_error = float(np.mean(np.abs(magnitudes - 1.0)))
        texture_report["city-architecture-trim-normal.png"]["meanUnitLengthError"] = round(mean_error, 6)
        if mean_error > 0.035:
            failures.append(f"normal map unit-length error too high: {mean_error:.5f}")

    orm_path = texture_dir / "city-architecture-trim-orm.png"
    if orm_path.exists():
        orm = np.asarray(Image.open(orm_path))
        channel_ranges = {name: [int(orm[..., index].min()), int(orm[..., index].max())] for index, name in enumerate(("ao", "roughness", "metallic"))}
        texture_report["city-architecture-trim-orm.png"]["channelRanges"] = channel_ranges
        if channel_ranges["roughness"][0] == channel_ranges["roughness"][1]:
            failures.append("ORM roughness channel has no variation")

    report["textures"] = texture_report
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
