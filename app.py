from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
import json
from pathlib import Path
import re
import secrets
import shutil
import tempfile
import zipfile

from flask import Flask, abort, jsonify, render_template, request, send_file, send_from_directory, url_for

from processing.image_processor import InvalidImageError, load_image
from processing.puzzle_generator import generate_puzzle


BASE_DIR = Path(__file__).resolve().parent
PUZZLE_ROOT = Path(tempfile.gettempdir()) / "puzzle_world_flask"
PUZZLE_ROOT.mkdir(parents=True, exist_ok=True)
PUZZLE_ID_RE = re.compile(r"^[a-f0-9]{32}$")
ASSET_RE = re.compile(r"^(guide\.png|bingkai_5x5\.png|piece_r[1-3]_c[1-3]\.png)$")
MAX_AGE = timedelta(hours=2)

app = Flask(__name__)
app.config.update(MAX_CONTENT_LENGTH=20 * 1024 * 1024)


def _puzzle_dir(puzzle_id: str) -> Path:
    if not PUZZLE_ID_RE.fullmatch(puzzle_id):
        abort(404)
    return PUZZLE_ROOT / puzzle_id


def cleanup_expired() -> None:
    cutoff = datetime.now(timezone.utc) - MAX_AGE
    for child in PUZZLE_ROOT.iterdir():
        if not child.is_dir():
            continue
        modified = datetime.fromtimestamp(child.stat().st_mtime, tz=timezone.utc)
        if modified < cutoff:
            shutil.rmtree(child, ignore_errors=True)


@app.get("/")
def index():
    cleanup_expired()
    return render_template("index.html")


@app.post("/api/generate")
def api_generate():
    cleanup_expired()
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return jsonify(error="Pilih file gambar terlebih dahulu."), 400
    try:
        image = load_image(uploaded.stream)
    except InvalidImageError as exc:
        return jsonify(error=str(exc)), 400

    puzzle_id = secrets.token_hex(16)
    output_dir = PUZZLE_ROOT / puzzle_id
    try:
        generated = generate_puzzle(image, output_dir)
        payload = {
            "puzzleId": puzzle_id,
            "width": generated.width,
            "height": generated.height,
            "grid": generated.grid,
            "frameGrid": 5,
            "guideUrl": url_for("puzzle_asset", puzzle_id=puzzle_id, filename=generated.guide_name),
            "frameUrl": url_for("puzzle_asset", puzzle_id=puzzle_id, filename=generated.frame_name),
            "exportUrl": url_for("api_export", puzzle_id=puzzle_id),
            "pieces": [
                {
                    **piece,
                    "url": url_for("puzzle_asset", puzzle_id=puzzle_id, filename=piece["file"]),
                }
                for piece in generated.pieces
            ],
        }
        (output_dir / "metadata.json").write_text(json.dumps(payload), encoding="utf-8")
        return jsonify(payload)
    except Exception:
        shutil.rmtree(output_dir, ignore_errors=True)
        app.logger.exception("Puzzle generation failed")
        return jsonify(error="Gagal memproses gambar."), 500


@app.get("/api/puzzles/<puzzle_id>/<filename>")
def puzzle_asset(puzzle_id: str, filename: str):
    directory = _puzzle_dir(puzzle_id)
    if not ASSET_RE.fullmatch(filename) or not (directory / filename).is_file():
        abort(404)
    return send_from_directory(directory, filename, mimetype="image/png", max_age=0)


@app.get("/api/export/<puzzle_id>")
def api_export(puzzle_id: str):
    directory = _puzzle_dir(puzzle_id)
    if not directory.is_dir():
        abort(404)
    files = [directory / "bingkai_5x5.png"] + [
        directory / f"piece_r{row}_c{col}.png"
        for row in range(1, 4)
        for col in range(1, 4)
    ]
    if not all(path.is_file() for path in files):
        abort(404)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, f"Puzzle_World_Output/{path.name}")
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name="Puzzle_World_3x3.zip",
    )


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="Ukuran file terlalu besar. Maksimal 20 MB."), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
