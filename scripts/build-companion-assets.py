#!/usr/bin/env python3
"""Build transparent DeepGYM companion cutouts and lightweight animated WebP assets.

This is an authoring-time script only. The desktop app does not depend on Python
or Pillow at runtime.
"""

from __future__ import annotations

import argparse
from collections import deque
from math import pi, sin
from pathlib import Path
from statistics import median

from PIL import Image, ImageFilter


STAGES = (
    ("initial", "01-initial.png"),
    ("adaptation", "02-adaptation.png"),
    ("growth", "03-growth.png"),
    ("strength", "04-strength.png"),
    ("mature", "05-mature.png"),
    ("final", "06-final.png"),
)

MOTIONS = (
    "idle",
    "rest",
    "celebrate",
    "recover",
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "squat",
    "hinge",
    "lunge",
    "arm_isolation",
    "dynamic_core",
    "static_core",
    "cardio",
    "mobility",
)


def border_key(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    band = max(2, min(width, height) // 180)
    samples: list[tuple[int, int, int]] = []
    for y in range(height):
        for x in range(width):
            if x < band or x >= width - band or y < band or y >= height - band:
                samples.append(rgb.getpixel((x, y)))
    return tuple(int(median(pixel[channel] for pixel in samples)) for channel in range(3))


def distance(left: tuple[int, int, int], right: tuple[int, int, int]) -> int:
    return max(abs(left[index] - right[index]) for index in range(3))


def extract_connected_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = rgba.convert("RGB")
    width, height = rgba.size
    key = border_key(rgba)
    threshold = 46
    visited = bytearray(width * height)
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def add(x: int, y: int) -> None:
        index = y * width + x
        if visited[index]:
            return
        visited[index] = 1
        if distance(rgb.getpixel((x, y)), key) <= threshold:
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            add(x - 1, y)
        if x + 1 < width:
            add(x + 1, y)
        if y > 0:
            add(x, y - 1)
        if y + 1 < height:
            add(x, y + 1)

    bg_mask = Image.new("L", (width, height), 0)
    bg_pixels = bg_mask.load()
    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if background[y * width + x]:
                bg_pixels[x, y] = 255
                alpha_pixels[x, y] = 0

    expanded = bg_mask.filter(ImageFilter.MaxFilter(5))
    expanded_pixels = expanded.load()
    for y in range(height):
        for x in range(width):
            if background[y * width + x] or not expanded_pixels[x, y]:
                continue
            edge_distance = distance(rgb.getpixel((x, y)), key)
            if edge_distance < 110:
                alpha_pixels[x, y] = max(0, min(255, round(255 * (edge_distance - threshold) / (110 - threshold))))

    alpha = alpha.filter(ImageFilter.GaussianBlur(0.35))
    rgba.putalpha(alpha)
    return rgba


def normalized_canvas(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("companion source has no visible pixels")
    subject = rgba.crop(bbox)
    max_width = round(size[0] * 0.88)
    max_height = round(size[1] * 0.88)
    scale = min(max_width / subject.width, max_height / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - subject.width) // 2
    y = size[1] - subject.height - round(size[1] * 0.045)
    canvas.alpha_composite(subject, (x, y))
    return canvas


def transformed(
    base: Image.Image,
    *,
    scale_x: float = 1,
    scale_y: float = 1,
    rotation: float = 0,
    dx: float = 0,
    dy: float = 0,
) -> Image.Image:
    bbox = base.getchannel("A").getbbox()
    if not bbox:
        return base.copy()
    subject = base.crop(bbox)
    subject = subject.resize(
        (max(1, round(subject.width * scale_x)), max(1, round(subject.height * scale_y))),
        Image.Resampling.LANCZOS,
    )
    if rotation:
        subject = subject.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
    frame = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x = round((base.width - subject.width) / 2 + dx)
    bottom = bbox[3]
    y = round(bottom - subject.height + dy)
    frame.alpha_composite(subject, (x, y))
    return frame


def motion_transform(name: str, phase: float) -> dict[str, float]:
    wave = sin(phase * 2 * pi)
    pulse = (1 - sin(phase * 2 * pi + pi / 2)) / 2
    if name == "idle":
        return {"scale_x": 1 - wave * 0.004, "scale_y": 1 + wave * 0.008, "dy": -wave * 2}
    if name == "rest":
        return {"rotation": wave * 1.2, "dy": pulse * 3}
    if name == "celebrate":
        return {"rotation": wave * 2.2, "dy": -abs(wave) * 14, "scale_x": 1 + pulse * 0.018}
    if name == "recover":
        return {"rotation": -1.5 + wave * 0.8, "scale_y": 0.99 + wave * 0.004, "dy": pulse * 4}
    if name == "horizontal_push":
        return {"scale_x": 0.985 + pulse * 0.04, "scale_y": 1 - pulse * 0.012, "dx": wave * 4}
    if name == "vertical_push":
        return {"scale_x": 1 - pulse * 0.018, "scale_y": 1 + pulse * 0.025, "dy": -pulse * 10}
    if name == "horizontal_pull":
        return {"scale_x": 1.025 - pulse * 0.035, "rotation": -wave * 2.2, "dx": -wave * 5}
    if name == "vertical_pull":
        return {"scale_x": 1 + pulse * 0.018, "scale_y": 1 - pulse * 0.028, "dy": pulse * 8}
    if name == "squat":
        return {"scale_x": 1 + pulse * 0.035, "scale_y": 1 - pulse * 0.075, "dy": pulse * 24}
    if name == "hinge":
        return {"rotation": wave * 5.5, "scale_y": 1 - pulse * 0.018, "dy": pulse * 5}
    if name == "lunge":
        return {"rotation": wave * 2.2, "dx": wave * 12, "dy": pulse * 8, "scale_y": 1 - pulse * 0.025}
    if name == "arm_isolation":
        return {"rotation": wave * 1.8, "dy": -pulse * 7, "scale_x": 1 + pulse * 0.012}
    if name == "dynamic_core":
        return {"rotation": wave * 4.2, "scale_x": 1 + pulse * 0.018, "dx": wave * 4}
    if name == "static_core":
        return {"scale_x": 1 + wave * 0.008, "scale_y": 1 - wave * 0.006, "dx": wave * 1.5}
    if name == "cardio":
        return {"rotation": wave * 2.4, "dx": wave * 7, "dy": -abs(wave) * 13, "scale_y": 1 + pulse * 0.012}
    if name == "mobility":
        return {"rotation": wave * 5.2, "dx": wave * 5, "scale_x": 1 - pulse * 0.012}
    return {}


def build_animation(base: Image.Image, name: str, output: Path) -> None:
    if name in {"idle", "recover"}:
        frame_count, duration = 12, 120
    elif name == "rest":
        frame_count, duration = 10, 130
    else:
        frame_count, duration = 8, 90
    frames = [transformed(base, **motion_transform(name, index / frame_count)) for index in range(frame_count)]
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        quality=78,
        method=3,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--references", type=Path, default=Path("assets/companions/strong-bunny/references"))
    parser.add_argument("--generated-initial", type=Path, default=Path("assets/companions/strong-bunny/stages/initial.webp"))
    parser.add_argument("--output", type=Path, default=Path("public/companions/strong-bunny"))
    args = parser.parse_args()

    for stage, filename in STAGES:
        source = Image.open(args.generated_initial) if stage == "initial" else extract_connected_background(Image.open(args.references / filename))
        static = normalized_canvas(source, (768, 1024))
        stage_path = args.output / "stages" / f"{stage}.webp"
        stage_path.parent.mkdir(parents=True, exist_ok=True)
        static.save(stage_path, format="WEBP", quality=92, method=6)

        animation_base = normalized_canvas(static, (480, 640))
        for motion in MOTIONS:
            build_animation(animation_base, motion, args.output / "motions" / stage / f"{motion}.webp")
        print(f"built {stage}: {stage_path}")


if __name__ == "__main__":
    main()
