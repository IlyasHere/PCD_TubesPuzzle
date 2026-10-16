from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import random
from typing import Any

from PIL import Image, ImageDraw

from .image_processor import image_to_png_bytes


FRAME_GRID_SIZE = 5
PUZZLE_GRID_SIZE = 3
ANTIALIAS = 4


@dataclass(frozen=True)
class GeneratedPuzzle:
    width: int
    height: int
    grid: int
    guide_name: str
    frame_name: str
    pieces: list[dict[str, Any]]


def grid_bounds(length: int, grid: int = FRAME_GRID_SIZE) -> list[int]:
    return [i * length // grid for i in range(grid + 1)]


def _edge_matrix(grid: int, rng: random.Random) -> tuple[list[list[int]], list[list[int]]]:
    vertical = [[rng.choice((-1, 1)) for _ in range(grid - 1)] for _ in range(grid)]
    horizontal = [[rng.choice((-1, 1)) for _ in range(grid)] for _ in range(grid - 1)]
    return vertical, horizontal


def _piece_edges(
    row: int,
    col: int,
    grid: int,
    vertical: list[list[int]],
    horizontal: list[list[int]],
) -> dict[str, int]:
    return {
        "top": 0 if row == 0 else -horizontal[row - 1][col],
        "right": 0 if col == grid - 1 else vertical[row][col],
        "bottom": 0 if row == grid - 1 else horizontal[row][col],
        "left": 0 if col == 0 else -vertical[row][col - 1],
    }


def _ellipse(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: int) -> None:
    draw.ellipse(box, fill=fill)


def _piece_mask(width: int, height: int, padding: int, edges: dict[str, int]) -> Image.Image:
    scale = ANTIALIAS
    full_w = (width + 2 * padding) * scale
    full_h = (height + 2 * padding) * scale
    mask = Image.new("L", (full_w, full_h), 0)
    draw = ImageDraw.Draw(mask)
    x0 = padding * scale
    y0 = padding * scale
    x1 = (padding + width) * scale
    y1 = (padding + height) * scale
    draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)

    radius = max(2, round(min(width, height) * .18 * scale))
    centers = {
        "top": ((x0 + x1) // 2, y0),
        "right": (x1, (y0 + y1) // 2),
        "bottom": ((x0 + x1) // 2, y1),
        "left": (x0, (y0 + y1) // 2),
    }
    for side, edge in edges.items():
        if edge == 0:
            continue
        cx, cy = centers[side]
        box = (cx - radius, cy - radius, cx + radius, cy + radius)
        _ellipse(draw, box, 255 if edge > 0 else 0)

    result = mask.resize((width + 2 * padding, height + 2 * padding), Image.Resampling.LANCZOS)
    clean = ImageDraw.Draw(result)
    if edges["top"] == 0:
        clean.rectangle((0, 0, result.width - 1, padding - 1), fill=0)
    if edges["right"] == 0:
        clean.rectangle((padding + width, 0, result.width - 1, result.height - 1), fill=0)
    if edges["bottom"] == 0:
        clean.rectangle((0, padding + height, result.width - 1, result.height - 1), fill=0)
    if edges["left"] == 0:
        clean.rectangle((0, 0, padding - 1, result.height - 1), fill=0)
    return result


def _piece_image(
    source: Image.Image,
    box: tuple[int, int, int, int],
    padding: int,
    edges: dict[str, int],
) -> tuple[Image.Image, Image.Image]:
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    piece = Image.new("RGBA", (width + 2 * padding, height + 2 * padding), (0, 0, 0, 0))

    crop_box = (
        max(0, x0 - padding),
        max(0, y0 - padding),
        min(source.width, x1 + padding),
        min(source.height, y1 + padding),
    )
    crop = source.crop(crop_box).convert("RGBA")
    destination = (crop_box[0] - x0 + padding, crop_box[1] - y0 + padding)
    piece.paste(crop, destination)
    mask = _piece_mask(width, height, padding, edges)
    piece.putalpha(mask)
    return piece, mask


def create_empty_frame(source: Image.Image) -> Image.Image:
    width, height = source.size
    frame = source.convert("RGBA")
    draw = ImageDraw.Draw(frame)
    xs = grid_bounds(width, FRAME_GRID_SIZE)
    ys = grid_bounds(height, FRAME_GRID_SIZE)
    line_width = max(1, min(width, height) // 360)
    grid_color = (145, 136, 121, 255)
    border_color = (68, 65, 59, 255)
    draw.rectangle((xs[1], ys[1], xs[4] - 1, ys[4] - 1), fill=(255, 255, 255, 255))
    for x in xs[2:4]:
        draw.line((x, ys[1], x, ys[4] - 1), fill=grid_color, width=line_width)
    for y in ys[2:4]:
        draw.line((xs[1], y, xs[4] - 1, y), fill=grid_color, width=line_width)
    draw.rectangle((xs[1], ys[1], xs[4] - 1, ys[4] - 1), outline=border_color, width=line_width)
    draw.rectangle((0, 0, width - 1, height - 1), outline=border_color, width=line_width)
    return frame


def generate_puzzle(source: Image.Image, output_dir: Path, *, seed: int | None = None) -> GeneratedPuzzle:
    output_dir.mkdir(parents=True, exist_ok=True)
    source = source.convert("RGB")
    width, height = source.size
    xs = grid_bounds(width)
    ys = grid_bounds(height)
    rng = random.Random(seed)
    vertical, horizontal = _edge_matrix(PUZZLE_GRID_SIZE, rng)

    guide_name = "guide.png"
    frame_name = "bingkai_5x5.png"
    (output_dir / guide_name).write_bytes(image_to_png_bytes(source))
    (output_dir / frame_name).write_bytes(image_to_png_bytes(create_empty_frame(source)))

    metadata: list[dict[str, Any]] = []
    for row in range(PUZZLE_GRID_SIZE):
        for col in range(PUZZLE_GRID_SIZE):
            frame_row = row + 1
            frame_col = col + 1
            x0, x1 = xs[frame_col], xs[frame_col + 1]
            y0, y1 = ys[frame_row], ys[frame_row + 1]
            cell_w, cell_h = x1 - x0, y1 - y0
            padding = max(2, round(min(cell_w, cell_h) * .22))
            edges = _piece_edges(row, col, PUZZLE_GRID_SIZE, vertical, horizontal)
            piece, _ = _piece_image(source, (x0, y0, x1, y1), padding, edges)
            name = f"piece_r{row + 1}_c{col + 1}.png"
            (output_dir / name).write_bytes(image_to_png_bytes(piece))
            metadata.append({
                "id": row * PUZZLE_GRID_SIZE + col,
                "row": row,
                "col": col,
                "correctRow": row,
                "correctCol": col,
                "sourceX": x0,
                "sourceY": y0,
                "sourceWidth": cell_w,
                "sourceHeight": cell_h,
                "padding": padding,
                "canvasWidth": piece.width,
                "canvasHeight": piece.height,
                "edges": edges,
                "file": name,
            })

    return GeneratedPuzzle(
        width=width,
        height=height,
        grid=PUZZLE_GRID_SIZE,
        guide_name=guide_name,
        frame_name=frame_name,
        pieces=metadata,
    )
