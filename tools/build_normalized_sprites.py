#!/usr/bin/env python3
"""Build the fixed-canvas, transparent runtime sprites for Chico.

The original sheets remain untouched in ``assets/sprites/source/``. This tool
crops selected poses, removes their source backgrounds, aligns every runtime
frame to one canvas and applies one shared palette. It uses only Python's
standard library.
"""

from __future__ import annotations

import argparse
import json
from array import array
from collections import Counter, deque
from pathlib import Path

from slice_sprite_sheets import read_rgba, write_rgba


CANVAS_WIDTH = 640
CANVAS_HEIGHT = 512
GROUND_Y = 512
PALETTE_SIZE = 192
REFERENCE_SOURCE = "reference"
SOURCE_FILES = {REFERENCE_SOURCE: "reference.png"}

# Bounds are deliberately stored separately from segmentation.  That makes a
# cleanup threshold unable to change which source pose receives a filename.
POSE_BOUNDS = {
    "chico1": {
        1: (152, 20, 519, 358),
        2: (1025, 22, 1387, 358),
        3: (585, 28, 952, 358),
        4: (36, 386, 382, 671),
        5: (418, 401, 751, 661),
        6: (792, 401, 1124, 664),
        7: (1164, 401, 1495, 667),
    },
    "chico3": {
        1: (18, 39, 273, 394),
        2: (283, 88, 527, 428),
        3: (539, 108, 785, 428),
        4: (802, 156, 1047, 406),
        5: (1038, 147, 1281, 415),
        6: (1288, 192, 1519, 416),
        13: (1341, 778, 1509, 1010),
        14: (37, 786, 307, 1005),
        15: (1120, 791, 1309, 1008),
        18: (594, 832, 836, 1005),
    },
    REFERENCE_SOURCE: {},
}


def source_mode(name):
    return {"chico1": "alpha", "chico3": "white"}[name]


def _is_green_screen(r, g, b):
    return g > 120 and g > r * 1.35 and g > b * 1.35


def reference_components(width, height, pixels):
    """Find the reference sheet's 29 separate dog poses, ignoring its green matte."""
    total = width * height
    labels = array("H", [0]) * total
    components = []
    next_label = 0
    for index in range(total):
        if labels[index]:
            continue
        offset = index * 4
        if _is_green_screen(*pixels[offset:offset + 3]):
            continue
        next_label += 1
        labels[index] = next_label
        stack = [index]
        points = []
        x0 = x1 = index % width
        y0 = y1 = index // width
        while stack:
            pixel = stack.pop()
            points.append(pixel)
            x, y = pixel % width, pixel // width
            x0, x1 = min(x0, x), max(x1, x)
            y0, y1 = min(y0, y), max(y1, y)
            for dy in (-1, 0, 1):
                ny = y + dy
                if not 0 <= ny < height:
                    continue
                for dx in (-1, 0, 1):
                    nx = x + dx
                    if (dx == 0 and dy == 0) or not 0 <= nx < width:
                        continue
                    neighbor = ny * width + nx
                    if labels[neighbor]:
                        continue
                    neighbor_offset = neighbor * 4
                    if _is_green_screen(*pixels[neighbor_offset:neighbor_offset + 3]):
                        continue
                    labels[neighbor] = next_label
                    stack.append(neighbor)
        if len(points) > 1000:
            components.append({
                "label": next_label,
                "points": points,
                "bounds": (x0, y0, x1, y1),
            })

    rows = (
        sorted((item for item in components if item["bounds"][1] < 220), key=lambda item: item["bounds"][0]),
        sorted((item for item in components if 220 <= item["bounds"][1] < 435), key=lambda item: item["bounds"][0]),
        sorted((item for item in components if item["bounds"][1] >= 435), key=lambda item: item["bounds"][0]),
    )
    expected = (8, 8, 13)
    if tuple(map(len, rows)) != expected:
        raise ValueError(f"Expected reference-sheet rows with {expected} poses, found {tuple(map(len, rows))}")
    return labels, [component for row in rows for component in row]


