# Puzzle World - Studio Edition

Aplikasi web untuk membuat dan memainkan puzzle jigsaw 3 x 3 dari gambar pilihan pengguna.

## Fitur

- Upload dan pratinjau gambar.
- Generator puzzle 3 x 3.
- Drag-and-drop, rotasi, snap, acak, dan reset.
- Progress permainan dan gambar referensi.

## Teknologi

- Python
- Flask
- Pillow
- HTML
- CSS
- Vanilla JavaScript

## Struktur Project

```text
Puzzle_World/
├── app.py
├── main.py
├── requirements.txt
├── processing/
│   ├── image_processor.py
│   └── puzzle_generator.py
├── templates/
│   └── index.html
├── static/
│   ├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js
│       └── puzzle-interaction.js
└── tests/
    ├── test_app.py
    └── test_processing.py
```

## Instalasi

```bash
python -m pip install -r requirements.txt
```

## Menjalankan Aplikasi

```bash
python app.py
```

Buka `http://127.0.0.1:5000` di browser.

## Kontrol Permainan

- Geser kepingan menggunakan mouse atau trackpad.
- Tekan `Q` untuk memutar ke kiri.
- Tekan `E` atau klik dua kali untuk memutar ke kanan.
- Gunakan tombol **Acak** atau **Reset** untuk mengatur ulang permainan.

## Pengujian

```bash
python -m unittest discover -s tests -v
```

