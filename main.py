from pathlib import Path
import random
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image, ImageTk, ImageDraw, ImageOps

GRID = 5
BG, WHITE, INK, MUTED = '#f4f7fb', '#ffffff', '#15243b', '#66758c'
BLUE, BORDER = '#3468e8', '#e0e7f0'

class PuzzleWorld(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Puzzle World — Generator 5×5')
        self.geometry('1330x790')
        self.minsize(1020, 680)
        self.configure(bg=BG)
        self.source = None
        self.source_path = None
        self.frame_image = None
        self.pieces = []
        self.shuffled = []
        self.photo_refs = []
        self.status = tk.StringVar(value='Pilih gambar untuk memulai.')
        self.build_ui()

    def text(self, parent, content, size=11, color=INK, bold=False):
        return tk.Label(parent, text=content, bg=parent.cget('bg'), fg=color,
                        font=('Arial', size, 'bold' if bold else 'normal'))

    def button(self, parent, content, command, primary=False):
        return tk.Button(parent, text=content, command=command,
                         font=('Arial', 10, 'bold'), relief='flat', bd=0,
                         bg=BLUE if primary else '#eaf0fa',
                         fg='white' if primary else INK,
                         activebackground='#2456cb' if primary else '#dae4f5',
                         activeforeground='white' if primary else INK,
                         cursor='hand2', padx=14, pady=10)

    def build_ui(self):
        top = tk.Frame(self, bg=BG)
        top.pack(fill='x', padx=28, pady=(24, 16))
        self.text(top, 'Puzzle World', 25, INK, True).pack(anchor='w')
        self.text(top, 'Puzzle Generator / Tahap 1 · 5×5', 11, MUTED).pack(anchor='w', pady=(4, 0))

        tools = tk.Frame(self, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        tools.pack(fill='x', padx=28, pady=(0, 16))
        controls = tk.Frame(tools, bg=WHITE)
        controls.pack(fill='x', padx=18, pady=14)
        self.button(controls, 'Pilih Gambar', self.choose_image, True).pack(side='left')
        self.text(controls, 'Grid: 5 × 5  ·  25 potongan', 11, MUTED).pack(side='left', padx=18)
        self.button(controls, 'Simpan Hasil', self.save, True).pack(side='right')
        self.button(controls, 'Acak Ulang', self.reshuffle).pack(side='right', padx=(0, 10))
        self.button(controls, 'Buat Puzzle', self.generate).pack(side='right', padx=(0, 10))

        body = tk.Frame(self, bg=BG)
        body.pack(fill='both', expand=True, padx=28, pady=(0, 12))
        for i in range(3):
            body.grid_columnconfigure(i, weight=1, uniform='panels')
        body.grid_rowconfigure(0, weight=1)
        sections = [
            ('01  Gambar Masukan', 'Gambar RGB atau Grayscale'),
            ('02  Bingkai Puzzle', 'Area acuan penyusunan 5 × 5'),
            ('03  Potongan Puzzle', '25 potongan ditampilkan secara acak')
        ]
        self.canvases = []
        for i, (heading, desc) in enumerate(sections):
            panel = tk.Frame(body, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
            panel.grid(row=0, column=i, sticky='nsew', padx=(0 if i == 0 else 7, 0 if i == 2 else 7))
            self.text(panel, heading, 13, INK, True).pack(anchor='w', padx=16, pady=(18, 4))
            self.text(panel, desc, 10, MUTED).pack(anchor='w', padx=16)
            canvas = tk.Canvas(panel, bg=WHITE, highlightthickness=0)
            canvas.pack(fill='both', expand=True, padx=12, pady=(12, 16))
            canvas.bind('<Configure>', lambda _e: self.render_all())
            self.canvases.append(canvas)

        footer = tk.Frame(self, bg=BG)
        footer.pack(fill='x', padx=28, pady=(0, 18))
        tk.Label(footer, textvariable=self.status, fg=MUTED, bg=BG,
                 font=('Arial', 10), anchor='w').pack(side='left')
        self.text(footer, 'Output: 1 bingkai + 25 PNG', 10, MUTED).pack(side='right')
        self.render_all()

    def choose_image(self):
        path = filedialog.askopenfilename(title='Pilih gambar', filetypes=[
            ('Gambar', '*.png *.jpg *.jpeg *.bmp *.tif *.tiff *.webp'),
            ('Semua file', '*.*')
        ])
        if not path:
            return
        try:
            with Image.open(path) as image:
                image = ImageOps.exif_transpose(image)
                self.source = image.copy() if image.mode in ('RGB', 'L') else image.convert('RGB')
            self.source_path = Path(path)
            self.frame_image, self.pieces, self.shuffled = None, [], []
            self.status.set(f'{self.source_path.name} · {self.source.width} × {self.source.height} px')
            self.render_all()
        except Exception as exc:
            messagebox.showerror('Gagal membaca gambar', str(exc))

    def generate(self):
        if self.source is None:
            messagebox.showwarning('Belum ada gambar', 'Pilih gambar terlebih dahulu.')
            return
        w, h = self.source.size
        if w < GRID or h < GRID:
            messagebox.showerror('Gambar terlalu kecil', 'Ukuran gambar minimal 5 × 5 piksel.')
            return
        xs = [i * w // GRID for i in range(GRID + 1)]
        ys = [i * h // GRID for i in range(GRID + 1)]
        self.pieces = []
        for row in range(GRID):
            for col in range(GRID):
                part = self.source.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
                self.pieces.append((row, col, part))
        self.frame_image = Image.new('RGB', (w, h), 'white')
        draw = ImageDraw.Draw(self.frame_image)
        thick = max(1, min(w, h) // 380)
        for x in xs[1:-1]:
            draw.line((x, 0, x, h - 1), fill='#a7b5ca', width=thick)
        for y in ys[1:-1]:
            draw.line((0, y, w - 1, y), fill='#a7b5ca', width=thick)
        draw.rectangle((0, 0, w - 1, h - 1), outline='#536986', width=thick)
        self.reshuffle()
        self.status.set('Puzzle selesai dibuat · 25 potongan tampil · siap disimpan')

    def reshuffle(self):
        if not self.pieces:
            messagebox.showwarning('Belum ada puzzle', 'Klik Buat Puzzle dahulu.')
            return
        old = self.shuffled[:]
        self.shuffled = self.pieces[:]
        random.shuffle(self.shuffled)
        if len(self.shuffled) > 1 and self.shuffled == old:
            self.shuffled = self.shuffled[1:] + self.shuffled[:1]
        self.render_all()
        self.status.set('25 potongan sudah diacak · file yang disimpan tetap memakai posisi asli')

    def render_image(self, canvas, image, placeholder):
        cw, ch = canvas.winfo_width(), canvas.winfo_height()
        if image is None:
            canvas.create_text(cw / 2, ch / 2, text=placeholder,
                               fill=MUTED, font=('Arial', 11), justify='center',
                               width=max(120, cw - 20))
            return
        thumb = image.copy()
        thumb.thumbnail((max(1, cw - 20), max(1, ch - 20)), Image.Resampling.LANCZOS)
        photo = ImageTk.PhotoImage(thumb)
        self.photo_refs.append(photo)
        canvas.create_image(cw / 2, ch / 2, image=photo)

    def render_pieces(self, canvas):
        cw, ch = canvas.winfo_width(), canvas.winfo_height()
        if not self.shuffled:
            canvas.create_text(cw / 2, ch / 2,
                               text='25 potongan muncul setelah\nklik Buat Puzzle',
                               fill=MUTED, font=('Arial', 11), justify='center')
            return
        gap = 5
        # Pertahankan rasio gambar keseluruhan pada tray 5x5
        aspect = self.source.width / self.source.height
        available_w, available_h = max(1, cw - 22), max(1, ch - 22)
        tray_w = min(available_w, available_h * aspect)
        tray_h = tray_w / aspect
        if tray_h > available_h:
            tray_h = available_h
            tray_w = tray_h * aspect
        tile_w = (tray_w - gap * 4) / GRID
        tile_h = (tray_h - gap * 4) / GRID
        if tile_w <= 0 or tile_h <= 0:
            return
        left = (cw - tray_w) / 2
        top = (ch - tray_h) / 2
        for index, (row, col, piece) in enumerate(self.shuffled):
            x = left + (index % GRID) * (tile_w + gap)
            y = top + (index // GRID) * (tile_h + gap)
            display_piece = piece.resize((max(1, round(tile_w)), max(1, round(tile_h))),
                                         Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(display_piece)
            self.photo_refs.append(photo)
            canvas.create_image(x, y, image=photo, anchor='nw')
            # Badge nomor adalah nomor posisi ASLI (baris, kolom)
            label = str(row * GRID + col + 1).zfill(2)
            canvas.create_rectangle(x + 3, y + 3, x + 26, y + 20,
                                    fill='#15243b', outline='')
            canvas.create_text(x + 14.5, y + 11.5, text=label,
                               fill='white', font=('Arial', 9, 'bold'))

    def render_all(self):
        if not hasattr(self, 'canvases') or len(self.canvases) != 3:
            return
        self.photo_refs = []
        for canvas in self.canvases:
            canvas.delete('all')
        self.render_image(self.canvases[0], self.source, 'Belum ada gambar\nKlik Pilih Gambar')
        self.render_image(self.canvases[1], self.frame_image, 'Bingkai muncul setelah\nklik Buat Puzzle')
        self.render_pieces(self.canvases[2])

    def save(self):
        if not self.pieces or self.frame_image is None:
            messagebox.showwarning('Belum ada hasil', 'Klik Buat Puzzle terlebih dahulu.')
            return
        dest = filedialog.askdirectory(title='Pilih folder menyimpan hasil')
        if not dest:
            return
        folder = Path(dest) / 'Puzzle_World_Output'
        try:
            folder.mkdir(parents=True, exist_ok=True)
            self.frame_image.save(folder / 'bingkai_5x5.png')
            for row, col, part in self.pieces:
                part.save(folder / f'piece_r{row + 1}_c{col + 1}.png')
            self.status.set(f'Berhasil menyimpan 26 PNG ke {folder}')
            messagebox.showinfo('Berhasil', f'26 file PNG tersimpan di:\n{folder}')
        except Exception as exc:
            messagebox.showerror('Gagal menyimpan', str(exc))


if __name__ == '__main__':
    PuzzleWorld().mainloop()
