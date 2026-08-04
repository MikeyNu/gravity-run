#!/usr/bin/env python3
"""Generate the deterministic Gravity Run hazard and pickup asset family."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh

from gameplay_prop_builders import build_asset
from gameplay_prop_contract import ASSETS, SEED
from gameplay_prop_geometry import materials
from gameplay_prop_texture_authoring import generate_textures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()

    texture_dir = args.repo / "content/source/textures/gameplay-props"
    model_dir = args.repo / "apps/game/public/assets/models"
    manifest_dir = args.repo / "content/manifests"
    model_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(SEED)
    textures = generate_textures(texture_dir, rng)
    mats = materials(textures)
    scene = trimesh.Scene(base_frame="GRAVITY_GAMEPLAY_PROPS")
    records = [build_asset(scene, spec, lod, mats) for spec in ASSETS for lod in (0, 1, 2)]
    scene.metadata.update({
        "assetId": "gameplay-props-v1",
        "units": "metres",
        "forwardAxis": "+X",
        "upAxis": "+Y",
        "generator": "tools/asset-authoring/generate_gameplay_props.py",
    })

    output = model_dir / "gameplay-props.glb"
    scene.export(output)
    loaded = trimesh.load(output, force="scene")
    metrics = {
        "assetId": "gameplay-props-v1",
        "runtimePath": "/assets/models/gameplay-props.glb",
        "sourceGenerator": "tools/asset-authoring/generate_gameplay_props.py",
        "fileBytes": output.stat().st_size,
        "meshCount": len(loaded.geometry),
        "materialCount": len({
            getattr(mesh.visual.material, "name", "")
            for mesh in loaded.geometry.values()
            if hasattr(mesh.visual, "material")
        }),
        "assets": records,
        "requiredNodes": [f"{spec.category}_{spec.kind}_lod{lod}" for spec in ASSETS for lod in (0, 1, 2)],
        "license": "Project-owned original procedural asset",
    }
    (manifest_dir / "gameplay-props.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
