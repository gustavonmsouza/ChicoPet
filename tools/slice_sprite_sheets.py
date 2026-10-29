#!/usr/bin/env python3
"""Extract transparent pose PNGs from the three Chico reference sheets."""

import argparse
import binascii
import json
import struct
import zlib
from collections import deque
from pathlib import Path

PNG = b"\x89PNG\r\n\x1a\n"


def read_rgba(path):
    data = path.read_bytes()
    if not data.startswith(PNG):
        raise ValueError(f"Not a PNG: {path}")
    width = height = depth = color_type = interlace = None
    compressed = bytearray()
    offset = 8
    while offset < len(data):
        size = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + size]
        offset += size + 12
        if kind == b"IHDR":
            width, height, depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
    if depth != 8 or color_type not in (2, 6) or interlace != 0:
        raise ValueError(f"Expected non-interlaced 8-bit RGB/RGBA PNG: {path}")
    channels = 4 if color_type == 6 else 3
    bpp = channels
    stride = width * channels
    raw = zlib.decompress(compressed)
    previous = bytearray(stride)
    pixels = bytearray(width * height * 4)
    cursor = 0

    for y in range(height):
        filter_type = raw[cursor]
        cursor += 1
        row = bytearray(raw[cursor:cursor + stride])
        cursor += stride
        for i in range(stride):
            left = row[i - bpp] if i >= bpp else 0
            up = previous[i]
            upper_left = previous[i - bpp] if i >= bpp else 0
            if filter_type == 1:
                row[i] = (row[i] + left) & 255
            elif filter_type == 2:
                row[i] = (row[i] + up) & 255
            elif filter_type == 3:
                row[i] = (row[i] + (left + up) // 2) & 255
            elif filter_type == 4:
                predictor = _paeth(left, up, upper_left)
                row[i] = (row[i] + predictor) & 255
            elif filter_type != 0:
                raise ValueError(f"Unsupported PNG filter {filter_type}: {path}")
        for x in range(width):
            source = x * channels
            target = (y * width + x) * 4
            pixels[target:target + 3] = row[source:source + 3]
            pixels[target + 3] = row[source + 3] if channels == 4 else 255
        previous = row
    return width, height, pixels


def _paeth(a, b, c):
    estimate = a + b - c
    distances = (abs(estimate - a), abs(estimate - b), abs(estimate - c))
    return (a, b, c)[distances.index(min(distances))]


def _background_predicate(mode):
    if mode == "checker":
        return lambda r, g, b: min(r, g, b) > 160 and max(r, g, b) - min(r, g, b) < 26
    if mode == "white":
        return lambda r, g, b: min(r, g, b) > 235 and max(r, g, b) - min(r, g, b) < 24
    return lambda r, g, b: False


def make_alpha(width, height, pixels, mode):
    total = width * height
    background = bytearray(total)
    if mode == "alpha":
        for pixel in range(total):
            i = pixel * 4
            r, g, b, a = pixels[i:i + 4]
            # Remove the saturated red extraction fringe without keying caramel fur.
            red_halo = r > 220 and g < 65 and b < 90 and r > g * 1.7
            if a < 24 or red_halo:
                background[pixel] = 1
    else:
        is_bg = _background_predicate(mode)
        queue = deque()

        def seed(pixel):
            if background[pixel]:
                return
            i = pixel * 4
            if is_bg(*pixels[i:i + 3]):
                background[pixel] = 1
                queue.append(pixel)

        for x in range(width):
            seed(x)
            seed((height - 1) * width + x)
        for y in range(height):
            seed(y * width)
            seed(y * width + width - 1)

        while queue:
            pixel = queue.popleft()
            x = pixel % width
            y = pixel // width
            neighbors = []
            if x: neighbors.append(pixel - 1)
            if x + 1 < width: neighbors.append(pixel + 1)
            if y: neighbors.append(pixel - width)
            if y + 1 < height: neighbors.append(pixel + width)
            for neighbor in neighbors:
                if background[neighbor]:
                    continue
                i = neighbor * 4
                if is_bg(*pixels[i:i + 3]):
                    background[neighbor] = 1
                    queue.append(neighbor)

        # Remove neutral, checker/white-contaminated fringe connected to the cutout edge.
        edge = bytearray(total)
        for pixel in range(total):
            if background[pixel]:
                x = pixel % width
                y = pixel // width
                if x: edge[pixel - 1] = 1
                if x + 1 < width: edge[pixel + 1] = 1
                if y: edge[pixel - width] = 1
                if y + 1 < height: edge[pixel + width] = 1
        for pixel in range(total):
            if not edge[pixel] or background[pixel]:
                continue
            i = pixel * 4
            r, g, b = pixels[i:i + 3]
            spread = max(r, g, b) - min(r, g, b)
            if mode == "checker" and min(r, g, b) > 175 and spread < 32:
                background[pixel] = 1
            elif mode == "white" and min(r, g, b) > 205 and spread < 32:
                background[pixel] = 1

    for pixel, is_background in enumerate(background):
        i = pixel * 4
        if is_background:
            pixels[i + 3] = 0
            pixels[i:i + 3] = b"\x00\x00\x00"
    return background


def components(width, height, pixels):
    parent = [0]
    regions = {}
    previous = []
    next_label = 0

    def find(label):
        while parent[label] != label:
            parent[label] = parent[parent[label]]
            label = parent[label]
        return label

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for y in range(height):
        current = []
        x = 0
        while x < width:
            if pixels[(y * width + x) * 4 + 3] <= 24:
                x += 1
                continue
            x0 = x
            while x < width and pixels[(y * width + x) * 4 + 3] > 24:
                x += 1
            next_label += 1
            parent.append(next_label)
            current.append((x0, x, next_label))
            regions[next_label] = [x0, y, x, y + 1, x - x0]
            for px0, px1, prev_label in previous:
                if x0 <= px1 and x >= px0:
                    union(next_label, prev_label)
        previous = current

    merged = {}
    for label, box in regions.items():
        root = find(label)
        region = merged.setdefault(root, [width, height, 0, 0, 0])
        region[0] = min(region[0], box[0])
        region[1] = min(region[1], box[1])
        region[2] = max(region[2], box[2])
        region[3] = max(region[3], box[3])
        region[4] += box[4]
    found = [r for r in merged.values() if r[4] > 1000]
    found.sort(key=lambda r: ((r[1] + r[3]) / 2, r[0]))
    return found


def write_rgba(path, width, height, pixels):
    def chunk(kind, payload):
        crc = binascii.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    stride = width * 4
    scanlines = b"".join(b"\x00" + pixels[y * stride:(y + 1) * stride] for y in range(height))
    path.write_bytes(PNG + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(scanlines, 9)) + chunk(b"IEND", b""))


