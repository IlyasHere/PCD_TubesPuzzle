from __future__ import annotations

from io import BytesIO
from typing import BinaryIO

from PIL import Image, ImageOps, UnidentifiedImageError


class InvalidImageError(ValueError):
    """Raised when an uploaded file cannot be used as a puzzle image."""


def load_image(source: BinaryIO, *, max_pixels: int = 40_000_000) -> Image.Image:
    """Read, orient, validate, and normalize an uploaded image to RGB."""
    try:
        with Image.open(source) as opened:
            opened.load()
            image = ImageOps.exif_transpose(opened)
            if image.width < 5 or image.height < 5:
                raise InvalidImageError("Ukuran gambar minimal 5 x 5 piksel.")
            if image.width * image.height > max_pixels:
                raise InvalidImageError("Resolusi gambar terlalu besar. Maksimal 40 megapiksel.")
            if image.mode == "L":
                return image.convert("RGB")
            if image.mode not in ("RGB", "RGBA"):
                return image.convert("RGB")
            if image.mode == "RGBA":
                background = Image.new("RGB", image.size, "white")
                background.paste(image, mask=image.getchannel("A"))
                return background
            return image.copy()
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageError("File tidak dapat dibaca sebagai gambar.") from exc


def image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