def _unmix_green(r, g, b):
    foreground_green = max(r, b)
    if g <= foreground_green:
        return r, g, b, 255
    green_screen = (g - foreground_green) / (255 - foreground_green)
    alpha = 1 - green_screen
    if alpha <= 0:
        return 0, 0, 0, 0
    return r, foreground_green, b, round(alpha * 255)


def despill_green(r, g, b):
    g = min(g, max(r, b))
    if r < 190 and b < r * 0.45 and g > r * 0.68:
        g = round(r * 0.56 + b * 0.32)
    return r, g, b


def copy_reference_component(width, source_pixels, labels, component, padding=2):
    x0, y0, x1, y1 = component["bounds"]
    left, top = max(0, x0 - padding), max(0, y0 - padding)
    right, bottom = min(width, x1 + padding + 1), y1 + padding + 1
    crop_width, crop_height = right - left, bottom - top
    pixels = bytearray(crop_width * crop_height * 4)
    label = component["label"]
    for y in range(top, bottom):
        for x in range(left, right):
            source_index = y * width + x
            pixel_label = labels[source_index]
            if pixel_label and pixel_label != label:
                continue
            offset = source_index * 4
            r, g, b = source_pixels[offset:offset + 3]
            if pixel_label == label:
                r, g, b = despill_green(r, g, b)
                alpha = 255
            else:
                r, g, b, alpha = _unmix_green(r, g, b)
                if alpha == 255:
                    continue
            if alpha == 0:
                continue
            target = ((y - top) * crop_width + x - left) * 4
            pixels[target:target + 4] = bytes((r, g, b, alpha))
    return crop_width, crop_height, pixels


def build_specs():
    specs = [
        *(
            {
                "name": f"parado-{index:02d}", "source": REFERENCE_SOURCE, "pose": 16 + index,
                "anchor": "ground", "fit": "height", "size": 410,
            }
            for index in range(1, 7)
        ),
        # Chico 1 is used only where its original alpha is useful.  Its edge
        # colors are normalized with the same palette as the other two sheets.
        {"name": "parado", "source": "chico1", "pose": 1, "anchor": "ground", "fit": "height", "size": 410},
        {"name": "arrastando", "source": "chico1", "pose": 1, "anchor": "ground", "fit": "height", "size": 410},
        {"name": "curioso", "source": "chico1", "pose": 2, "anchor": "ground", "fit": "height", "size": 410, "mirror": True},
        {"name": "feliz", "source": "chico3", "pose": 13, "anchor": "ground", "fit": "height", "size": 400},
        *(
            {
                "name": f"sentado-{index:02d}", "source": REFERENCE_SOURCE, "pose": 22 + index,
                "anchor": "ground", "fit": "height", "size": 410,
            }
            for index in range(1, 5)
        ),
        *(
            {
                "name": f"dormindo-{index:02d}", "source": REFERENCE_SOURCE, "pose": 26 + index,
                "anchor": "ground", "fit": "height", "size": 410,
            }
            for index in range(1, 4)
        ),
    ]

    for state, first_pose in (("caminhada", 1), ("corrida", 9)):
        for direction in ("esquerda", "direita"):
            for index in range(1, 9):
                specs.append({
                    "name": f"{state}-{direction}-{index:02d}",
                    "source": REFERENCE_SOURCE, "pose": first_pose + index - 1, "anchor": "ground",
                    "fit": "height", "size": 410,
                    "mirror": direction == "esquerda",
                })

    # These are a tumble sequence.  Each direction is stored as a real file
    # so a later renderer cannot accidentally apply a second mirror.
    for direction, mirror in (("direita", False), ("esquerda", True)):
        for index, pose in enumerate((1, 2, 3, 4, 5), 1):
            specs.append({
                "name": f"queda-{direction}-{index:02d}",
                "source": "chico3", "pose": pose, "anchor": "center",
                "fit": "extent", "size": 420, "mirror": mirror,
            })
        specs.append({
            "name": f"aterrissagem-{direction}-01", "source": "chico3", "pose": 6,
            "anchor": "ground", "fit": "extent", "size": 420, "mirror": mirror,
        })
        for index, pose in enumerate((14, 13), 1):
            specs.append({
                "name": f"recuperacao-{direction}-{index:02d}",
                "source": "chico3", "pose": pose, "anchor": "ground",
                "fit": "height", "size": 390, "mirror": mirror,
            })
    return specs


