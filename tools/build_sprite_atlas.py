#!/usr/bin/env python3
"""Pack normalized Chico frames into one fixed-cell sprite atlas."""

from __future__ import annotations

import argparse
from pathlib import Path

from slice_sprite_sheets import read_rgba, write_rgba


FRAME_WIDTH = 640
FRAME_HEIGHT = 512
COLUMNS = 8
ROWS = (
    tuple(f"parado-{index:02d}.png" for index in range(1, 7)) + ("arrastando.png", "curioso.png"),
    ("feliz.png",)
    + tuple(f"sentado-{index:02d}.png" for index in range(1, 5))
    + tuple(f"dormindo-{index:02d}.png" for index in range(1, 4)),
    tuple(f"caminhada-esquerda-{index:02d}.png" for index in range(1, 9)),
    tuple(f"caminhada-direita-{index:02d}.png" for index in range(1, 9)),
    tuple(f"corrida-esquerda-{index:02d}.png" for index in range(1, 9)),
    tuple(f"corrida-direita-{index:02d}.png" for index in range(1, 9)),
    tuple(f"queda-esquerda-{index:02d}.png" for index in range(1, 6)),
    tuple(f"queda-direita-{index:02d}.png" for index in range(1, 6)),
    ("aterrissagem-esquerda-01.png",),
    ("aterrissagem-direita-01.png",),
    tuple(f"recuperacao-esquerda-{index:02d}.png" for index in range(1, 3)),
    tuple(f"recuperacao-direita-{index:02d}.png" for index in range(1, 3)),
)


def build(root: Path, output: Path) -> None:
    sheet_width = FRAME_WIDTH * COLUMNS
    sheet_height = FRAME_HEIGHT * len(ROWS)
    pixels = bytearray(sheet_width * sheet_height * 4)
    normalized = root / "assets" / "sprites" / "normalized"

    for row, filenames in enumerate(ROWS):
        for column, filename in enumerate(filenames):
            path = normalized / filename
            width, height, frame = read_rgba(path)
            if (width, height) != (FRAME_WIDTH, FRAME_HEIGHT):
                raise ValueError(f"{path} has size {width}x{height}, expected {FRAME_WIDTH}x{FRAME_HEIGHT}")
            for y in range(FRAME_HEIGHT):
                source_start = y * FRAME_WIDTH * 4
                target_start = ((row * FRAME_HEIGHT + y) * sheet_width + column * FRAME_WIDTH) * 4
                pixels[target_start:target_start + FRAME_WIDTH * 4] = frame[
                    source_start:source_start + FRAME_WIDTH * 4
                ]

    output.parent.mkdir(parents=True, exist_ok=True)
    write_rgba(output, sheet_width, sheet_height, pixels)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "assets" / "sprites" / "chico-spritesheet.png",
    )
    args = parser.parse_args()
    build(args.root, args.output)


if __name__ == "__main__":
    main()
