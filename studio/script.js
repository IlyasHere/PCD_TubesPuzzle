const BOARD_N = 5;
const N = 3;
const TOTAL = N * N;
const BOARD_TOTAL = BOARD_N * BOARD_N;
const ROTATIONS = [0, 90, 180, 270];
const SNAP_TOLERANCE = 34;
const $ = id => document.getElementById(id);

let img = null;
let imageUrl = '';
let fileName = '';
let pieces = [];
let board = Array(TOTAL).fill(null);
let selectedId = null;
let drag = null;
let xs = [];
let ys = [];
let verticalEdges = [];
let horizontalEdges = [];

const startBtn = $('startBtn');
const input = $('fileInput');
const generateBtn = $('generateBtn');
const status = $('status');
const toast = $('toast');
const stage = $('tableStage');
const boardEl = $('board');
const layer = $('piecesLayer');
const controls = $('rotationControls');
const gameStatus = $('gameStatus');

function notify(message) {
  status.textContent = message;
  if (gameStatus) gameStatus.textContent = message;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('visible'), 2700);
}

function jump(id) {
  $(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

startBtn.onclick = () => jump('workspace');
$('changeBtn').onclick = () => input.click();

const mosaic = $('heroMosaic');
for (let i = 0; i < BOARD_TOTAL; i++) {
  const tile = document.createElement('div');
  if ([1, 2, 5, 7, 10, 11, 16, 21].includes(i)) tile.classList.add('filled');
  mosaic.append(tile);
}

function bounds(n) {
  return Array.from({ length: N + 1 }, (_, i) => Math.floor(i * n / N));
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomRotation() {
  return ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
}

function uploadDecor() {
  const plant = document.createElement('img');
  plant.className = 'asset upload-plant';
  plant.src = 'assets/Plant.svg';
  plant.alt = '';
  plant.setAttribute('aria-hidden', 'true');
  const pen = document.createElement('img');
  pen.className = 'asset upload-pen';
  pen.src = 'assets/Pen.svg';
  pen.alt = '';
  pen.setAttribute('aria-hidden', 'true');
  return [plant, pen];
}

function ratio() {
  return `${img.naturalWidth}/${img.naturalHeight}`;
}

input.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    notify('File harus berupa gambar.');
    return;
  }

  const url = URL.createObjectURL(f);
  const picture = new Image();
  picture.onload = () => {
    if (picture.naturalWidth < BOARD_N || picture.naturalHeight < BOARD_N) {
      URL.revokeObjectURL(url);
      notify('Gambar minimal 5 x 5 piksel.');
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = url;
    img = picture;
    fileName = f.name;
    const el = document.createElement('img');
    el.src = imageUrl;
    el.alt = 'Pratinjau gambar';
    $('uploadPreview').replaceChildren(...uploadDecor(), el);
    $('uploadPreview').classList.add('has-image');
    $('fileMeta').textContent = `${f.name} - ${picture.naturalWidth} x ${picture.naturalHeight} px`;
    generateBtn.disabled = false;
    $('changeBtn').disabled = false;
    $('playSection').classList.add('hidden');
    pieces = [];
    board = Array(TOTAL).fill(null);
    selectedId = null;
    notify('Gambar dimuat. Klik Buat puzzle untuk membuat potongan.');
  };
  picture.onerror = () => {
    URL.revokeObjectURL(url);
    notify('Gagal membaca gambar ini.');
  };
  picture.src = url;
});

function createEdges() {
  verticalEdges = Array.from({ length: N }, () => Array(N - 1).fill(0));
  horizontalEdges = Array.from({ length: N - 1 }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N - 1; c++) verticalEdges[r][c] = Math.random() > .5 ? 1 : -1;
  }
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N; c++) horizontalEdges[r][c] = Math.random() > .5 ? 1 : -1;
  }
}