def copy_crop(source_width, source_pixels, bounds, padding=0):
    x0, y0, x1, y1 = bounds
    # The source bounds were measured from the full sheet, so negative values
    # are not expected for these inputs.  Clamp defensively for future poses.
    left = max(0, x0 - padding)
    top = max(0, y0 - padding)
    right = min(source_width, x1 + padding)
    crop_width = right - left
    crop_height = y1 - y0 + padding * 2
    # Caller passes enough vertical room from the known 1024px sheets.
    pixels = bytearray(crop_width * crop_height * 4)
    for row in range(crop_height):
        source_start = ((top + row) * source_width + left) * 4
        target_start = row * crop_width * 4
        pixels[target_start:target_start + crop_width * 4] = source_pixels[source_start:source_start + crop_width * 4]
    return crop_width, crop_height, pixels


def _neighbors(pixel, width, height):
    x, y = pixel % width, pixel // width
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if not dx and not dy:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                yield ny * width + nx


def _flood(mask, width, height, predicate, pixels):
    queue = deque()

    def maybe_add(pixel):
        if mask[pixel]:
            return
        offset = pixel * 4
        if predicate(*pixels[offset:offset + 3]):
            mask[pixel] = 1
            queue.append(pixel)

    for x in range(width):
        maybe_add(x)
        maybe_add((height - 1) * width + x)
    for y in range(height):
        maybe_add(y * width)
        maybe_add(y * width + width - 1)
    while queue:
        pixel = queue.popleft()
        for neighbor in _neighbors(pixel, width, height):
            maybe_add(neighbor)


def remove_background(width, height, pixels, mode):
    """Turn each source's known background into transparent pixels.

    Flooding uses eight-connected pixels, which clears checkerboard and white
    gaps that only touch the border diagonally.  A second conservative flood
    removes pale fringe without treating caramel fur as background.
    """
    total = width * height
    if mode == "alpha":
        for pixel in range(total):
            offset = pixel * 4
            r, g, b, a = pixels[offset:offset + 4]
            # The red outline in chico1 lives in its almost-transparent matte.
            if a < 40 or (a < 96 and r > 230 and g < 35 and b < 35):
                pixels[offset:offset + 4] = b"\x00\x00\x00\x00"
        return

    mask = bytearray(total)
    if mode == "checker":
        strong = lambda r, g, b: min(r, g, b) >= 150 and max(r, g, b) - min(r, g, b) <= 38
        soft = lambda r, g, b: min(r, g, b) >= 135 and max(r, g, b) - min(r, g, b) <= 42
    else:  # white
        strong = lambda r, g, b: min(r, g, b) >= 225 and max(r, g, b) - min(r, g, b) <= 38
        soft = lambda r, g, b: min(r, g, b) >= 165 and max(r, g, b) - min(r, g, b) <= 52
    _flood(mask, width, height, strong, pixels)
    _flood(mask, width, height, soft, pixels)
    for pixel, is_background in enumerate(mask):
        if is_background:
            offset = pixel * 4
            pixels[offset:offset + 4] = b"\x00\x00\x00\x00"
    # Empty gaps between paws, tails and fur strands can be fully enclosed by
    # the drawing.  They are still sheet background, so clear the same neutral
    # background classes there as well.  The dog has no neutral-white fur; its
    # bright hairs remain warm (red higher than green/blue) and therefore stay.
    for pixel in range(total):
        offset = pixel * 4
        if strong(*pixels[offset:offset + 3]) or soft(*pixels[offset:offset + 3]):
            pixels[offset:offset + 4] = b"\x00\x00\x00\x00"


def remove_edge_matte(width, height, pixels, passes=2):
    """Clear pale neutral matte fragments clinging to the transparent edge."""
    total = width * height
    for _ in range(passes):
        clear = []
        for pixel in range(total):
            offset = pixel * 4
            r, g, b, alpha = pixels[offset:offset + 4]
            if not alpha:
                continue
            # Warm highlights are real fur.  Pale low-saturation pixels at the
            # outside edge are remnants of the white/checker source mattes.
            neutral_matte = min(r, g, b) >= 105 and max(r, g, b) - min(r, g, b) <= 68
            if neutral_matte and any(pixels[neighbor * 4 + 3] == 0 for neighbor in _neighbors(pixel, width, height)):
                clear.append(offset)
        for offset in clear:
            pixels[offset:offset + 4] = b"\x00\x00\x00\x00"


