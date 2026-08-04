#!/usr/bin/env python3
"""Generate the deterministic Shattered Vertical City modular environment kit."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh

from city_asset_assembly import build_asset
from city_environment_contract import ASSETS, SEED
from city_geometry import materials
from city_texture_authoring import generate_trim_textures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()

    texture_dir = args.repo / "content/source/textures/city-environment"
    model_dir = args.repo / "apps/game/public/assets/models"
    manifest_dir = args.repo / "content/manifests"
    model_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(SEED)
    print("[city-kit] generating trim textures", flush=True)
    textures = generate_trim_textures(texture_dir, rng)
    print("[city-kit] trim textures ready", flush=True)
    mats = materials(textures)
    scene = trimesh.Scene(base_frame="SHATTERED_VERTICAL_CITY_KIT")
    records = []
    for spec in ASSETS:
        for lod in (0, 1, 2):
            print(f"[city-kit] building {spec.kind} LOD{lod}", flush=True)
            records.append(build_asset(scene, spec, lod, mats, rng))

    scene.metadata.update({
        "assetId": "city-environment-kit-v1",
        "units": "metres",
        "forwardAxis": "+X",
        "upAxis": "+Y",
        "generator": "tools/asset-authoring/generate_city_environment.py",
        "texturePolicy": "shared architecture trim; project-owned deterministic source",
    })
    output = model_dir / "city-environment-kit.glb"
    print("[city-kit] exporting GLB", flush=True)
    scene.export(output)
    print("[city-kit] GLB exported", flush=True)

    loaded = trimesh.load(output, force="scene")
    metrics = {
        "assetId": "city-environment-kit-v1",
        "runtimePath": "/assets/models/city-environment-kit.glb",
        "sourceGenerator": "tools/asset-authoring/generate_city_environment.py",
        "fileBytes": output.stat().st_size,
        "meshCount": len(loaded.geometry),
        "materialCount": len({getattr(getattr(mesh.visual, "material", None), "name", "") for mesh in loaded.geometry.values()}),
        "assets": records,
        "requiredNodes": [f"environment_{spec.kind}_lod{lod}" for spec in ASSETS for lod in (0, 1, 2)],
        "textureSources": [
            "content/source/textures/city-environment/city-architecture-trim-basecolor.png",
            "content/source/textures/city-environment/city-architecture-trim-normal.png",
            "content/source/textures/city-environment/city-architecture-trim-orm.png",
            "content/source/textures/city-environment/city-architecture-trim-emissive.png",
            "content/source/textures/city-environment/city-decal-atlas.png",
        ],
        "license": "Project-owned original procedural asset",
    }
    (manifest_dir / "city-environment-kit.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
