(function () {
  const $ = id => document.getElementById(id);
  const ROTATIONS = [0, 90, 180, 270];
  let puzzle = null;
  let pieces = [];
  let selectedId = null;
  let drag = null;

  const stage = $('tableStage');
  const board = $('board');
  const layer = $('piecesLayer');
  const controls = $('rotationControls');
  const frame = $('boardFrame');
  const gameStatus = $('gameStatus');

  function randomRotation() {
    return ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
  }

  function stageRect() {
    return stage.getBoundingClientRect();
  }

  function boardMetrics() {
    const b = board.getBoundingClientRect();
    const s = stageRect();
    return {
      x: b.left - s.left + board.clientLeft,
      y: b.top - s.top + board.clientTop,
      w: board.clientWidth,
      h: board.clientHeight,
    };
  }

  function displaySize(piece) {
    const boardBox = boardMetrics();
    return {
      w: piece.canvasWidth / puzzle.width * boardBox.w,
      h: piece.canvasHeight / puzzle.height * boardBox.h,
      paddingX: piece.padding / puzzle.width * boardBox.w,
      paddingY: piece.padding / puzzle.height * boardBox.h,
    };
  }

  function targetPosition(piece) {
    const boardBox = boardMetrics();
    const size = displaySize(piece);
    return {
      x: boardBox.x + piece.sourceX / puzzle.width * boardBox.w - size.paddingX,
      y: boardBox.y + piece.sourceY / puzzle.height * boardBox.h - size.paddingY,
    };
  }

  function snapTolerance(piece) {
    const size = displaySize(piece);
    return Math.max(16, Math.min(44, Math.min(size.w, size.h) * .22));
  }

  function isOpaquePoint(piece, clientX, clientY) {
    const area = stageRect();
    const size = displaySize(piece);
    const centerX = piece.x + size.w / 2;
    const centerY = piece.y + size.h / 2;
    const dx = clientX - area.left - centerX;
    const dy = clientY - area.top - centerY;
    const angle = -piece.rotation * Math.PI / 180;
    const localX = (Math.cos(angle) * dx - Math.sin(angle) * dy + size.w / 2) / size.w * piece.canvasWidth;
    const localY = (Math.sin(angle) * dx + Math.cos(angle) * dy + size.h / 2) / size.h * piece.canvasHeight;
    const x0 = piece.padding;
    const y0 = piece.padding;
    const x1 = x0 + piece.sourceWidth;
    const y1 = y0 + piece.sourceHeight;
    const radius = Math.max(2, Math.round(Math.min(piece.sourceWidth, piece.sourceHeight) * .18));
    let inside = localX >= x0 && localX <= x1 && localY >= y0 && localY <= y1;
    const centers = {
      top: [(x0 + x1) / 2, y0],
      right: [x1, (y0 + y1) / 2],
      bottom: [(x0 + x1) / 2, y1],
      left: [x0, (y0 + y1) / 2],
    };
    Object.entries(piece.edges).forEach(([side, edge]) => {
      if (!edge) return;
      const [cx, cy] = centers[side];
      const inCircle = Math.hypot(localX - cx, localY - cy) <= radius;
      if (edge > 0 && inCircle) inside = true;
      if (edge < 0 && inCircle) inside = false;
    });
    return inside;
  }

  function clampPiece(piece) {
    const area = stageRect();
    const size = displaySize(piece);
    piece.x = Math.max(8, Math.min(piece.x, area.width - size.w - 8));
    piece.y = Math.max(8, Math.min(piece.y, area.height - size.h - 8));
  }

  function scatter(targets, randomize = true) {
    const b = boardMetrics();
    const area = stageRect();
    const zones = [
      { x1: 18, y1: 20, x2: Math.max(22, b.x - 30), y2: area.height - 90 },
      { x1: b.x + b.w + 30, y1: 20, x2: area.width - 100, y2: area.height - 90 },
      { x1: Math.max(18, b.x - 70), y1: 20, x2: Math.min(area.width - 100, b.x + b.w + 70), y2: Math.max(24, b.y - 32) },
      { x1: Math.max(18, b.x - 70), y1: b.y + b.h + 32, x2: Math.min(area.width - 100, b.x + b.w + 70), y2: area.height - 74 },
    ].filter(zone => zone.x2 > zone.x1 && zone.y2 > zone.y1);

    const occupied = [];
    const overlapArea = candidate => occupied.reduce((total, other) => {
      const width = Math.max(0, Math.min(candidate.x + candidate.w, other.x + other.w) - Math.max(candidate.x, other.x));
      const height = Math.max(0, Math.min(candidate.y + candidate.h, other.y + other.h) - Math.max(candidate.y, other.y));
      return total + width * height;
    }, 0);

    targets.forEach((piece, index) => {
      const zone = zones[index % zones.length] || { x1: 12, y1: 12, x2: area.width - 100, y2: area.height - 90 };
      const size = displaySize(piece);
      let best = null;
      for (let attempt = 0; attempt < 24; attempt++) {
        const candidate = {
          x: zone.x1 + Math.random() * Math.max(1, zone.x2 - zone.x1 - size.w),
          y: zone.y1 + Math.random() * Math.max(1, zone.y2 - zone.y1 - size.h),
          w: size.w,
          h: size.h,
        };
        candidate.score = overlapArea(candidate);
        if (!best || candidate.score < best.score) best = candidate;
        if (candidate.score === 0) break;
      }
      piece.x = best.x;
      piece.y = best.y;
      if (randomize) piece.rotation = randomRotation();
      piece.placed = false;
      clampPiece(piece);
      occupied.push({ x: piece.x, y: piece.y, w: size.w, h: size.h });
    });
  }

  function render() {
    for (const piece of pieces) {
      if (!piece.el) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'jigsaw-piece';
        element.dataset.id = piece.id;
        const image = new Image();
        image.src = piece.url;
        image.alt = `Kepingan ${piece.id + 1}`;
        element.append(image);
        element.addEventListener('pointerdown', pointerDown);
        element.addEventListener('dblclick', () => rotate(piece.id, 90));
        piece.el = element;
        layer.append(element);
      }
      const size = displaySize(piece);
      piece.el.style.width = `${size.w}px`;
      piece.el.style.height = `${size.h}px`;
      piece.el.style.transform = `translate(${piece.x}px, ${piece.y}px) rotate(${piece.rotation}deg)`;
      piece.el.classList.toggle('selected', piece.id === selectedId);
      piece.el.classList.toggle('placed', piece.placed);
    }
    positionControls();
  }

  function pointerDown(event) {
    const piece = pieces[Number(event.currentTarget.dataset.id)];
    if (!piece || piece.placed || !isOpaquePoint(piece, event.clientX, event.clientY)) return;
    selectedId = piece.id;
    drag = {
      id: piece.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      pieceX: piece.x,
      pieceY: piece.y,
    };
    piece.el.classList.add('dragging');
    piece.el.setPointerCapture(event.pointerId);
    render();
    event.preventDefault();
  }

  window.addEventListener('pointermove', event => {
    if (!drag) return;
    const piece = pieces[drag.id];
    piece.x = drag.pieceX + event.clientX - drag.pointerX;
    piece.y = drag.pieceY + event.clientY - drag.pointerY;
    clampPiece(piece);
    piece.el.style.transform = `translate(${piece.x}px, ${piece.y}px) rotate(${piece.rotation}deg)`;
    const target = targetPosition(piece);
    const distance = Math.hypot(piece.x - target.x, piece.y - target.y);
    piece.el.classList.toggle('near-snap', distance < snapTolerance(piece) * 1.7 && piece.rotation === 0);
    positionControls();
  });

  window.addEventListener('pointerup', event => {
    if (!drag) return;
    const piece = pieces[drag.id];
    piece.el.classList.remove('dragging', 'near-snap');
    try { piece.el.releasePointerCapture(event.pointerId); } catch (_) {}
    trySnap(piece);
    drag = null;
    render();
  });

  function trySnap(piece) {
    const target = targetPosition(piece);
    const distance = Math.hypot(piece.x - target.x, piece.y - target.y);
    const tolerance = snapTolerance(piece);
    if (distance <= tolerance && piece.rotation === 0) {
      piece.x = target.x;
      piece.y = target.y;
      piece.placed = true;
      selectedId = null;
      piece.el.classList.add('snap');
      setTimeout(() => piece.el?.classList.remove('snap'), 260);
      updateProgress();
    } else if (distance <= tolerance) {
      window.PuzzleUI.notify('Posisinya dekat. Putar kepingan sampai tegak.');
    }
  }

  function rotate(id, delta) {
    const piece = pieces[id];
    if (!piece || piece.placed) return;
    piece.rotation = (piece.rotation + delta + 360) % 360;
    render();
    trySnap(piece);
  }

  function positionControls() {
    const piece = selectedId === null ? null : pieces[selectedId];
    if (!piece || piece.placed) {
      controls.classList.add('hidden');
      return;
    }
    const size = displaySize(piece);
    controls.style.transform = `translate(${piece.x + size.w - 36}px, ${Math.max(8, piece.y - 40)}px)`;
    controls.classList.remove('hidden');
  }

  function updateProgress() {
    const count = pieces.filter(piece => piece.placed).length;
    const total = pieces.length;
    $('progressCount').innerHTML = `${count} <span>/ ${total}</span>`;
    $('progressFill').style.width = `${count / total * 100}%`;
    gameStatus.textContent = count === total
      ? 'Puzzle selesai!'
      : 'Catatan: tekan Q/E atau klik dua kali untuk memutar kepingan.';
    if (count === total) {
      $('completeOverlay').classList.remove('hidden');
      window.PuzzleUI.notify('Puzzle selesai!');
    }
  }

  function reset() {
    selectedId = null;
    $('completeOverlay').classList.add('hidden');
    pieces.forEach(piece => {
      piece.placed = false;
      piece.rotation = randomRotation();
    });
    scatter(pieces, false);
    render();
    updateProgress();
  }

  async function load(data) {
    puzzle = data;
    selectedId = null;
    frame.src = data.frameUrl;
    board.style.setProperty('--image-ratio', `${data.width}/${data.height}`);
    layer.replaceChildren();
    pieces = data.pieces.map(piece => ({ ...piece, x: 0, y: 0, rotation: randomRotation(), placed: false, el: null }));
    $('completeOverlay').classList.add('hidden');
    await Promise.all(pieces.map(piece => new Promise(resolve => {
      const image = new Image();
      image.onload = image.onerror = resolve;
      image.src = piece.url;
    })));
    requestAnimationFrame(() => {
      scatter(pieces, true);
      render();
      updateProgress();
    });
  }

  $('rotateLeftBtn').onclick = () => selectedId !== null && rotate(selectedId, -90);
  $('rotateRightBtn').onclick = () => selectedId !== null && rotate(selectedId, 90);
  document.addEventListener('keydown', event => {
    if (selectedId === null) return;
    if (event.key.toLowerCase() === 'q') rotate(selectedId, -90);
    if (event.key.toLowerCase() === 'e') rotate(selectedId, 90);
  });
  $('shuffleBtn').onclick = () => {
    scatter(pieces.filter(piece => !piece.placed), true);
    render();
    window.PuzzleUI.notify('Kepingan yang belum terpasang sudah diacak.');
  };
  $('resetBtn').onclick = reset;
  $('playAgainBtn').onclick = reset;
  $('showOriginal').onclick = () => {
    if (!puzzle) return;
    $('referenceImage').src = puzzle.guideUrl;
    $('referenceDialog').showModal();
  };
  $('closeReference').onclick = () => $('referenceDialog').close();
  $('exportBtn').onclick = () => {
    if (puzzle) window.location.assign(puzzle.exportUrl);
  };
  window.addEventListener('resize', () => {
    if (!puzzle || $('playSection').classList.contains('hidden')) return;
    pieces.forEach(piece => {
      if (piece.placed) Object.assign(piece, targetPosition(piece));
      else clampPiece(piece);
    });
    render();
  });

  window.PuzzleGame = { load };
})();
