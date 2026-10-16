(function () {
  const $ = id => document.getElementById(id);
  let selectedFile = null;
  let previewUrl = '';

  function notify(message) {
    $('status').textContent = message;
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => $('toast').classList.remove('visible'), 2700);
  }

  window.PuzzleUI = { notify };

  $('startBtn').onclick = () => $('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('changeBtn').onclick = () => $('fileInput').click();

  const mosaic = $('heroMosaic');
  for (let i = 0; i < 25; i++) {
    const tile = document.createElement('div');
    if ([1, 2, 5, 7, 10, 11, 16, 21].includes(i)) tile.classList.add('filled');
    mosaic.append(tile);
  }

  $('fileInput').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('File harus berupa gambar.');
      return;
    }
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    const preview = new Image();
    preview.onload = () => {
      const container = $('uploadPreview');
      const decorations = [...container.querySelectorAll('.asset')];
      preview.alt = 'Pratinjau gambar';
      container.replaceChildren(...decorations, preview);
      container.classList.add('has-image');
      $('fileMeta').textContent = `${file.name} - ${preview.naturalWidth} x ${preview.naturalHeight} px`;
      $('generateBtn').disabled = false;
      $('changeBtn').disabled = false;
      $('playSection').classList.add('hidden');
      notify('Gambar siap diproses oleh Python.');
    };
    preview.onerror = () => notify('Gagal membaca gambar ini.');
    preview.src = previewUrl;
  });

  $('generateBtn').onclick = async () => {
    if (!selectedFile) return;
    const button = $('generateBtn');
    button.disabled = true;
    button.textContent = 'Memproses...';
    notify('Python sedang membuat bingkai dan 9 kepingan jigsaw...');
    const body = new FormData();
    body.append('image', selectedFile);
    try {
      const response = await fetch('/api/generate', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Gagal memproses gambar.');
      await window.PuzzleGame.load(result);
      $('playSection').classList.remove('hidden');
      notify('9 kepingan siap dimainkan.');
      setTimeout(() => $('playSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (error) {
      notify(error.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Buat puzzle';
    }
  };
})();
