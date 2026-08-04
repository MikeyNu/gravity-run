#!/usr/bin/env python3
"""Render a headless orthographic contact sheet for city-kit silhouette review."""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import trimesh

ASSETS = (
    ("TOWER A", "environment_tower-a_lod0"),
    ("TOWER B", "environment_tower-b_lod0"),
    ("BROKEN TOWER", "environment_tower-broken_lod0"),
    ("BRIDGE", "environment_bridge-straight_lod0"),
    ("PLATFORM", "environment_platform-wide_lod0"),
    ("TRUSS", "environment_truss-support_lod0"),
    ("ANTENNA", "environment_antenna-cluster_lod0"),
    ("DEBRIS", "environment_debris-chunk-large_lod0"),
    ("FAR CLUSTER", "environment_far-cluster_lod0"),
)


def color(name: str) -> tuple[float, float, float, float]:
    if "emissive" in name:
        return (0.18, 0.73, 1.0, 0.98)
    if "dark" in name:
        return (0.08, 0.11, 0.16, 1.0)
    return (0.25, 0.31, 0.39, 1.0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    model = args.repo / "apps/game/public/assets/models/city-environment-kit.glb"
    output = args.repo / "docs/qa/city-environment-kit-preview.png"
    scene = trimesh.load(model, force="scene")

    figure = plt.figure(figsize=(15, 15), dpi=150)
    figure.patch.set_facecolor("#05070c")
    for index, (label, prefix) in enumerate(ASSETS, 1):
        axis = figure.add_subplot(3, 3, index, projection="3d")
        axis.set_facecolor("#05070c")
        all_vertices: list[np.ndarray] = []
        for name, mesh in scene.geometry.items():
            if not name.startswith(prefix) or name.endswith("_COLLISION") or name.endswith("_OCCLUSION") or "_SOCKET_" in name:
                continue
            vertices = np.asarray(mesh.vertices)
            all_vertices.append(vertices)
            faces = vertices[np.asarray(mesh.faces)]
            axis.add_collection3d(
                Poly3DCollection(
                    faces,
                    facecolor=color(name),
                    edgecolor=(0.55, 0.68, 0.82, 0.14),
                    linewidth=0.14,
                )
            )
        if all_vertices:
            vertices = np.vstack(all_vertices)
            minimum = vertices.min(axis=0)
            maximum = vertices.max(axis=0)
            centre = (minimum + maximum) * 0.5
            span = max(maximum - minimum) * 0.61
            axis.set_xlim(centre[0] - span, centre[0] + span)
            axis.set_ylim(centre[1] - span, centre[1] + span)
            axis.set_zlim(centre[2] - span, centre[2] + span)
        axis.view_init(elev=19, azim=-56)
        axis.set_proj_type("ortho")
        axis.set_axis_off()
        axis.set_title(label, color="#eef2f7", fontsize=10, fontweight="bold", pad=4)

    figure.suptitle("SHATTERED VERTICAL CITY — LOD0 SILHOUETTE REVIEW", color="#f5b61b", fontsize=15, fontweight="bold", y=0.985)
    plt.tight_layout(pad=0.8)
    output.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output, bbox_inches="tight", facecolor=figure.get_facecolor())
    print(output)


if __name__ == "__main__":
    main()
