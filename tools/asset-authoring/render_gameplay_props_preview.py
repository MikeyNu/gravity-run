#!/usr/bin/env python3
"""Render an orthographic contact sheet for gameplay prop silhouette review."""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import trimesh

ASSETS = (
    ("SPIRE", "hazard_spire_lod0"),
    ("BLADE", "hazard_blade_lod0"),
    ("DEBRIS", "hazard_debris_lod0"),
    ("COLLAPSE GATE", "hazard_collapse-gate_lod0"),
    ("FRAGMENT", "pickup_fragment_lod0"),
)


def material_color(name: str) -> tuple[float, float, float, float]:
    if "warning" in name:
        return (1.0, 0.24, 0.035, 0.94)
    if "cool" in name:
        return (0.18, 0.76, 1.0, 0.94)
    if "crystal" in name:
        return (1.0, 0.61, 0.07, 0.96)
    return (0.17, 0.21, 0.28, 0.98)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    model = args.repo / "apps/game/public/assets/models/gameplay-props.glb"
    output = args.repo / "docs/qa/gameplay-props-preview.png"
    scene = trimesh.load(model, force="scene")

    figure = plt.figure(figsize=(18, 5), dpi=160)
    figure.patch.set_facecolor("#06080d")
    for index, (label, prefix) in enumerate(ASSETS, 1):
        axis = figure.add_subplot(1, len(ASSETS), index, projection="3d")
        axis.set_facecolor("#06080d")
        all_vertices: list[np.ndarray] = []
        for name, mesh in scene.geometry.items():
            if not name.startswith(prefix) or name.endswith("_COLLISION") or name.endswith("_OCCLUSION"):
                continue
            vertices = np.asarray(mesh.vertices)
            all_vertices.append(vertices)
            material_name = getattr(getattr(mesh.visual, "material", None), "name", "") or ""
            faces = vertices[np.asarray(mesh.faces)]
            collection = Poly3DCollection(
                faces,
                facecolor=material_color(material_name),
                edgecolor=(0.5, 0.62, 0.75, 0.14),
                linewidth=0.15,
            )
            axis.add_collection3d(collection)

        if all_vertices:
            vertices = np.vstack(all_vertices)
            minimum = vertices.min(axis=0)
            maximum = vertices.max(axis=0)
            centre = (minimum + maximum) * 0.5
            span = max(maximum - minimum) * 0.58
            axis.set_xlim(centre[0] - span, centre[0] + span)
            axis.set_ylim(centre[1] - span, centre[1] + span)
            axis.set_zlim(centre[2] - span, centre[2] + span)
        axis.view_init(elev=18, azim=-58)
        axis.set_proj_type("ortho")
        axis.set_axis_off()
        axis.set_title(label, color="#e9edf3", fontsize=10, fontweight="bold", pad=5)

    plt.tight_layout(pad=0.5)
    output.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output, bbox_inches="tight", facecolor=figure.get_facecolor())
    print(output)


if __name__ == "__main__":
    main()
