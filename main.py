"""Compatibility launcher. The Flask application lives in app.py."""

from app import app


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
