(function installApartmentFile() {
  'use strict';
  const MAX_BYTES = 8 * 1024 * 1024;
  const vendor = new URL('static/vendor/pdfjs/', document.baseURI).href;
  async function pdfLibrary() {
    const lib = await import('./vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = vendor + 'pdf.worker.min.mjs';
    return lib;
  }
  const pdfOptions = {cMapUrl:vendor + 'cmaps/', cMapPacked:true, standardFontDataUrl:vendor + 'standard_fonts/',
    wasmUrl:vendor + 'wasm/', iccUrl:vendor + 'iccs/', isEvalSupported:false};

  async function prepareFile(file) {
    if (!file.size || file.size > MAX_BYTES) throw new Error('Көлемі 8 МБ-тан аспайтын файлды таңдаңыз.');
    const prefix = String.fromCharCode(...new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (prefix.startsWith('%PDF-')) {
      const lib = await pdfLibrary();
      const task = lib.getDocument({...pdfOptions, data:await file.arrayBuffer()});
      try { const pdf = await task.promise; await pdf.getPage(1); }
      catch { throw new Error('Жоспар ашылмады. Құпиясөзсіз ашылатын PDF файлын таңдаңыз.'); }
      finally { await task.destroy(); }
      return file.slice(0, file.size, 'application/pdf');
    }
    if (!(prefix.startsWith('\xff\xd8\xff') || prefix.startsWith('\x89PNG\r\n\x1a\n')
        || (prefix.startsWith('RIFF') && prefix.endsWith('WEBP')))) {
      throw new Error('JPG, PNG, WebP суретін немесе PDF жоспарын таңдаңыз.');
    }
    // Export only the displayed pixels, including the device's photo orientation.
    const photo = new Image(), url = URL.createObjectURL(file);
    const canvas = document.createElement('canvas');
    try {
      photo.src = url;
      await photo.decode();
      for (const limit of [2400, 1380]) {
        const scale = Math.min(1, limit / Math.max(photo.naturalWidth, photo.naturalHeight));
        canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
        canvas.getContext('2d').drawImage(photo, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob && blob.size <= MAX_BYTES) return blob;
      }
      throw new Error();
    } catch { throw new Error('Сурет ашылмады. Басқа фотоны немесе жоспарды таңдаңыз.'); }
    finally { canvas.width = canvas.height = 0; URL.revokeObjectURL(url); }
  }

  function mount(root, user, api, ic) {
    root.className = 'apartment-file card';
    root.innerHTML = `<h3>${ic('image')} Пәтердің фотосы немесе жоспары</h3>`;
    if (user.demo) {
      root.insertAdjacentHTML('beforeend','<p class="small muted">Файл қосу үшін жеке аккаунтқа кіріңіз.</p>');
      return {destroy() {}};
    }
    root.insertAdjacentHTML('beforeend', `
      <p class="small muted">Файл тек сізге көрінеді. JPG, PNG, WebP немесе PDF · 8 МБ дейін.</p>
      <img class="flat-photo" data-photo alt="Пәтерге тіркелген фото немесе жоспар" hidden>
      <div class="row">
        <input type="file" data-file-input accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" hidden>
        <button class="btn" type="button" data-file-choose disabled>${ic('plus')}<span>Файл қосу</span></button>
        <button class="btn" type="button" data-open-pdf hidden>PDF жоспарын ашу</button>
        <button class="btn btn-sm" type="button" data-file-remove hidden>Өшіру</button>
        <button class="btn btn-sm" type="button" data-file-retry hidden>Қайталау</button>
      </div>
      <div class="flat-pdf" data-pdf-view hidden>
        <canvas aria-label="Пәтер жоспарының беті"></canvas>
        <div class="row">
          <button class="btn btn-sm" type="button" data-prev aria-label="Алдыңғы бет">←</button>
          <span data-page aria-live="polite"></span>
          <button class="btn btn-sm" type="button" data-next aria-label="Келесі бет">→</button>
        </div>
      </div>
      <p class="small flat-file-status" data-file-status role="status"></p>`);
    const el = (selector) => root.querySelector(selector);
    const input = el('[data-file-input]'), choose = el('[data-file-choose]'), remove = el('[data-file-remove]');
    const pdfButton = el('[data-open-pdf]'), photo = el('[data-photo]'), viewer = el('[data-pdf-view]');
    const prev = el('[data-prev]'), next = el('[data-next]'), canvas = el('canvas'), retry = el('[data-file-retry]');
    let alive = true, metadata = null, locked = true, loading = null, pdf = null, drawing = null, revision = 0, page = 1;
    const status = (text) => { if (alive) el('[data-file-status]').textContent = text; };
    const fileUrl = () => '/api/apartment-file?v=' + encodeURIComponent(metadata.version);
    function lock(value) { locked = value; choose.disabled = value; remove.disabled = value; }
    function closePdf() {
      revision++; drawing?.cancel(); drawing = null;
      if (loading) loading.destroy().catch(() => {});
      loading = null; pdf = null; page = 1; canvas.width = canvas.height = 0;
      viewer.hidden = true; pdfButton.textContent = 'PDF жоспарын ашу';
    }
    function display(file) {
      closePdf(); metadata = file;
      choose.querySelector('span').textContent = file ? 'Файлды ауыстыру' : 'Файл қосу';
      remove.hidden = !file; pdfButton.hidden = file?.mime !== 'application/pdf';
      photo.hidden = file?.mime !== 'image/png';
      if (photo.hidden) photo.removeAttribute('src'); else photo.src = fileUrl();
    }
    async function refresh() {
      retry.hidden = true; lock(true);
      try {
        const res = await api('apartment-file-info');
        if (alive) { display(res.file); lock(false); status(''); }
      } catch (e) { if (alive) { retry.hidden = false; status(e.message); } }
    }
    async function change(file) {
      if (locked) return;
      const expected = metadata?.version || 'new';
      lock(true); status(file ? 'Файл жүктелуде…' : 'Файл өшірілуде…');
      try {
        let result;
        if (file) {
          const content = await prepareFile(file);
          if (!alive) return;
          result = await api('apartment-file?v=' + expected, content);
        } else result = await api('apartment-file-remove', {version:expected});
        if (alive) { display(result.file); status(file ? 'Файл сақталды.' : 'Файл өшірілді.'); }
      } catch (e) {
        if (alive && e.status === 409) await refresh();
        status(e.message);
      } finally { if (alive && retry.hidden) lock(false); }
    }
    async function drawPage() {
      const version = ++revision;
      drawing?.cancel(); prev.disabled = next.disabled = true;
      try {
        const sheet = await pdf.getPage(page);
        if (version !== revision) return;
        const unit = sheet.getViewport({scale:1});
        const scale = Math.min((root.clientWidth || 600) * Math.min(window.devicePixelRatio || 1, 2) / unit.width,
          2000 / Math.max(unit.width,unit.height));
        const viewport = sheet.getViewport({scale});
        canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
        drawing = sheet.render({canvasContext:canvas.getContext('2d'), canvas, viewport});
        await drawing.promise;
        if (version === revision) { el('[data-page]').textContent = `${page} / ${pdf.numPages}`; status(''); }
      } catch { if (version === revision) status('Жоспардың бұл беті ашылмады.'); }
      finally { if (version === revision) { drawing = null; prev.disabled = page === 1; next.disabled = page === pdf.numPages; } }
    }
    pdfButton.onclick = async () => {
      if (!viewer.hidden) { closePdf(); status(''); return; }
      const version = ++revision;
      viewer.hidden = false; prev.disabled = next.disabled = true; el('[data-page]').textContent = '';
      pdfButton.textContent = 'Жоспарды жабу'; status('Жоспар жүктелуде…');
      try {
        const lib = await pdfLibrary();
        if (version !== revision) return;
        loading = lib.getDocument({...pdfOptions, url:fileUrl()});
        const document = await loading.promise;
        if (version !== revision) return;
        pdf = document; await drawPage();
      } catch { if (version === revision) { closePdf(); status('PDF жоспары ашылмады.'); } }
    };
    choose.onclick = () => input.click();
    input.onchange = () => { const file = input.files[0]; input.value = ''; if (file) change(file); };
    remove.onclick = () => { if (metadata && confirm('Пәтерге тіркелген файлды өшіресіз бе?')) change(null); };
    prev.onclick = () => { if (pdf && page > 1) { page--; drawPage(); } };
    next.onclick = () => { if (pdf && page < pdf.numPages) { page++; drawPage(); } };
    retry.onclick = refresh;
    refresh();
    return {destroy() { alive = false; closePdf(); photo.removeAttribute('src'); }};
  }
  window.ApartmentFile = {mount};
})();
