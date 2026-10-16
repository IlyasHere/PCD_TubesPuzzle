from __future__ import annotations

from io import BytesIO
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from processing.image_processor import InvalidImageError, load_image
from processing.puzzle_generator import generate_puzzle, grid_bounds


def encoded_image(mode: str, size: tuple[int, int]) -> BytesIO:
    color = 128 if mode == "L" else (40, 120, 210)
    image = Image.new(mode, size, color)
    buffer = BytesIO()
    image.save(buffer, "PNG")
    buffer.seek(0)
    return buffer


class ImageProcessingTests(unittest.TestCase):
    def test_rgb_and_grayscale_are_normalized_to_rgb(self):
        self.assertEqual(load_image(encoded_image("RGB", (80, 60))).mode, "RGB")
        self.assertEqual(load_image(encoded_image("L", (80, 60))).mode, "RGB")

    def test_invalid_image_is_rejected(self):
        with self.assertRaises(InvalidImageError):
            load_image(BytesIO(b"not-an-image"))

    def test_non_divisible_dimensions_cover_every_pixel(self):
        values = grid_bounds(503)
        self.assertEqual(values[0], 0)
        self.assertEqual(values[-1], 503)
        self.assertEqual(sum(b - a for a, b in zip(values, values[1:])), 503)

    def test_generator_creates_white_3x3_frame_and_9_compatible_pieces(self):
        image = Image.new("RGB", (503, 407), (90, 140, 190))
        with tempfile.TemporaryDirectory() as temp:
            result = generate_puzzle(image, Path(temp), seed=7)
            self.assertEqual(len(result.pieces), 9)
            self.assertTrue((Path(temp) / "guide.png").is_file())
            self.assertTrue((Path(temp) / "bingkai_5x5.png").is_file())
            with Image.open(Path(temp) / "bingkai_5x5.png") as frame:
                xs = grid_bounds(frame.width)
                ys = grid_bounds(frame.height)
                self.assertEqual(frame.getpixel((xs[1] + 4, ys[1] + 4)), (255, 255, 255, 255))
                self.assertEqual(frame.getpixel((4, 4)), (90, 140, 190, 255))
            for piece in result.pieces:
                with Image.open(Path(temp) / piece["file"]) as png:
                    self.assertEqual(png.mode, "RGBA")
                    self.assertEqual(png.getchannel("A").getextrema()[0], 0)
                    self.assertGreater(png.getchannel("A").getextrema()[1], 0)

            by_position = {(p["row"], p["col"]): p for p in result.pieces}
            bottom_right = by_position[(2, 2)]
            with Image.open(Path(temp) / bottom_right["file"]) as png:
                alpha = png.getchannel("A")
                flat_right_x = bottom_right["padding"] + bottom_right["sourceWidth"]
                flat_bottom_y = bottom_right["padding"] + bottom_right["sourceHeight"]
                self.assertEqual(alpha.getpixel((flat_right_x, bottom_right["padding"] + 4)), 0)
                self.assertEqual(alpha.getpixel((bottom_right["padding"] + 4, flat_bottom_y)), 0)

            for row in range(3):
                for col in range(2):
                    self.assertEqual(by_position[(row, col)]["edges"]["right"], -by_position[(row, col + 1)]["edges"]["left"])
            for row in range(2):
                for col in range(3):
                    self.assertEqual(by_position[(row, col)]["edges"]["bottom"], -by_position[(row + 1, col)]["edges"]["top"])


if __name__ == "__main__":
    unittest.main()
