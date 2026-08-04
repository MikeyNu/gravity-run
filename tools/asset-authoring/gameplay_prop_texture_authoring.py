"""Deterministic PBR texture authoring for gameplay hazards and pickups."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def normal_from_height(height: np.ndarray, strength: float = 3.4) -> Image.Image:
    dy, dx = np.gradient(height.astype(np.float32) / 255.0)
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(nx)
    magnitude = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / magnitude, ny / magnitude, nz / magnitude), axis=-1)
    return Image.fromarray(((normal * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8), "RGB")


def generate_textures(
    output: Path,
    rng: np.random.Generator,
    size: int = 1024,
) -> dict[str, Image.Image]:
    output.mkdir(parents=True, exist_ok=True)
    yy, xx = np.mgrid[0:size, 0:size]
    directional = 0.5 + 0.5 * np.sin(xx * 0.21 + np.sin(yy * 0.016) * 1.7)
    noise = rng.normal(0.0, 1.0, (size, size))
    noise = np.asarray(
        Image.fromarray(((noise - noise.min()) / np.ptp(noise) * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(0.7)
        )
    ) / 255.0
    height = (104 + directional * 20 + noise * 42).clip(0, 255).astype(np.uint8)

    base = np.zeros((size, size, 4), dtype=np.uint8)
    base[..., 0] = (32 + directional * 15 + noise * 14).clip(0, 255)
    base[..., 1] = (36 + directional * 17 + noise * 12).clip(0, 255)
    base[..., 2] = (43 + directional * 19 + noise * 10).clip(0, 255)
    base[..., 3] = 255
    base_image = Image.fromarray(base, "RGBA")
    draw = ImageDraw.Draw(base_image, "RGBA")
    cell = size // 8
    for row in range(8):
        for column in range(8):
            x0 = column * cell + 7
            y0 = row * cell + 7
            x1 = (column + 1) * cell - 8
            y1 = (row + 1) * cell - 8
            draw.rounded_rectangle((x0, y0, x1, y1), radius=7, outline=(8, 11, 17, 145), width=5)
            draw.line((x0 + 8, y0 + 10, x1 - 10, y0 + 10), fill=(150, 163, 179, 28), width=2)
    for _ in range(220):
        x = int(rng.integers(0, size))
        y = int(rng.integers(0, size))
        length = int(rng.integers(size // 100, size // 18))
        draw.line((x, y, min(size - 1, x + length), y + int(rng.integers(-2, 3))), fill=(208, 215, 222, int(rng.integers(8, 32))), width=1)
    base_image.save(output / "gameplay-metal-basecolor.png", optimize=True)

    normal = normal_from_height(height)
    normal.save(output / "gameplay-metal-normal.png", optimize=True)

    orm = np.zeros((size, size, 3), dtype=np.uint8)
    orm[..., 0] = (205 - noise * 42).clip(0, 255)
    orm[..., 1] = (80 + noise * 74 + directional * 22).clip(0, 255)
    orm[..., 2] = 224
    orm_image = Image.fromarray(orm, "RGB")
    orm_image.save(output / "gameplay-metal-orm.png", optimize=True)

    emissive = Image.new("RGB", (size, size), (0, 0, 0))
    edraw = ImageDraw.Draw(emissive)
    stripe = max(8, size // 48)
    for offset in range(-size, size * 2, size // 7):
        edraw.polygon(
            ((offset, 0), (offset + stripe, 0), (offset - size + stripe, size), (offset - size, size)),
            fill=(255, 255, 255),
        )
    emissive = emissive.filter(ImageFilter.GaussianBlur(1.2))
    emissive.save(output / "gameplay-emissive-mask.png", optimize=True)

    crystal = np.zeros((size, size, 4), dtype=np.uint8)
    radial = np.sqrt(((xx - size * 0.44) / size) ** 2 + ((yy - size * 0.36) / size) ** 2)
    crystal[..., 0] = (244 - radial * 280).clip(86, 255)
    crystal[..., 1] = (178 - radial * 210).clip(38, 238)
    crystal[..., 2] = (42 + (1 - radial) * 64).clip(18, 138)
    crystal[..., 3] = 255
    crystal_image = Image.fromarray(crystal, "RGBA")
    crystal_image.save(output / "fragment-crystal-basecolor.png", optimize=True)

    return {
        "base": base_image,
        "normal": normal,
        "orm": orm_image,
        "emissive": emissive,
        "crystal": crystal_image,
    }