def extract_sheet(root, output, name, mode):
    source = root / "assets" / "sprites" / f"{name}.png"
    width, height, pixels = read_rgba(source)
    make_alpha(width, height, pixels, mode)
    regions = components(width, height, pixels)
    target_dir = output / name
    target_dir.mkdir(parents=True, exist_ok=True)
    poses = []
    for index, (x0, y0, x1, y1, area) in enumerate(regions, 1):
        # Small transparent safety margin keeps fur tips intact while avoiding large gutters.
        left, top = max(0, x0 - 3), max(0, y0 - 3)
        right, bottom = min(width, x1 + 3), min(height, y1 + 3)
        crop_w, crop_h = right - left, bottom - top
        crop = bytearray(crop_w * crop_h * 4)
        for row in range(crop_h):
            src = ((top + row) * width + left) * 4
            dst = row * crop_w * 4
            crop[dst:dst + crop_w * 4] = pixels[src:src + crop_w * 4]
        filename = f"pose_{index:02d}.png"
        write_rgba(target_dir / filename, crop_w, crop_h, crop)
        poses.append({"index": index, "file": filename, "bounds": [x0, y0, x1, y1], "sourceArea": area})
    return {"source": str(source), "backgroundMode": mode, "poses": poses}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("assets/sprites/extracted"))
    args = parser.parse_args()
    output = args.root / args.output
    manifest = {}
    for name, mode in (("chico1", "alpha"), ("chico2", "checker"), ("chico3", "white")):
        record = extract_sheet(args.root, output, name, mode)
        manifest[name] = record
        print(f"{name}: {len(record['poses'])} poses -> {output / name}")
        for pose in record["poses"]:
            print(f"  {pose['index']:02d}: {pose['bounds']} {pose['file']}")
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