function pieceShape(row, col) {
  return {
    top: row === 0 ? 0 : -horizontalEdges[row - 1][col],
    right: col === N - 1 ? 0 : verticalEdges[row][col],
    bottom: row === N - 1 ? 0 : horizontalEdges[row][col],
    left: col === 0 ? 0 : -verticalEdges[row][col - 1],
  };
}

function addTop(ctx, x, y, w, tab, size, depth) {
  if (!tab) {
    ctx.lineTo(x + w, y);
    return;
  }
  const mid = x + w / 2;
  const dir = -tab * depth;
  ctx.lineTo(mid - size, y);
  ctx.bezierCurveTo(mid - size * .75, y + dir, mid + size * .75, y + dir, mid + size, y);
  ctx.lineTo(x + w, y);
}

function addRight(ctx, x, y, h, tab, size, depth) {
  if (!tab) {
    ctx.lineTo(x, y + h);
    return;
  }
  const mid = y + h / 2;
  const dir = tab * depth;
  ctx.lineTo(x, mid - size);
  ctx.bezierCurveTo(x + dir, mid - size * .75, x + dir, mid + size * .75, x, mid + size);
  ctx.lineTo(x, y + h);
}

function addBottom(ctx, x, y, w, tab, size, depth) {
  if (!tab) {
    ctx.lineTo(x, y);
    return;
  }
  const mid = x + w / 2;
  const dir = tab * depth;
  ctx.lineTo(mid + size, y);
  ctx.bezierCurveTo(mid + size * .75, y + dir, mid - size * .75, y + dir, mid - size, y);
  ctx.lineTo(x, y);
}

function addLeft(ctx, x, y, h, tab, size, depth) {
  if (!tab) {
    ctx.lineTo(x, y);
    return;
  }
  const mid = y + h / 2;
  const dir = -tab * depth;
  ctx.lineTo(x, mid + size);
  ctx.bezierCurveTo(x + dir, mid + size * .75, x + dir, mid - size * .75, x, mid - size);
  ctx.lineTo(x, y);
}

function makePath(ctx, w, h, margin, shape) {
  const tab = Math.min(w, h) * .18;
  const depth = Math.min(w, h) * .2;
  const x = margin;
  const y = margin;
  ctx.beginPath();
  ctx.moveTo(x, y);
  addTop(ctx, x, y, w, shape.top, tab, depth);
  addRight(ctx, x + w, y, h, shape.right, tab, depth);
  addBottom(ctx, x, y + h, w, shape.bottom, tab, depth);
  addLeft(ctx, x, y, h, shape.left, tab, depth);
  ctx.closePath();
}

function createPiece(row, col) {
  const id = row * N + col;
  const w = xs[col + 1] - xs[col];
  const h = ys[row + 1] - ys[row];
  const margin = Math.ceil(Math.min(w, h) * .24);
  const c = canvas(w + margin * 2, h + margin * 2);
  const ctx = c.getContext('2d');
  const shape = pieceShape(row, col);

  ctx.save();
  makePath(ctx, w, h, margin, shape);
  ctx.clip();
  ctx.drawImage(img, -xs[col] + margin, -ys[row] + margin);
  ctx.restore();
  ctx.save();
  makePath(ctx, w, h, margin, shape);
  ctx.strokeStyle = 'rgba(255,255,255,.36)';
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) / 80));
  ctx.stroke();
  ctx.restore();

  return {
    id,
    row,
    col,
    correctRow: row,
    correctCol: col,
    sourceX: xs[col],
    sourceY: ys[row],
    sourceW: w,
    sourceH: h,
    margin,
    shape,
    canvas: c,
    url: c.toDataURL('image/png'),
    x: 0,
    y: 0,
    rotation: randomRotation(),
    placed: false,
    el: null,
  };
}

function generate() {
  if (!img) return;
  xs = bounds(img.naturalWidth);
  ys = bounds(img.naturalHeight);
  createEdges();
  pieces = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) pieces.push(createPiece(row, col));
  }
  board = Array(TOTAL).fill(null);
  selectedId = null;
  $('playSection').classList.remove('hidden');
  setupTable();
  renderPieces();
  updateProgress();
  notify('9 kepingan jigsaw dibuat. Geser dan putar untuk menyusun.');
  setTimeout(() => jump('playSection'), 80);
}

