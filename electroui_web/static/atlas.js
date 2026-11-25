(function installAtlas() {
  'use strict';
  const ASTANA = [51.14, 71.43];
  const EXAMPLES = [
    ['Астана орталығы', [51.13, 71.43]], ['Есіл', [51.09, 71.42]], ['Сарыарқа', [51.18, 71.40]],
  ];
  const markerHTML = '<span class="atlas-building" aria-hidden="true"><i></i><b></b><em></em></span>';
  const labelNode = (text) => { const span = document.createElement('span'); span.textContent = text; return span; };

  function open(root, {user, api, pageThree, setState, ownState, fW, fKwh, ic}) {
    const operator = user.role === 'ADMIN';
    root.innerHTML = `
      <div class="atlas-layout">
        <section class="atlas-surface">
          <header class="atlas-head"><h2>${ic('building')} Энергия картасы</h2>
            <div class="row"><button class="btn btn-sm" data-mode aria-pressed="false">3D карта</button><button class="btn btn-sm" data-city>Астана</button>
            ${operator ? '<button class="btn btn-sm" data-fit>Барлық белгі</button>' : ''}</div>
          </header>
          <div class="atlas-map" data-map aria-label="Астана қаласындағы пәтерлер картасы"></div>
          <div class="atlas-map" data-city-scene aria-label="Пәтер қуатының үш өлшемді картасы" hidden></div>
          <p class="atlas-tile-error" data-tile-error role="status" hidden>Карта қабаты жүктелмеді. Пәтерді тізімнен таңдап, 3D үлгісін аша аласыз.</p>
          <div class="atlas-legend"><span class="atlas-dot"></span><span data-legend>Пәтердің шамамен орналасқан жері</span></div>
          ${operator ? '<p class="atlas-overview" data-overview></p>' : ''}
        </section>
        <section class="atlas-surface atlas-directory">
          <header class="atlas-head"><h2>${operator ? 'Пәтерлер' : 'Менің пәтерім'} <small data-count></small></h2>
            <button class="icon-btn" data-refresh title="Деректерді жаңарту" aria-label="Деректерді жаңарту">${ic('reset')}</button></header>
          <p class="atlas-caption">${operator ? (user.demo ? 'Демо кабинетте ойдан алынған пәтерлер көрсетілген.' : 'Орны көрсетілмеген пәтерлер де тізімге кіреді.') : 'Құралдар мен бөлмелер бойынша тұтынуды 3D үлгіде көріңіз.'}</p>
          <div class="atlas-list" data-list aria-live="polite"></div>
        </section>
      </div>
      ${operator ? '' : `<section class="card atlas-editor">
        <h3>${ic('building')} Пәтерді картаға белгілеу</h3>
        <p class="small muted">${user.demo ? 'Ортақ демода Астананың үлгі орындары қолданылады. GPS пен өз пәтеріңіз үшін жеке аккаунтқа кіріңіз.' : 'Сақтасаңыз, өзіңіз бен сектор әкімшісі шамамен 1 км аумақты көресіздер. Нақты мекенжай сұралмайды. Белгіні кейін өшіре аласыз.'}</p>
        <div class="row">${user.demo ? `<label class="atlas-example">Үлгі орын <select data-example><option value="">Таңдаңыз</option>${EXAMPLES.map(([label], i) => `<option value="${i}">${label}</option>`).join('')}</select></label>` :
          `<button class="btn btn-primary" data-gps>${ic('orbit')} GPS арқылы табу</button>
           <button class="btn" data-pick>Картадан таңдау</button>`}
          <button class="btn btn-sm" data-remove hidden>Белгіні өшіру</button></div>
        <div class="atlas-preview-actions row" data-actions hidden>
          <button class="btn" data-center hidden>Карта ортасын таңдау</button>
          <button class="btn btn-primary" data-save hidden>Осы орынды сақтау</button>
          <button class="btn" data-cancel>Болдырмау</button>
        </div>
      </section>`}
      <p class="atlas-message" data-msg role="status" aria-live="polite"></p>
      <section class="atlas-inspection" data-detail hidden>
        <header class="atlas-head"><h2 data-model-title></h2><button class="btn btn-sm" data-return>${ic('up')} Картаға оралу</button></header>
        <div class="page" data-atlas-model></div>
      </section>`;
    const find = (q) => root.querySelector(q);
    const mapNode = find('[data-map]'), detail = find('[data-detail]');
    if (!operator) {
      const editor = find('.atlas-editor');
      mapNode.parentElement.append(editor);
      editor.append(find('[data-msg]'));
    }
    let alive = true, map = null, markers = null, preview = null, scene = null;
    let city = null, in3d = false, modeVersion = 0;
    let items = [], selected = null, candidate = null, picking = false, busy = false;
    let geoVersion = 0, detailVersion = 0, listVersion = 0;
    function message(text) { find('[data-msg]').textContent = text; }

    if (window.L) {
      map = L.map(mapNode, {scrollWheelZoom:false, minZoom:2, maxZoom:18}).setView(ASTANA, 12);
      let loadedTiles = 0;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).on('loading', () => { loadedTiles = 0; })
        .on('tileload', () => { loadedTiles++; find('[data-tile-error]').hidden = true; })
        .on('load', () => { find('[data-tile-error]').hidden = loadedTiles > 0; }).addTo(map);
      markers = L.layerGroup().addTo(map);
      map.on('click', ({latlng}) => { if (picking) choose(latlng.lat, latlng.lng); });
    } else {
      mapNode.hidden = true; find('[data-tile-error]').hidden = false;
    }

    function drawMarkers() {
      city?.update(items, selected);
      if (!map) return;
      markers.clearLayers();
      const groups = new Map();
      items.filter((i) => i.point).forEach((i) => {
        const key = i.point.join(',');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
      });
      for (const group of groups.values()) {
        const first = group[0];
        const title = group.length === 1 ? first.label : `${group.length} пәтер`;
        const focused = group.some((i) => i.id === selected);
        const icon = L.divIcon({className:`atlas-pin${focused ? ' selected' : ''}`, iconSize:[36,42],
          iconAnchor:[18,41], popupAnchor:[0,-36], html:markerHTML + (group.length > 1 ? `<strong>${group.length}</strong>` : '')});
        const pin = L.marker(first.point, {icon, title, alt:title, riseOnHover:true}).addTo(markers);
        pin.bindTooltip(labelNode(title), {direction:'top', offset:[0,-32]});
        if (group.length === 1) pin.on('click', () => inspect(first, true));
        else {
          const choices = document.createElement('div');
          choices.className = 'atlas-popup';
          for (const item of group) {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = `${item.label} · 3D`;
            button.onclick = () => { map.closePopup(); inspect(item, true); };
            choices.append(button);
          }
          pin.bindPopup(choices);
        }
      }
    }
    function drawList() {
      const list = find('[data-list]'); list.replaceChildren();
      find('[data-count]').textContent = operator ? String(items.length) : '';
      if (operator) {
        const totalPower = items.reduce((sum, i) => sum + i.power, 0);
        const totalEnergy = items.reduce((sum, i) => sum + i.kwhDay, 0);
        find('[data-overview]').textContent = items.length ? `Барлық пәтер · ${fW(totalPower, 0)} · ${fKwh(totalEnergy)}/тәул.` : '';
      }
      if (!items.length) list.textContent = 'Тізім әзірге бос.';
      for (const item of items) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'atlas-flat'; button.dataset.apartment = item.id;
        button.setAttribute('aria-pressed', String(selected === item.id));
        button.innerHTML = `<span class="atlas-flat-top"><b></b><small>${item.point ? 'Картада' : 'Орны белгіленбеген'}</small></span>
          <span class="atlas-meters"><span>Қосулы қуат<strong>${fW(item.power, 0)}</strong></span>
          <span>Есептік тәуліктік шығын<strong>${fKwh(item.kwhDay)}</strong></span></span>
          <span class="atlas-open">${ic('cube')} 3D үлгісін ашу →</span>`;
        button.querySelector('b').textContent = item.label;
        button.onclick = () => inspect(item, true);
        list.append(button);
      }
      if (!operator) find('[data-remove]').hidden = !items.some((i) => i.point);
      drawMarkers();
    }
    function closeScene() { if (scene) scene.destroy(); scene = null; }
    async function inspect(item, scroll) {
      const revision = ++detailVersion;
      selected = item.id; closeScene(); drawList();
      detail.hidden = false;
      find('[data-model-title]').textContent = `${item.label} · 3D`;
      const host = find('[data-atlas-model]'); host.textContent = 'Пәтер үлгісі жүктелуде…';
      if (scroll) {
        if (item.point && map) map.setView(item.point, Math.max(map.getZoom(), 13));
        detail.scrollIntoView({block:'start'});
      }
      try {
        const snapshot = await api(operator ? `apartment-view?id=${item.id}` : 'state');
        if (!alive || revision !== detailVersion) return;
        if (!operator) setState(snapshot);
        scene = pageThree(host, operator ? snapshot : null);
        Object.assign(item, {power:snapshot.totals.power, kwhDay:snapshot.totals.kwhDay});
        drawList();
      } catch (e) { if (alive && revision === detailVersion) host.textContent = e.message; }
    }
    async function refresh(initial = false) {
      const revision = ++listVersion;
      try {
        const result = await api('apartments');
        if (!alive || revision !== listVersion) return;
        items = result.items; drawList();
        const own = items.find((i) => i.id === user.id);
        if (initial && own?.point && !operator && map) map.setView(own.point, 13);
        if (initial && operator && items.some((i) => i.point)) showAll();
        if (selected !== null) {
          const current = items.find((i) => i.id === selected);
          if (current) await inspect(current, false);
          else { ++detailVersion; closeScene(); selected = null; detail.hidden = true; }
        }
      } catch (e) { if (alive && revision === listVersion) message(e.message); }
    }
    function flatMap() {
      modeVersion++; in3d = false;
      find('[data-city-scene]').hidden = true; mapNode.hidden = !map;
      find('[data-mode]').setAttribute('aria-pressed', 'false');
      find('[data-mode]').textContent = '3D карта';
      find('[data-legend]').textContent = 'Пәтердің шамамен орналасқан жері';
      map?.invalidateSize();
    }
    find('[data-mode]').onclick = async () => {
      if (in3d) { flatMap(); return; }
      if (!map) return;
      const version = ++modeVersion, button = find('[data-mode]');
      button.disabled = true;
      try {
        const gl = await EnergyCityScene.loadLibrary();
        if (!alive || version !== modeVersion) return;
        if (!operator) clearDraft();
        const center = map.getCenter(), zoom = map.getZoom(), host = find('[data-city-scene]');
        mapNode.hidden = true; host.hidden = false;
        if (!city) city = EnergyCityScene.create(gl, host, center, zoom, (item) => inspect(item, true));
        city.reset(center, zoom); city.update(items, selected);
        in3d = true; button.setAttribute('aria-pressed', 'true'); button.textContent = '2D карта';
        find('[data-legend]').textContent = 'Баған биіктігі қосулы қуатты көрсетеді. Пәтерді ашу үшін бағанды басыңыз.';
      } catch (e) { if (alive) { flatMap(); message('Бұл құрылғыда 3D карта ашылмады. Пәтерді 2D картадан таңдаңыз.'); } }
      finally { button.disabled = false; }
    };
    find('[data-city]').onclick = () => { map?.setView(ASTANA, 12); if (in3d) city.reset(map.getCenter(), 12); };
    find('[data-refresh]').onclick = () => refresh();
    find('[data-return]').onclick = () => root.scrollIntoView({block:'start'});
    function showAll() {
      const points = items.filter((i) => i.point).map((i) => i.point);
      if (in3d && points.length) { city.showAll(points); return; }
      if (map && points.length) map.fitBounds(points, {paddingTopLeft:[36,52], paddingBottomRight:[36,28], maxZoom:14});
      else message('Картада көрсетілетін белгі жоқ.');
    }
    if (operator) find('[data-fit]').onclick = showAll;
    function clearDraft() {
      geoVersion++; picking = false; candidate = null;
      mapNode.classList.remove('atlas-picking');
      if (preview) { preview.remove(); preview = null; }
      find('[data-actions]').hidden = true;
      if (user.demo) find('[data-example]').value = '';
    }
    function choose(lat, lon) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85) { message('Бұл орынды картада көрсету мүмкін емес.'); return; }
      clearDraft();
      flatMap();
      const latCell = Math.round(lat * 100), lonCell = Math.round((((lon + 180) % 360 + 360) % 360 - 180) * 100);
      candidate = {latCell, lonCell};
      const y = latCell / 100, x = lonCell / 100;
      if (map) {
        map.setView([y,x], 14);
        preview = L.rectangle([[y-.005,x-.005],[y+.005,x+.005]], {color:'#097f78', weight:3, fillOpacity:.2, interactive:false}).addTo(map);
      }
      find('[data-actions]').hidden = false; find('[data-center]').hidden = true; find('[data-save]').hidden = false;
      message('Таңдалған аумақ дайын. Картадан тексеріп, орынды сақтаңыз.');
    }
    async function save(data) {
      if (busy) return;
      busy = true;
      const controls = root.querySelectorAll('.atlas-editor button, .atlas-editor select');
      controls.forEach((b) => { b.disabled = true; });
      try {
        const result = await api('apartment-location', data);
        if (!alive) return;
        ++listVersion; items = result.items; clearDraft(); drawList();
        message(data.remove ? 'Картадағы белгі өшірілді. 3D үлгіңіз сақталды.' : 'Пәтер картаға белгіленді. Белгіні басып, 3D үлгісін ашыңыз.');
      } catch (e) { if (alive) message(e.message); }
      finally { busy = false; controls.forEach((b) => { b.disabled = false; }); }
    }
    if (!operator) {
      find('[data-save]').onclick = () => { if (candidate) save(candidate); };
      find('[data-cancel]').onclick = () => { clearDraft(); message('Орынды таңдау тоқтатылды.'); };
      find('[data-remove]').onclick = () => { if (window.confirm('Пәтер белгісін картадан өшіресіз бе?')) save({remove:true}); };
      if (user.demo) {
        find('[data-example]').onchange = (event) => {
          const index = event.target.value;
          if (!index) { clearDraft(); message(''); return; }
          choose(...EXAMPLES[Number(index)][1]);
          event.target.value = index;
        };
      } else {
        find('[data-gps]').onclick = () => {
          clearDraft();
          if (!navigator.geolocation || !window.isSecureContext) { message('GPS қолжетімсіз. Орынды картадан таңдаңыз.'); return; }
          const revision = geoVersion; message('Браузерден орналасқан жерді анықтауға рұқсат күтілуде…');
          navigator.geolocation.getCurrentPosition(({coords}) => {
            if (alive && revision === geoVersion) choose(coords.latitude, coords.longitude);
          }, (err) => {
            if (alive && revision === geoVersion) message(err.code === 1 ? 'GPS рұқсаты берілмеді. «Картадан таңдау» арқылы жалғастырыңыз.' : 'Орныңыз анықталмады. Қайталап көріңіз немесе картадан таңдаңыз.');
          }, {enableHighAccuracy:false, timeout:12000, maximumAge:60000});
        };
        find('[data-pick]').onclick = () => {
          flatMap();
          clearDraft(); if (!map) { message('Карта қолжетімсіз. GPS арқылы орынды таңдаңыз.'); return; }
          picking = true; mapNode.classList.add('atlas-picking');
          find('[data-actions]').hidden = false; find('[data-center]').hidden = false; find('[data-save]').hidden = true;
          message('Картадағы орынды түртіңіз немесе картаны жылжытып, ортасын таңдаңыз.');
          mapNode.focus();
        };
        find('[data-center]').onclick = () => { if (picking) { const p = map.getCenter(); choose(p.lat, p.lng); } };
      }
    }
    refresh(true);
    return {
      onState() {
        if (operator || !alive) return;
        scene?.onState();
        const mine = items.find((i) => i.id === user.id);
        if (mine) { const totals = ownState().totals; mine.power = totals.power; mine.kwhDay = totals.kwhDay; drawList(); }
      },
      destroy() { alive = false; closeScene(); city?.destroy(); if (map) map.remove(); },
    };
  }
  window.ApartmentAtlas = {open};
})();
