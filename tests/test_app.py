from __future__ import annotations

from io import BytesIO
import tempfile
import unittest
import zipfile

from PIL import Image

import app as app_module


def png_upload(mode: str = "RGB", size: tuple[int, int] = (203, 157)) -> BytesIO:
    color = 150 if mode == "L" else (15, 90, 180)
    image = Image.new(mode, size, color)
    buffer = BytesIO()
    image.save(buffer, "PNG")
    buffer.seek(0)
    return buffer


class FlaskApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app_module.PUZZLE_ROOT = app_module.Path(self.temp.name)
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.temp.cleanup()

    def test_index_uses_flask_static_assets(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"/static/css/style.css", response.data)

    def test_generate_rgb_and_export_exactly_10_png(self):
        response = self.client.post("/api/generate", data={"image": (png_upload(), "sample.png")}, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["grid"], 3)
        self.assertEqual(payload["frameGrid"], 5)
        self.assertEqual(len(payload["pieces"]), 9)
        self.assertEqual((payload["width"], payload["height"]), (203, 157))

        guide = self.client.get(payload["guideUrl"])
        self.assertEqual(guide.status_code, 200)
        with Image.open(BytesIO(guide.data)) as guide_image:
            self.assertEqual(guide_image.size, (203, 157))
        guide.close()

        archive_response = self.client.get(payload["exportUrl"])
        self.assertEqual(archive_response.status_code, 200)
        with zipfile.ZipFile(BytesIO(archive_response.data)) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), 10)
            self.assertTrue(all(name.endswith(".png") for name in names))
            self.assertIn("Puzzle_World_Output/bingkai_5x5.png", names)
        archive_response.close()
        response.close()

    def test_generate_grayscale_and_invalid_upload(self):
        gray = self.client.post("/api/generate", data={"image": (png_upload("L"), "gray.png")}, content_type="multipart/form-data")
        self.assertEqual(gray.status_code, 200)
        invalid = self.client.post("/api/generate", data={"image": (BytesIO(b"broken"), "broken.png")}, content_type="multipart/form-data")
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("error", invalid.get_json())

    def test_paths_cannot_escape_puzzle_directory(self):
        response = self.client.get("/api/puzzles/not-a-valid-id/../../app.py")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
