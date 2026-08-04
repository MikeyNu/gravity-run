#!/usr/bin/env python3
"""Quality gate for the generated hazard and pickup family."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
import trimesh

TRIANGLE_LIMITS = {0: 15000, 1: 6000, 2: 1800}
TRANSFER_LIMIT_BYTES = 4_500_000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()

    model_path = args.repo / "apps/game/public/assets/models/gameplay-props.glb"
    manifest_path = args.repo / "content/manifests/gameplay-props.json"
    scene = trimesh.load(model_path, force="scene")
    manifest = json.loads(manifest_path.read_text())
    failures: list[str] = []
    report: dict[str, object] = {
        "model": str(model_path),
        "fileBytes": model_path.stat().st_size,
        "meshCount": len(scene.geometry),
        "uvMeshes": 0,
        "nonFiniteMeshes": [],
        "degenerateMeshes": [],
        "bounds": np.asarray(scene.bounds).round(5).tolist(),
    }

    if model_path.stat().st_size > TRANSFER_LIMIT_BYTES:
        failures.append(f"GLB exceeds source transfer budget: {model_path.stat().st_size} > {TRANSFER_LIMIT_BYTES}")

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
        if len(uv) != len(mesh.vertices):
            failures.append(f"{name}: UV/vertex count mismatch")
        if not np.isfinite(uv).all():
            failures.append(f"{name}: non-finite UV")
        if uv.min() < -1e-4 or uv.max() > 1.0001:
            failures.append(f"{name}: UV outside normalized range")

    by_asset: dict[str, dict[int, int]] = {}
    for record in manifest["assets"]:
        lod = int(record["lod"])
        triangles = int(record["triangles"])
        key = f"{record['category']}/{record['kind']}"
        by_asset.setdefault(key, {})[lod] = triangles
        if triangles > TRIANGLE_LIMITS[lod]:
            failures.append(f"{key} LOD{lod}: {triangles} triangles exceeds {TRIANGLE_LIMITS[lod]}")
    for key, values in by_asset.items():
        if not (values[0] > values[1] > values[2]):
            failures.append(f"{key}: LOD triangle counts are not strictly decreasing: {values}")

    texture_dir = args.repo / "content/source/textures/gameplay-props"
    required = {
        "gameplay-metal-basecolor.png": (1024, 1024),
        "gameplay-metal-normal.png": (1024, 1024),
        "gameplay-metal-orm.png": (1024, 1024),
        "gameplay-emissive-mask.png": (1024, 1024),
        "fragment-crystal-basecolor.png": (1024, 1024),
    }
    texture_report = {}
    for filename, expected_size in required.items():
        path = texture_dir / filename
        if not path.exists():
            failures.append(f"missing texture: {filename}")
            continue
        image = Image.open(path)
        texture_report[filename] = {"size": image.size, "mode": image.mode, "bytes": path.stat().st_size}
        if image.size != expected_size:
            failures.append(f"{filename}: expected {expected_size}, received {image.size}")
    report["textures"] = texture_report
    report["lodTriangles"] = by_asset
    report["failures"] = failures

    output = args.repo / "docs/qa/gameplay-props-qa.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