generateBtn.onclick = generate;

function boardRect() {
  return boardEl.getBoundingClientRect();
}

function stageRect() {
  return stage.getBoundingClientRect();
}

function boardMetrics() {
  const b = boardRect();
  const s = stageRect();
  return {
    x: b.left - s.left,
    y: b.top - s.top,
    w: b.width,
    h: b.height,
    cellW: b.width / BOARD_N,
    cellH: b.height / BOARD_N,
  };
}

function pieceDisplaySize(piece) {
  const m = boardMetrics();
  const playableW = m.cellW * N;
  const playableH = m.cellH * N;
  return {
    w: piece.canvas.width / img.naturalWidth * playableW,
    h: piece.canvas.height / img.naturalHeight * playableH,
    marginX: piece.margin / img.naturalWidth * playableW,
    marginY: piece.margin / img.naturalHeight * playableH,
  };
}

function targetPosition(piece) {
  const m = boardMetrics();
  const d = pieceDisplaySize(piece);
  return {
    x: m.x + (piece.col + 1) * m.cellW - d.marginX,
    y: m.y + (piece.row + 1) * m.cellH - d.marginY,
  };
}

function clampPiece(piece) {
  const r = stageRect();
  const d = pieceDisplaySize(piece);
  const pad = 8;
  piece.x = Math.max(pad, Math.min(piece.x, r.width - d.w - pad));
  piece.y = Math.max(pad + 58, Math.min(piece.y, r.height - d.h - pad));
}

function scatterPieces(targetPieces = pieces.filter(p => !p.placed), randomizeRotation = true) {
  const m = boardMetrics();
  const r = stageRect();
  const zones = [
    { x1: 24, y1: 74, x2: Math.max(25, m.x - 60), y2: r.height - 120 },
    { x1: m.x + m.w + 60, y1: 74, x2: r.width - 120, y2: r.height - 120 },
    { x1: Math.max(24, m.x - 80), y1: 78, x2: Math.min(r.width - 120, m.x + m.w + 80), y2: Math.max(84, m.y - 70) },
    { x1: Math.max(24, m.x - 80), y1: m.y + m.h + 62, x2: Math.min(r.width - 120, m.x + m.w + 80), y2: r.height - 100 },
  ].filter(z => z.x2 > z.x1 && z.y2 > z.y1);

  targetPieces.forEach((piece, index) => {
    const z = zones[index % zones.length] || { x1: 24, y1: 90, x2: r.width - 120, y2: r.height - 120 };
    const d = pieceDisplaySize(piece);
    piece.x = z.x1 + Math.random() * Math.max(1, z.x2 - z.x1 - d.w);
    piece.y = z.y1 + Math.random() * Math.max(1, z.y2 - z.y1 - d.h);
    if (randomizeRotation) piece.rotation = randomRotation();
    piece.placed = false;
    board[piece.id] = null;
    clampPiece(piece);
  });
}

function setupTable() {
  boardEl.style.setProperty('--image-ratio', ratio());
  boardEl.replaceChildren();
  for (let i = 0; i < BOARD_TOTAL; i++) {
    const cell = document.createElement('span');
    const row = Math.floor(i / BOARD_N);
    const col = i % BOARD_N;
    cell.className = row === 0 || row === BOARD_N - 1 || col === 0 || col === BOARD_N - 1 ? 'frame-cell' : 'play-cell';
    boardEl.append(cell);
  }
  layer.replaceChildren();
  requestAnimationFrame(() => {
    scatterPieces(pieces, true);
    renderPieces();
    updateProgress();
  });
}

