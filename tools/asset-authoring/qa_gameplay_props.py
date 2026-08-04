#!/usr/bin/env python3
"""Structural, UV, texture and budget QA for gameplay hazards and pickups."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
import trimesh

TRIANGLE_LIMITS = {0: 15000, 1: 6000, 2: 1800}
TRANSFER_LIMIT_BYTES = 4_500_000
EXPECTED_TEXTURES = {
    "gameplay-metal-basecolor.png": ((1024, 1024), "RGBA"),
    "gameplay-metal-normal.png": ((1024, 1024), "RGB"),
    "gameplay-metal-orm.png": ((1024, 1024), "RGB"),
    "gameplay-emissive-mask.png": ((1024, 1024), "RGB"),
    "fragment-crystal-basecolor.png": ((1024, 1024), "RGBA"),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()

    model_path = args.repo / "apps/game/public/assets/models/gameplay-props.glb"
    manifest_path = args.repo / "content/manifests/gameplay-props.json"
    scene = trimesh.load(model_path, force="scene")
    manifest = json.loads(manifest_path.read_text())
    failures: list[str] = []
    warnings: list[str] = []
    geometry_names = set(scene.geometry.keys())
    report: dict[str, object] = {
        "assetId": manifest.get("assetId"),
        "model": str(model_path),
        "fileBytes": model_path.stat().st_size,
        "meshCount": len(scene.geometry),
        "uvMeshes": 0,
        "nonFiniteMeshes": [],
        "degenerateMeshes": [],
        "bounds": np.asarray(scene.bounds).round(5).tolist(),
        "nodeChecks": {},
        "failures": failures,
        "warnings": warnings,
    }

    if model_path.stat().st_size > TRANSFER_LIMIT_BYTES:
        failures.append(
            f"GLB exceeds source transfer budget: {model_path.stat().st_size} > {TRANSFER_LIMIT_BYTES}"
        )

    for name, mesh in scene.geometry.items():
        if not np.isfinite(mesh.vertices).all():
            failures.append(f"{name}: non-finite vertex")
            report["nonFiniteMeshes"].append(name)  # type: ignore[index]
        if len(mesh.faces) and np.any(mesh.area_faces <= 1e-11):
            failures.append(f"{name}: degenerate faces")
            report["degenerateMeshes"].append(name)  # type: ignore[index]
        if name.endswith("_COLLISION") or name.endswith("_OCCLUSION"):
            continue
        uv = getattr(mesh.visual, "uv", None)
        if uv is None:
            failures.append(f"{name}: missing UV channel")
            continue
        report["uvMeshes"] = int(report["uvMeshes"]) + 1
        uv_array = np.asarray(uv)
        if len(uv_array) != len(mesh.vertices):
            failures.append(f"{name}: UV/vertex count mismatch")
        if not np.isfinite(uv_array).all():
            failures.append(f"{name}: non-finite UV")
        if uv_array.min() < -1e-4 or uv_array.max() > 1.0001:
            failures.append(f"{name}: UV outside normalized range")

    by_asset: dict[str, dict[int, int]] = {}
    node_checks: dict[str, object] = {}
    for record in manifest["assets"]:
        lod = int(record["lod"])
        triangles = int(record["triangles"])
        key = f"{record['category']}/{record['kind']}"
        prefix = str(record["nodePrefix"])
        by_asset.setdefault(key, {})[lod] = triangles
        if triangles > TRIANGLE_LIMITS[lod]:
            failures.append(
                f"{key} LOD{lod}: {triangles} triangles exceeds {TRIANGLE_LIMITS[lod]}"
            )

        render_nodes = [
            name
            for name in geometry_names
            if name.startswith(prefix)
            and not name.endswith("_COLLISION")
            and not name.endswith("_OCCLUSION")
        ]
        collision = f"{prefix}_COLLISION" in geometry_names
        occlusion = f"{prefix}_OCCLUSION" in geometry_names
        node_checks[prefix] = {
            "renderNodeCount": len(render_nodes),
            "collision": collision,
            "occlusion": occlusion,
        }
        if not render_nodes:
            failures.append(f"{prefix}: no render nodes")
        if not collision:
            failures.append(f"{prefix}: missing collision proxy")
        if not occlusion:
            failures.append(f"{prefix}: missing occlusion proxy")

    for key, values in by_asset.items():
        if set(values) != {0, 1, 2}:
            failures.append(f"{key}: missing LOD records {values}")
            continue
        if not (values[0] > values[1] > values[2]):
            failures.append(f"{key}: LOD triangle counts are not strictly decreasing: {values}")

    texture_dir = args.repo / "content/source/textures/gameplay-props"
    texture_report: dict[str, object] = {}
    for filename, (expected_size, expected_mode) in EXPECTED_TEXTURES.items():
        path = texture_dir / filename
        if not path.exists():
            failures.append(f"missing texture: {filename}")
            continue
        image = Image.open(path)
        texture_report[filename] = {
            "size": list(image.size),
            "mode": image.mode,
            "bytes": path.stat().st_size,
        }
        if image.size != expected_size:
            failures.append(f"{filename}: expected {expected_size}, received {image.size}")
        if image.mode != expected_mode:
            failures.append(f"{filename}: expected {expected_mode}, received {image.mode}")

    normal_path = texture_dir / "gameplay-metal-normal.png"
    if normal_path.exists():
        normal = np.asarray(Image.open(normal_path)).astype(np.float32) / 255.0 * 2.0 - 1.0
        magnitudes = np.linalg.norm(normal, axis=-1)
        mean_error = float(np.mean(np.abs(magnitudes - 1.0)))
        texture_report["gameplay-metal-normal.png"]["meanUnitLengthError"] = round(
            mean_error, 6
        )
        if mean_error > 0.035:
            failures.append(f"normal map unit-length error too high: {mean_error:.5f}")

    orm_path = texture_dir / "gameplay-metal-orm.png"
    if orm_path.exists():
        orm = np.asarray(Image.open(orm_path))
        channel_ranges = {
            name: [int(orm[..., index].min()), int(orm[..., index].max())]
            for index, name in enumerate(("ao", "roughness", "metallic"))
        }
        texture_report["gameplay-metal-orm.png"]["channelRanges"] = channel_ranges
        if channel_ranges["roughness"][0] == channel_ranges["roughness"][1]:
            failures.append("ORM roughness channel has no variation")

    report["textures"] = texture_report
    report["lodTriangles"] = by_asset
    report["nodeChecks"] = node_checks

    output = args.repo / "docs/qa/gameplay-props-qa.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
