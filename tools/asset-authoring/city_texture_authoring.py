"""Deterministic source-texture authoring for the city kit."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def normal_from_height(height: np.ndarray, strength: float = 4.0) -> Image.Image:
    dy, dx = np.gradient(height.astype(np.float32) / 255.0)
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(nx)
    magnitude = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / magnitude, ny / magnitude, nz / magnitude), axis=-1)
    return Image.fromarray(((normal * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8), "RGB")


def generate_trim_textures(output: Path, rng: np.random.Generator, size: int = 2048) -> dict[str, Image.Image]:
    output.mkdir(parents=True, exist_ok=True)
    yy, xx = np.mgrid[0:size, 0:size]
    low_noise = rng.normal(0.0, 1.0, (size // 8, size // 8))
    low_noise = np.asarray(
        Image.fromarray(((low_noise - low_noise.min()) / np.ptp(low_noise) * 255).astype(np.uint8))
        .resize((size, size), Image.Resampling.BICUBIC)
        .filter(ImageFilter.GaussianBlur(2.2)),
        dtype=np.float32,
    ) / 255.0
    fine = rng.random((size, size), dtype=np.float32)
    brushed = 0.5 + 0.5 * np.sin(xx * 0.11 + np.sin(yy * 0.007) * 1.5)

    base = np.zeros((size, size, 4), dtype=np.uint8)
    base[..., 0] = (25 + low_noise * 21 + brushed * 9 + fine * 5).clip(0, 255)
    base[..., 1] = (29 + low_noise * 24 + brushed * 10 + fine * 5).clip(0, 255)
    base[..., 2] = (37 + low_noise * 29 + brushed * 12 + fine * 4).clip(0, 255)
    base[..., 3] = 255
    base_image = Image.fromarray(base, "RGBA")
    draw = ImageDraw.Draw(base_image, "RGBA")

    lane = size // 4
    draw.rectangle((0, 0, size, lane - 1), outline=(7, 10, 15, 220), width=10)
    for x in range(0, size, size // 16):
        draw.rectangle((x + 8, 18, x + size // 16 - 10, lane - 18), outline=(120, 134, 151, 55), width=4)
        draw.line((x + 14, lane // 2, x + size // 16 - 15, lane // 2), fill=(5, 8, 12, 170), width=8)

    y0 = lane
    draw.rectangle((0, y0, size, y0 + lane - 1), fill=(18, 23, 31, 255), outline=(5, 7, 10, 220), width=10)
    for y in range(y0 + 28, y0 + lane - 24, 34):
        draw.line((20, y, size - 20, y), fill=(3, 5, 8, 210), width=10)
        draw.line((20, y - 3, size - 20, y - 3), fill=(138, 151, 166, 28), width=2)

    y0 = lane * 2
    draw.rectangle((0, y0, size, y0 + lane - 1), outline=(4, 6, 9, 230), width=10)
    cell = size // 8
    for column in range(8):
        x0 = column * cell + 12
        x1 = (column + 1) * cell - 12
        draw.rounded_rectangle((x0, y0 + 18, x1, y0 + lane - 18), radius=12, outline=(8, 11, 16, 210), width=8)
        for bx in (x0 + 18, x1 - 18):
            for by in (y0 + 36, y0 + lane - 36):
                draw.ellipse((bx - 4, by - 4, bx + 4, by + 4), fill=(150, 160, 171, 72))

    y0 = lane * 3
    draw.rectangle((0, y0, size, size - 1), fill=(8, 13, 22, 255), outline=(2, 4, 8, 230), width=10)
    band_h = 76
    for y in range(y0 + 20, size - 20, band_h + 22):
        draw.rounded_rectangle((18, y, size - 18, min(size - 16, y + band_h)), radius=12, fill=(18, 43, 66, 255), outline=(83, 180, 236, 72), width=5)
        for x in range(42, size - 24, 110):
            draw.line((x, y + 8, x, min(size - 24, y + band_h - 8)), fill=(3, 10, 18, 225), width=7)

    for _ in range(460):
        x = int(rng.integers(0, size))
        y = int(rng.integers(0, size))
        length = int(rng.integers(size // 180, size // 36))
        alpha = int(rng.integers(5, 26))
        draw.line((x, y, min(size - 1, x + length), y + int(rng.integers(-2, 3))), fill=(220, 224, 230, alpha), width=1)

    base_image.save(output / "city-architecture-trim-basecolor.png")

    height = (88 + low_noise * 42 + brushed * 18).clip(0, 255).astype(np.uint8)
    h_img = Image.fromarray(height, "L")
    h_draw = ImageDraw.Draw(h_img)
    for y in (lane, lane * 2, lane * 3):
        h_draw.rectangle((0, y - 7, size, y + 7), fill=36)
    for x in range(0, size, size // 16):
        h_draw.rectangle((x + 7, 10, x + 13, lane - 10), fill=42)
    normal = normal_from_height(np.asarray(h_img))
    normal.save(output / "city-architecture-trim-normal.png")

    orm = np.zeros((size, size, 3), dtype=np.uint8)
    orm[..., 0] = (210 - low_noise * 44).clip(0, 255)
    orm[..., 1] = (74 + low_noise * 82 + brushed * 24).clip(0, 255)
    orm[..., 2] = 218
    orm_image = Image.fromarray(orm, "RGB")
    orm_image.save(output / "city-architecture-trim-orm.png")

    emissive = Image.new("RGB", (size, size), (0, 0, 0))
    e_draw = ImageDraw.Draw(emissive)
    for y in range(lane * 3 + 30, size - 30, band_h + 22):
        e_draw.rounded_rectangle((26, y, size - 26, min(size - 24, y + band_h)), radius=10, fill=(255, 255, 255))
    for x in range(32, size, size // 12):
        e_draw.rectangle((x, 34, min(size - 1, x + 12), lane - 34), fill=(255, 255, 255))
    emissive = emissive.filter(ImageFilter.GaussianBlur(1.4))
    emissive.save(output / "city-architecture-trim-emissive.png")

    decal = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(decal, "RGBA")
    yellow = (245, 182, 27, 255)
    for index, text in enumerate(("CITY 09", "TRANSIT", "CAUTION", "SERVICE", "VOID EDGE")):
        y = 80 + index * 310
        d.rounded_rectangle((70, y, 790, y + 180), radius=18, outline=yellow, width=10)
        d.text((110, y + 58), text, fill=yellow, stroke_width=1)
    for offset in range(990, 1900, 120):
        d.polygon(((offset, 130), (offset + 54, 130), (offset - 190, 370), (offset - 244, 370)), fill=yellow)
    decal.save(output / "city-decal-atlas.png")

    return {"base": base_image, "normal": normal, "orm": orm_image, "emissive": emissive, "decal": decal}