function renderPieces() {
  for (const piece of pieces) {
    if (!piece.el) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'jigsaw-piece';
      el.dataset.id = piece.id;
      el.innerHTML = `<img src="${piece.url}" alt="Kepingan ${piece.id + 1}">`;
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('dblclick', () => rotatePiece(piece.id, 90));
      piece.el = el;
      layer.append(el);
    }
    const d = pieceDisplaySize(piece);
    piece.el.style.width = `${d.w}px`;
    piece.el.style.height = `${d.h}px`;
    piece.el.style.transform = `translate(${piece.x}px, ${piece.y}px) rotate(${piece.rotation}deg)`;
    piece.el.classList.toggle('selected', piece.id === selectedId);
    piece.el.classList.toggle('placed', piece.placed);
    piece.el.disabled = false;
  }
  positionControls();
}

function selectPiece(id) {
  selectedId = id;
  renderPieces();
}

function onPointerDown(event) {
  const id = Number(event.currentTarget.dataset.id);
  const piece = pieces[id];
  if (!piece || piece.placed) return;
  selectPiece(id);
  const rect = event.currentTarget.getBoundingClientRect();
  const s = stageRect();
  drag = {
    id,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  piece.el.classList.add('dragging');
  piece.el.setPointerCapture(event.pointerId);
  event.preventDefault();
}

window.addEventListener('pointermove', event => {
  if (!drag) return;
  const piece = pieces[drag.id];
  const s = stageRect();
  piece.x = event.clientX - s.left - drag.offsetX;
  piece.y = event.clientY - s.top - drag.offsetY;
  clampPiece(piece);
  piece.el.style.transform = `translate(${piece.x}px, ${piece.y}px) rotate(${piece.rotation}deg)`;
  showSnapHint(piece);
  positionControls();
});

window.addEventListener('pointerup', event => {
  if (!drag) return;
  const piece = pieces[drag.id];
  piece.el.classList.remove('dragging', 'near-snap');
  try {
    piece.el.releasePointerCapture(event.pointerId);
  } catch (_) {}
  trySnap(piece);
  drag = null;
  renderPieces();
});

function showSnapHint(piece) {
  const target = targetPosition(piece);
  const distance = Math.hypot(piece.x - target.x, piece.y - target.y);
  piece.el.classList.toggle('near-snap', distance < SNAP_TOLERANCE * 1.7 && piece.rotation === 0);
}

function trySnap(piece) {
  const target = targetPosition(piece);
  const distance = Math.hypot(piece.x - target.x, piece.y - target.y);
  if (distance <= SNAP_TOLERANCE && piece.rotation === 0) {
    piece.x = target.x;
    piece.y = target.y;
    piece.placed = true;
    piece.rotation = 0;
    board[piece.id] = piece.id;
    selectedId = null;
    piece.el.classList.add('snap');
    setTimeout(() => piece.el?.classList.remove('snap'), 260);
    updateProgress();
  } else if (distance <= SNAP_TOLERANCE && piece.rotation !== 0) {
    notify('Posisi sudah dekat. Putar kepingan sampai tegak dulu.');
  }
}

function rotatePiece(id, delta) {
  const piece = pieces[id];
  if (!piece || piece.placed) return;
  piece.rotation = (piece.rotation + delta + 360) % 360;
  renderPieces();
  trySnap(piece);
}

function positionControls() {
  if (selectedId === null || !pieces[selectedId] || pieces[selectedId].placed) {
    controls.classList.add('hidden');
    controls.setAttribute('aria-hidden', 'true');
    return;
  }
  const piece = pieces[selectedId];
  const d = pieceDisplaySize(piece);
  controls.style.transform = `translate(${piece.x + d.w - 36}px, ${Math.max(68, piece.y - 40)}px)`;
  controls.classList.remove('hidden');
  controls.setAttribute('aria-hidden', 'false');
}

document.addEventListener('keydown', event => {
  if (selectedId === null) return;
  if (event.key.toLowerCase() === 'q') {
    rotatePiece(selectedId, -90);
    event.preventDefault();
  }
  if (event.key.toLowerCase() === 'e') {
    rotatePiece(selectedId, 90);
    event.preventDefault();
  }
});

$('rotateLeftBtn').onclick = () => selectedId !== null && rotatePiece(selectedId, -90);
$('rotateRightBtn').onclick = () => selectedId !== null && rotatePiece(selectedId, 90);

function updateProgress() {
  const count = pieces.filter(p => p.placed).length;
  $('progressCount').innerHTML = `${count} <span>/ 9</span>`;
  $('progressFill').style.width = `${count / TOTAL * 100}%`;
  if (gameStatus) {
    gameStatus.textContent = count === TOTAL
      ? 'Puzzle Completed!'
      : 'Catatan: tekan Q/E atau klik dua kali untuk memutar kepingan.';
  }
  if (count === TOTAL) completePuzzle();
}

function completePuzzle() {
  $('completeOverlay').classList.remove('hidden');
  notify('Puzzle Completed!');
}

$('playAgainBtn').onclick = () => resetGame();

$('shuffleBtn').onclick = () => {
  if (!pieces.length) return;
  scatterPieces(pieces.filter(p => !p.placed), true);
  renderPieces();
  notify('Kepingan yang belum terpasang sudah diacak.');
};

$('resetBtn').onclick = () => resetGame();

function resetGame() {
  if (!pieces.length) return;
  board = Array(TOTAL).fill(null);
  selectedId = null;
  $('completeOverlay').classList.add('hidden');
  pieces.forEach(piece => {
    piece.placed = false;
    piece.rotation = randomRotation();
  });
  scatterPieces(pieces, false);
  renderPieces();
  updateProgress();
  notify('Meja puzzle diatur ulang.');
}

$('showOriginal').onclick = () => {
  if (!img) return;
  $('referenceImage').src = imageUrl;
  $('referenceDialog').showModal();
};
$('closeReference').onclick = () => $('referenceDialog').close();

function createFrame() {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const x = Array.from({ length: BOARD_N + 1 }, (_, i) => Math.floor(i * w / BOARD_N));
  const y = Array.from({ length: BOARD_N + 1 }, (_, i) => Math.floor(i * h / BOARD_N));
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#9eaaaf';
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) / 400));
  ctx.beginPath();
  for (let i = 1; i < BOARD_N; i++) {
    ctx.moveTo(x[i], 0);
    ctx.lineTo(x[i], h);
    ctx.moveTo(0, y[i]);
    ctx.lineTo(w, y[i]);
  }
  ctx.stroke();
  ctx.strokeStyle = '#455064';
  ctx.strokeRect(.5, .5, w - 1, h - 1);
  return c;
}

