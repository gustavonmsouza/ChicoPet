#!/usr/bin/env python3
"""Create a macOS app icon from the normalized idle sprite using system tools."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from build_normalized_sprites import resize_nearest
from slice_sprite_sheets import read_rgba, write_rgba


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "sprites" / "normalized" / "parado.png"
ICON_PNG = ROOT / "assets" / "icons" / "chico.png"
ICON_ICNS = ROOT / "assets" / "icons" / "chico.icns"
CANVAS_SIZE = 512
CONTENT_SIZE = 456


def create_square_icon():
    width, height, pixels = read_rgba(SOURCE)
    visible = [
        (index % width, index // width)
        for index in range(width * height)
        if pixels[index * 4 + 3] > 0
    ]
    if not visible:
        raise ValueError(f"No visible pixels in app icon source: {SOURCE}")

    left = min(x for x, _ in visible)
    right = max(x for x, _ in visible) + 1
    top = min(y for _, y in visible)
    bottom = max(y for _, y in visible) + 1
    crop_width, crop_height = right - left, bottom - top
    crop = bytearray(crop_width * crop_height * 4)
    for row in range(crop_height):
        source_offset = ((top + row) * width + left) * 4
        target_offset = row * crop_width * 4
        crop[target_offset:target_offset + crop_width * 4] = pixels[
            source_offset:source_offset + crop_width * 4
        ]

    scale = CONTENT_SIZE / max(crop_width, crop_height)
    target_width = max(1, round(crop_width * scale))
    target_height = max(1, round(crop_height * scale))
    resized = resize_nearest(crop_width, crop_height, crop, target_width, target_height)
    canvas = bytearray(CANVAS_SIZE * CANVAS_SIZE * 4)
    offset_x = (CANVAS_SIZE - target_width) // 2
    offset_y = (CANVAS_SIZE - target_height) // 2
    for row in range(target_height):
        source_offset = row * target_width * 4
        target_offset = ((offset_y + row) * CANVAS_SIZE + offset_x) * 4
        canvas[target_offset:target_offset + target_width * 4] = resized[
            source_offset:source_offset + target_width * 4
        ]
    write_rgba(ICON_PNG, CANVAS_SIZE, CANVAS_SIZE, canvas)


def build_icns():
    sizes = (
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    )
    width, height, pixels = read_rgba(ICON_PNG)
    with tempfile.TemporaryDirectory(prefix="chico-icon-") as directory:
        iconset = Path(directory) / "Chico.iconset"
        iconset.mkdir()
        for filename, size in sizes:
            resized = resize_nearest(width, height, pixels, size, size)
            write_rgba(iconset / filename, size, size, resized)
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "--output", str(ICON_ICNS)],
            check=True,
        )


def main():
    ICON_PNG.parent.mkdir(parents=True, exist_ok=True)
    create_square_icon()
    build_icns()
    print(f"Generated {ICON_PNG.relative_to(ROOT)} and {ICON_ICNS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