def trim_transparent(width, height, pixels):
    xs, ys = [], []
    for y in range(height):
        for x in range(width):
            if pixels[(y * width + x) * 4 + 3] >= 16:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise ValueError("The pose became fully transparent")
    left, right = max(0, min(xs) - 2), min(width, max(xs) + 3)
    top, bottom = max(0, min(ys) - 2), min(height, max(ys) + 3)
    cropped_width, cropped_height = right - left, bottom - top
    cropped = bytearray(cropped_width * cropped_height * 4)
    for row in range(cropped_height):
        source = ((top + row) * width + left) * 4
        target = row * cropped_width * 4
        cropped[target:target + cropped_width * 4] = pixels[source:source + cropped_width * 4]
    return cropped_width, cropped_height, cropped


def resize_nearest(width, height, pixels, target_width, target_height):
    resized = bytearray(target_width * target_height * 4)
    for y in range(target_height):
        source_y = min(height - 1, y * height // target_height)
        for x in range(target_width):
            source_x = min(width - 1, x * width // target_width)
            source = (source_y * width + source_x) * 4
            target = (y * target_width + x) * 4
            resized[target:target + 4] = pixels[source:source + 4]
    return resized


def mirror_horizontally(width, height, pixels):
    mirrored = bytearray(len(pixels))
    for y in range(height):
        for x in range(width):
            source = (y * width + x) * 4
            target = (y * width + (width - x - 1)) * 4
            mirrored[target:target + 4] = pixels[source:source + 4]
    return mirrored


def make_canvas(width, height, pixels, spec):
    if spec["fit"] == "height":
        scale = spec["size"] / height
    elif spec["fit"] == "width":
        scale = spec["size"] / width
    else:
        scale = spec["size"] / max(width, height)
    target_width = max(1, round(width * scale))
    target_height = max(1, round(height * scale))
    if target_width > CANVAS_WIDTH - 12 or target_height > CANVAS_HEIGHT - 12:
        shrink = min((CANVAS_WIDTH - 12) / target_width, (CANVAS_HEIGHT - 12) / target_height)
        target_width, target_height = round(target_width * shrink), round(target_height * shrink)
    scaled = resize_nearest(width, height, pixels, target_width, target_height)
    if spec.get("mirror"):
        scaled = mirror_horizontally(target_width, target_height, scaled)
    canvas = bytearray(CANVAS_WIDTH * CANVAS_HEIGHT * 4)
    left = (CANVAS_WIDTH - target_width) // 2
    if spec["anchor"] == "center":
        top = (CANVAS_HEIGHT - target_height) // 2
    else:
        visible_bottom = max(
            y for y in range(target_height)
            if any(scaled[(y * target_width + x) * 4 + 3] for x in range(target_width))
        )
        top = GROUND_Y - visible_bottom - 1
    for row in range(target_height):
        source = row * target_width * 4
        target = ((top + row) * CANVAS_WIDTH + left) * 4
        canvas[target:target + target_width * 4] = scaled[source:source + target_width * 4]
    return canvas


def palette_from_frames(frames, maximum):
    # Reduce to five bits per channel before median-cut.  It removes tiny
    # anti-aliasing variations while preserving the source's pixel-art tones.
    histogram = Counter()
    for pixels in frames.values():
        for offset in range(0, len(pixels), 4):
            if pixels[offset + 3] >= 128:
                histogram[(pixels[offset] >> 3, pixels[offset + 1] >> 3, pixels[offset + 2] >> 3)] += 1
    boxes = [list(histogram.items())]
    while len(boxes) < maximum:
        candidates = []
        for box_index, box in enumerate(boxes):
            if len(box) < 2:
                continue
            ranges = [max(color[channel] for color, _ in box) - min(color[channel] for color, _ in box) for channel in range(3)]
            score = max(ranges) * sum(weight for _, weight in box)
            candidates.append((score, box_index, ranges.index(max(ranges))))
        if not candidates:
            break
        _, box_index, channel = max(candidates)
        box = sorted(boxes.pop(box_index), key=lambda item: item[0][channel])
        total = sum(weight for _, weight in box)
        running = 0
        split = 1
        for split, (_, weight) in enumerate(box, 1):
            running += weight
            if running >= total / 2:
                break
        if split == len(box):
            boxes.append(box)
            break
        boxes.extend((box[:split], box[split:]))
    palette = []
    for box in boxes:
        total = sum(weight for _, weight in box)
        color = tuple(round(sum(((component << 3) + 4) * weight for (color, weight) in box for component in [color[channel]]) / total) for channel in range(3))
        palette.append(color)
    return sorted(set(palette))


def nearest_palette_color(rgb, palette, cache):
    key = tuple(component >> 3 for component in rgb)
    if key not in cache:
        cache[key] = min(
            palette,
            key=lambda color: 2 * (rgb[0] - color[0]) ** 2 + 4 * (rgb[1] - color[1]) ** 2 + (rgb[2] - color[2]) ** 2,
        )
    return cache[key]


def apply_palette(pixels, palette):
    cache = {}
    for offset in range(0, len(pixels), 4):
        if not pixels[offset + 3]:
            pixels[offset:offset + 3] = b"\x00\x00\x00"
            continue
        pixels[offset:offset + 3] = bytes(nearest_palette_color(tuple(pixels[offset:offset + 3]), palette, cache))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output", type=Path, default=Path("assets/sprites/normalized"))
    args = parser.parse_args()
    root = args.root.resolve()
    output = (root / args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "manifest.json"
    previous_files = set()
    if manifest_path.exists():
        previous_manifest = json.loads(manifest_path.read_text())
        previous_files = {frame["file"] for frame in previous_manifest["frames"]}

    source_images = {}
    for source in POSE_BOUNDS:
        filename = SOURCE_FILES.get(source, f"{source}.png")
        source_images[source] = read_rgba(
            (root / "assets" / "sprites" / "source" / filename).resolve(),
        )
    reference_width, reference_height, reference_pixels = source_images[REFERENCE_SOURCE]
    reference_labels, reference_poses = reference_components(
        reference_width, reference_height, reference_pixels,
    )

    frames = {}
    specs = build_specs()
    for spec in specs:
        source_width, source_height, source_pixels = source_images[spec["source"]]
        if spec["source"] == REFERENCE_SOURCE:
            crop_width, crop_height, crop = copy_reference_component(
                source_width, source_pixels, reference_labels, reference_poses[spec["pose"] - 1],
            )
        else:
            crop_width, crop_height, crop = copy_crop(
                source_width, source_pixels, POSE_BOUNDS[spec["source"]][spec["pose"]], spec.get("padding", 0),
            )
            remove_background(crop_width, crop_height, crop, source_mode(spec["source"]))
            remove_edge_matte(crop_width, crop_height, crop)
        crop_width, crop_height, crop = trim_transparent(crop_width, crop_height, crop)
        frames[spec["name"]] = make_canvas(crop_width, crop_height, crop, spec)

    current_files = {f"{name}.png" for name in frames}
    for filename in previous_files - current_files:
        if Path(filename).name != filename or Path(filename).suffix != ".png":
            raise ValueError(f"Unsafe stale frame path in {manifest_path}: {filename}")
        (output / filename).unlink(missing_ok=True)

    palette = palette_from_frames(frames, PALETTE_SIZE)
    for name, pixels in frames.items():
        apply_palette(pixels, palette)
        write_rgba(output / f"{name}.png", CANVAS_WIDTH, CANVAS_HEIGHT, pixels)

    manifest = {
        "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT, "groundY": GROUND_Y},
        "palette": [list(color) for color in palette],
        "frames": [{**spec, "file": f"{spec['name']}.png"} for spec in specs],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(frames)} normalized frames to {output}")
    print(f"Shared palette: {len(palette)} colors; canvas: {CANVAS_WIDTH}x{CANVAS_HEIGHT}")


if __name__ == "__main__":
    main()