function toBlob(c) {
  return new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(Error('Tidak dapat membuat PNG')), 'image/png'));
}

function download(b, name) {
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

$('exportBtn').onclick = async () => {
  if (!pieces.length) return;
  const btn = $('exportBtn');
  btn.disabled = true;
  notify('Menyiapkan 1 bingkai dan 9 file PNG...');
  try {
    if (typeof JSZip === 'undefined') throw Error('JSZip belum dimuat. Sambungkan internet kemudian refresh halaman.');
    const zip = new JSZip();
    const folder = zip.folder('Puzzle_World_Output');
    folder.file('bingkai_5x5.png', await toBlob(createFrame()));
    for (const p of pieces) folder.file(`piece_r${p.row + 1}_c${p.col + 1}.png`, await toBlob(p.canvas));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    download(blob, 'Puzzle_World_5x5.zip');
    notify('ZIP selesai diunduh.');
  } catch (e) {
    notify('Ekspor gagal: ' + e.message);
  } finally {
    btn.disabled = false;
  }
};

window.addEventListener('resize', () => {
  if (!pieces.length || $('playSection').classList.contains('hidden')) return;
  pieces.forEach(piece => {
    if (piece.placed) {
      const t = targetPosition(piece);
      piece.x = t.x;
      piece.y = t.y;
    } else {
      clampPiece(piece);
    }
  });
  renderPieces();
});
