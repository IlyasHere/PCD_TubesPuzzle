# Puzzle World — Studio (5×5)

Aplikasi Puzzle Generator berbasis HTML, CSS dan JavaScript (tanpa backend). Desain terinspirasi referensi editorial bernuansa charcoal. Aset latar (`assets/texture.png`) berasal dari gambar yang diberikan pengguna.

## Cara menjalankan

Buka `index.html` di browser Chrome atau Safari. Bisa juga via VS Code Live Server. Fitur ZIP memakai JSZip melalui CDN dan membutuhkan internet.

## Alur

1. Pilih gambar (RGB/grayscale, setidaknya 5×5 pixel).
2. Klik Generate puzzle. Crop asli dilakukan di Canvas berdasarkan koordinat 5×5; semua piksel terbagi ke 25 bagian.
3. Klik sebuah potongan kemudian klik sel bingkai untuk memasangnya, atau tarik dan jatuhkan potongan. Klik sel terisi tanpa memilih potongan untuk mengembalikannya.
4. Acak ulang, reset, buka referensi gambar, atau unduh ZIP.

## Output

File ZIP berisi folder `Puzzle_World_Output`, dengan `bingkai_5x5.png` serta `piece_r1_c1.png` sampai `piece_r5_c5.png`. Rasionya dijaga sesuai gambar asli. Pengacakan hanya mengubah urutan tray, bukan urutan file.

## File

- `index.html` — struktur aplikasi
- `style.css` — desain
- `script.js` — algoritma cropping, interaksi, ekspor
- `assets/` — tekstur dan aset referensi tambahan
