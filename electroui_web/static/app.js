/* =============================================================================
   app.js — ЭлектроҮй бір беттік қосымшасы (vanilla JS, құрастыру қадамы жоқ)
   Бөлімдер: утилиталар · белгішелер · тақырып · тосттар/модаль · API · кіру ·
             қабық (сайдбар, топбар) · маршрутизатор · беттер · әкімші беттері
   ============================================================================= */
'use strict';
(() => {
  const E = window.Electro;
  const fmt = E.fmtNum;
  const NB = ' ';

  /* ======================= УТИЛИТАЛАР ======================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const pad = (n) => String(n).padStart(2, '0');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('eu.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('eu.' + k, v); } catch (e) { /* жеке режим */ } },
  };
  const fW = (n, d = 1) => `${fmt(n, d)}${NB}Вт`;
  const fKwh = (n) => `${fmt(n, 2)}${NB}кВт·сағ`;
  const fT = (n) => `${fmt(n, 0)}${NB}₸`;
  const fA = (n) => `${fmt(n, 2)}${NB}А`;
  const fV = (n) => `${fmt(n, 0)}${NB}В`;
  const MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
  const DAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
  const parseDate = (s) => new Date(String(s).replace(' ', 'T'));
  function fDate(s) {
    const d = parseDate(s);
    if (Number.isNaN(+d)) return esc(s);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function ago(s) {
    const sec = (Date.now() - parseDate(s)) / 1000;
    if (Number.isNaN(sec)) return esc(s);
    if (sec < 45) return 'жаңа ғана';
    if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} мин бұрын`;
    if (sec < 86400) return `${Math.round(sec / 3600)} сағ бұрын`;
    if (sec < 7 * 86400) return `${Math.round(sec / 86400)} күн бұрын`;
    return fDate(s);
  }
  function todayKz() {
    const d = new Date();
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${DAYS[d.getDay()]}`;
  }
  function countUp(node, to, format, ms = 700) {
    const from = +node.dataset.v || 0;
    node.dataset.v = to;
    if (from === to || document.documentElement.classList.contains('reduce-motion')) { node.innerHTML = format(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      node.innerHTML = format(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ======================= БЕЛГІШЕЛЕР (inline SVG) ======================= */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    task: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    tree: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v7M5 17v-3h14v3"/>',
    building: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-5h6v5"/><path d="M9 11h.01M15 11h.01"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    sort: '<path d="M3 6h11M3 12h8M3 18h5M18 5v15M15 17l3 3 3-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    cube: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    film: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.3"/><circle cx="17.5" cy="10.5" r="1.3"/><circle cx="8.5" cy="7.5" r="1.3"/><circle cx="6.5" cy="12.5" r="1.3"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 10c0-4.4-4.5-8-10-8z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    bolt: '<path d="M13 2 3 14h8l-1 8 10-12h-8z"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v4"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    ok: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.2 2.8 2.5 2.8z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    tenge: '<path d="M6 4h12M6 8.5h12M12 8.5V21"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6.1C9.5 14.4 12 13 13 12"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    orbit: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    video: '<path d="m22 8-6 4 6 4z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
    sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z"/><path d="M4 18v2M20 18v2"/>',
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
    socket: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9 10v2M15 10v2M10 16h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    thermo: '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    crown: '<path d="m2 5 3 11h14l3-11-6 6-4-7-4 7z"/><path d="M5 20h14"/>',
    wind: '<path d="M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2"/>',
    tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    play: '<path d="m6 4 14 8-14 8z"/>',
  };
  const ic = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.bolt}</svg>`;
  const TYPE_ICON = { KETTLE: 'flame', FRIDGE: 'box', MICROWAVE: 'flame', WASHER: 'drop', VACUUM: 'wind', IRON: 'flame', TV: 'tv', COMPUTER: 'monitor', AIRCON: 'wind', HEATER: 'thermo', FAN: 'wind', LAMP: 'bulb' };
  const TYPE_IMAGE = { KETTLE: 'kettle.jpg', FRIDGE: 'fridge.jpg', MICROWAVE: 'microwave.jpg', WASHER: 'washer.jpg', VACUUM: 'vacuum.jpg', IRON: 'iron.jpg', TV: 'tv.jpg', COMPUTER: 'computer.jpg', AIRCON: 'aircon.jpg', HEATER: 'heater.jpg', FAN: 'fan.jpg', LAMP: 'lamp.jpg' };
  function roomIcon(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('ас үй')) return 'utensils';
    if (n.includes('қонақ')) return 'sofa';
    if (n.includes('жатын')) return 'bed';
    if (n.includes('жуынатын')) return 'drop';
    return 'building';
  }
  const eclass = (c) => `<span class="eclass" data-c="${esc(c)}">${esc(c)}</span>`;
  const thumb = (a) => (a.image ? `<img class="thumb" src="media/${esc(a.image)}" alt="" loading="lazy">` : `<span class="thumb">${ic(TYPE_ICON[a.type])}</span>`);

  /* ======================= ТАҚЫРЫП ======================= */
  const Theme = {
    mode: store.get('theme', 'dark'),
    accent: store.get('accent', 'blue'),
    mq: window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null,
    isDark() { return this.mode === 'dark' || (this.mode === 'system' && !!this.mq && this.mq.matches); },
    apply() {
      const root = document.documentElement;
      root.dataset.theme = this.isDark() ? 'dark' : 'light';
      root.dataset.accent = this.accent;
      root.classList.toggle('reduce-motion', store.get('motion', 'on') === 'off');
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = this.isDark() ? '#060a17' : '#eef2fb';
      const iconHtml = ic(this.isDark() ? 'sun' : 'moon');
      ['#theme-btn', '#auth-theme'].forEach((s) => { const b = $(s); if (b) b.innerHTML = iconHtml; });
      window.dispatchEvent(new CustomEvent('eu:theme'));
    },
    setMode(m) { this.mode = m; store.set('theme', m); this.apply(); },
    setAccent(a) { this.accent = a; store.set('accent', a); this.apply(); },
    toggle() { this.setMode(this.isDark() ? 'light' : 'dark'); },
  };
  if (Theme.mq && Theme.mq.addEventListener) Theme.mq.addEventListener('change', () => { if (Theme.mode === 'system') Theme.apply(); });

  /* ======================= ТОСТТАР, МОДАЛЬ, ЛАЙТБОКС ======================= */
  function toast(title, body = '', kind = 'info', ms = 4200) {
    const icon = { success: 'ok', error: 'warn', warning: 'warn', info: 'info', broadcast: 'megaphone' }[kind] || 'info';
    const t = el(`<div class="toast ${kind}" role="status"><span class="ic">${ic(icon)}</span><div><b>${esc(title)}</b>${body ? `<p>${esc(body)}</p>` : ''}</div><button class="x" aria-label="Жабу">${ic('x')}</button><i class="prog" style="animation-duration:${ms}ms"></i></div>`);
    const box = $('#toasts');
    box.append(t);
    while (box.children.length > 4) box.firstElementChild.remove();
    const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    const timer = setTimeout(close, ms);
    $('.x', t).onclick = () => { clearTimeout(timer); close(); };
  }

  function modal({ title, body, size = '', actions = [], onOpen }) {
    const wrap = el(`<div class="modal-wrap" role="dialog" aria-modal="true"><div class="modal ${size}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Жабу">${ic('x')}</button></div>
      <div class="modal-body"></div><div class="modal-foot"></div></div></div>`);
    const bodyBox = $('.modal-body', wrap);
    if (typeof body === 'string') bodyBox.innerHTML = body; else if (body) bodyBox.append(body);
    const foot = $('.modal-foot', wrap);
    const api = {
      el: wrap,
      close() { wrap.remove(); document.removeEventListener('keydown', onKey); },
    };
    actions.forEach((a) => {
      const b = el(`<button class="btn ${a.kind ? 'btn-' + a.kind : ''}" type="button">${a.icon ? ic(a.icon) : ''}<span>${esc(a.label)}</span></button>`);
      b.onclick = async () => {
        if (!a.onClick) return api.close();
        b.classList.add('loading');
        try { const keep = await a.onClick(api); if (keep !== false) api.close(); } finally { b.classList.remove('loading'); }
      };
      foot.append(b);
    });
    if (!actions.length) foot.remove();
    const onKey = (e) => { if (e.key === 'Escape') api.close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) api.close(); });
    $('[data-close]', wrap).onclick = () => api.close();
    $('#modal-root').append(wrap);
    if (onOpen) onOpen(api);
    const first = $('input, select, textarea', wrap);
    if (first && matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 50);
    return api;
  }

  function confirmBox(title, text, okLabel = 'Иә', danger = false) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title, size: 'sm', body: `<p class="muted">${esc(text)}</p>`,
        actions: [
          { label: 'Бас тарту', kind: 'ghost', onClick: () => { done = true; resolve(false); } },
          { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { done = true; resolve(true); } },
        ],
      });
      const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe($('#modal-root'), { childList: true });
    });
  }

  function lightbox(items, index) {
    let i = index;
    const lb = el(`<div class="lightbox" role="dialog" aria-modal="true">
      <div class="lb-img"><img alt=""></div><div class="lb-cap"><b></b><span class="attr"></span></div>
      <button class="lb-btn lb-close" aria-label="Жабу">${ic('x')}</button>
      <button class="lb-btn lb-prev" aria-label="Алдыңғы">${ic('chevL')}</button>
      <button class="lb-btn lb-next" aria-label="Келесі">${ic('chevR')}</button></div>`);
    const show = () => {
      const it = items[i];
      const img = $('img', lb);
      img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
      img.src = 'media/' + it.file; img.alt = it.caption;
      $('.lb-cap b', lb).textContent = `${i + 1} / ${items.length} · ${it.caption}`;
      $('.lb-cap .attr', lb).innerHTML = attribution(it);
    };
    const close = () => { lb.remove(); document.removeEventListener('keydown', onKey); };
    const move = (d) => { i = (i + d + items.length) % items.length; show(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') move(-1); if (e.key === 'ArrowRight') move(1); };
    $('.lb-close', lb).onclick = close; $('.lb-prev', lb).onclick = () => move(-1); $('.lb-next', lb).onclick = () => move(1);
    lb.addEventListener('click', (e) => { if (e.target.classList.contains('lb-img')) close(); });
    let sx = null;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1); sx = null; });
    document.addEventListener('keydown', onKey);
    document.body.append(lb);
    show();
  }
  const attribution = (it) => `${esc(it.artist)} · ${esc(it.license)} · <a href="${esc(it.page)}" target="_blank" rel="noopener">${it.page.includes('mixkit') ? 'mixkit.co' : 'Wikimedia Commons'}</a>`;

  /* ======================= КҮЙ ЖӘНЕ API ======================= */
  const S = {
    user: null, meta: null, state: null, apt: null, catalog: null, notifs: [], unread: 0,
    lastNotifId: 0, route: null, page: null, poll: null, hero: null,
  };

  async function api(path, body) {
    const opt = { method: body === undefined ? 'GET' : 'POST', headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch('/api/' + path, opt); } catch (e) {
      throw Object.assign(new Error('Серверге қосылу мүмкін болмады. server.py іске қосулы ма?'), { status: 0 });
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* бос жауап */ }
    if (!res.ok) {
      const err = Object.assign(new Error(data.error || `Қате (${res.status})`), { status: res.status, data });
      if (res.status === 401 && S.user && !['login', 'register'].includes(path)) sessionLost();
      throw err;
    }
    return data;
  }

  function setState(st) {
    S.state = st;
    S.apt = new E.Apartment(st.rooms, st.appliances, st.settings);
    S.unread = st.unread;
    if (st.me) S.user = st.me;
    renderChrome();
  }

  function applyResult(res) {
    if (res && res.state) setState(res.state);
    if (res && res.notifications && res.notifications.length) {
      res.notifications.forEach((n) => announce(n));
      S.lastNotifId = Math.max(S.lastNotifId, ...res.notifications.map((n) => n.id));
      ringBell();
    }
    if (S.page && S.page.onState) S.page.onState();
  }

  function announce(n) {
    const kind = n.kind === 'WARNING' ? 'warning' : n.kind === 'SUCCESS' ? 'success' : n.kind === 'BROADCAST' ? 'broadcast' : 'info';
    toast(n.title, n.body, kind, n.kind === 'WARNING' ? 8000 : 5000);
    if ((n.kind === 'WARNING' || n.kind === 'BROADCAST') && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(n.title, { body: n.body, icon: 'static/icon.svg', tag: 'eu-' + n.id }); } catch (e) { /* мобильді браузер */ }
    }
  }

  async function refreshState() { setState(await api('state')); if (S.page && S.page.onState) S.page.onState(); }

  async function pollNotifs(silent = false) {
    try {
      const d = await api('notifications');
      S.notifs = d.items; S.unread = d.unread;
      const fresh = d.items.filter((n) => n.id > S.lastNotifId).reverse();
      if (!silent && fresh.length) { fresh.forEach(announce); ringBell(); }
      if (d.items.length) S.lastNotifId = Math.max(S.lastNotifId, d.items[0].id);
      renderBell();
      if (S.route === 'notifications' && S.page && S.page.refresh && fresh.length) S.page.refresh();
    } catch (e) { /* желі уақытша жоқ */ }
  }

  async function togglePlug(id, plugged) {
    const a = S.apt.appliances.find((x) => x.id === id);
    try {
      const r = await api('plug', { id, plugged });
      applyResult(r);
      if (a) toast(plugged ? 'Розеткаға қосылды' : 'Розеткадан ажыратылды', `${a.name} · ${fW(a.power, 0)}`, plugged ? 'success' : 'info', 2600);
      return true;
    } catch (e) {
      toast(plugged ? 'Қосу мүмкін емес' : 'Қате', e.message, 'error');
      if (S.page && S.page.onState) S.page.onState();
      return false;
    }
  }

  async function unplugAll() {
    if (!S.apt.plugged().length) { toast('Қосулы құрал жоқ', 'Барлық құралдар онсыз да өшірулі.', 'info'); return; }
    try { applyResult(await api('unplug_all', {})); } catch (e) { toast('Қате', e.message, 'error'); }
  }

  function sessionLost() {
    if (!S.user) return;
    leaveApp();
    toast('Сессия аяқталды', 'Қайтадан жүйеге кіріңіз.', 'warning');
  }

  /* ======================= КІРУ / ТІРКЕЛУ ======================= */
  let lockTimer = null;
  function initAuth() {
    $$('[data-auth-tab]').forEach((b) => b.addEventListener('click', () => switchAuth(b.dataset.authTab)));
    $$('.pw-eye').forEach((b) => {
      b.innerHTML = ic('eye');
      b.addEventListener('click', () => {
        const inp = b.previousElementSibling;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.innerHTML = ic(show ? 'eyeOff' : 'eye');
      });
    });
    $$('.demo-chip').forEach((b) => b.addEventListener('click', () => {
      switchAuth('login');
      const f = $('#login-form');
      f.login.value = b.dataset.login; f.password.value = b.dataset.pass;
      f.querySelector('button[type=submit]').focus();
    }));
    $('#auth-theme').addEventListener('click', () => Theme.toggle());

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target; const btn = $('button[type=submit]', f); const box = $('#login-error');
      box.hidden = true;
      if (!f.login.value.trim() || !f.password.value) return showFormError(box, 'Логин мен құпиясөзді енгізіңіз.');
      btn.classList.add('loading');
      try {
        const r = await api('login', { login: f.login.value.trim(), password: f.password.value });
        f.password.value = '';
        await enterApp(r.user);
        toast(`Қош келдіңіз, ${r.user.fullName}!`, r.user.role === 'ADMIN' ? 'Сіз әкімші ретінде кірдіңіз.' : 'Пәтеріңіз сізді күтіп тұр.', 'success');
      } catch (err) {
        showFormError(box, err.message);
        if (err.status === 429 && err.data && err.data.retryAfter) startLockCountdown(btn, err.data.retryAfter);
      } finally { btn.classList.remove('loading'); }
    });

    const rf = $('#register-form');
    const validate = () => {
      const v = Object.fromEntries(new FormData(rf));
      const res = {
        fullName: v.fullName.trim().length >= 2 ? '' : 'Аты-жөні кемінде 2 таңба',
        login: /^[A-Za-z0-9_]{3,20}$/.test(v.login.trim()) ? '' : '3–20 таңба: a–z, 0–9, _',
        email: /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.trim()) ? '' : 'Email форматы қате',
        password: v.password.length >= 8 && /\p{L}/u.test(v.password) && /\d/.test(v.password) ? '' : 'Кемінде 8 таңба, бір әріп және бір цифр',
        confirm: v.confirm && v.confirm === v.password ? '' : 'Құпиясөздер сәйкес келмейді',
      };
      return { v, res };
    };
    rf.addEventListener('input', (e) => {
      const { v, res } = validate();
      const name = e.target.name;
      if (name === 'password') updateStrength($('#reg-strength'), v.password, $('[data-hint="password"]', rf));
      ['fullName', 'login', 'email', 'confirm'].forEach((k) => {
        const inp = rf[k];
        if (!inp.value) { inp.classList.remove('invalid', 'valid'); return; }
        inp.classList.toggle('invalid', !!res[k]); inp.classList.toggle('valid', !res[k]);
        const hint = $(`[data-hint="${k}"]`, rf);
        if (hint) { hint.textContent = res[k] || 'Дұрыс'; hint.className = 'hint ' + (res[k] ? 'err' : 'ok'); }
      });
      if (rf.password.value) { rf.password.classList.toggle('invalid', !!res.password); rf.password.classList.toggle('valid', !res.password); }
    });
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = $('#register-error'); box.hidden = true;
      const { v, res } = validate();
      const first = Object.entries(res).find(([, m]) => m);
      if (first) { rf[first[0]].classList.add('invalid'); rf[first[0]].focus(); return showFormError(box, first[1]); }
      const btn = $('button[type=submit]', rf); btn.classList.add('loading');
      try {
        const r = await api('register', { fullName: v.fullName.trim(), login: v.login.trim(), email: v.email.trim(), password: v.password, confirm: v.confirm });
        rf.reset(); $('#reg-strength').dataset.level = '0';
        $$('input', rf).forEach((i) => i.classList.remove('valid', 'invalid'));
        await enterApp(r.user);
        toast('Тіркелу сәтті өтті!', 'Сізге 4 бөлмелі пәтер берілді. Каталогтан құрал қосыңыз.', 'success', 6000);
        location.hash = '#/apartment';
      } catch (err) { showFormError(box, err.message); } finally { btn.classList.remove('loading'); }
    });
  }

  function switchAuth(tab) {
    $$('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === tab));
    $('#login-form').hidden = tab !== 'login';
    $('#register-form').hidden = tab !== 'register';
    const f = tab === 'login' ? $('#login-form') : $('#register-form');
    f.style.animation = 'none'; void f.offsetWidth; f.style.animation = 'rise .4s var(--ease)';
  }

  function showFormError(box, msg) {
    box.innerHTML = `${ic('warn')}<span>${esc(msg)}</span>`;
    box.querySelector('svg').style.cssText = 'width:18px;height:18px;flex-shrink:0;margin-top:1px';
    box.hidden = false;
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }

  function startLockCountdown(btn, secs) {
    clearInterval(lockTimer);
    const label = $('span', btn); const orig = 'Кіру';
    btn.disabled = true;
    let left = secs;
    const tick = () => {
      if (left <= 0) { clearInterval(lockTimer); btn.disabled = false; label.textContent = orig; return; }
      label.textContent = `Бұғатталды: ${left} с`; left -= 1;
    };
    tick(); lockTimer = setInterval(tick, 1000);
  }

  function strengthOf(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (/\p{L}/u.test(p) && /\d/.test(p)) s++;
    if ((/[a-zа-яәғқңөұүһі]/.test(p) && /[A-ZА-ЯӘҒҚҢӨҰҮҺІ]/.test(p)) || /[^\p{L}\d]/u.test(p)) s++;
    if (p.length >= 12) s++;
    return p ? Math.max(1, s) : 0;
  }
  function updateStrength(meter, p, hint) {
    const lvl = strengthOf(p);
    meter.dataset.level = lvl;
    if (hint) {
      const names = ['Кемінде 8 таңба, бір әріп және бір цифр', 'Әлсіз құпиясөз', 'Орташа құпиясөз', 'Жақсы құпиясөз', 'Күшті құпиясөз'];
      hint.textContent = names[lvl];
      hint.className = 'hint ' + (lvl >= 3 ? 'ok' : lvl ? 'err' : '');
    }
  }

  function showAuth() {
    $('#shell').hidden = true;
    $('#auth').hidden = false;
    switchAuth('login');
    document.title = 'Кіру — ЭлектроҮй';
    if (!S.hero && window.Scene3D) {
      S.hero = Scene3D.createHero($('#hero3d'));
      if (!S.hero) $('#hero3d').classList.add('fallback');
    }
  }

  async function enterApp(user) {
    S.user = user;
    const [st, meta] = await Promise.all([api('state'), S.meta ? Promise.resolve(S.meta) : api('meta')]);
    S.meta = meta;
    setState(st);
    if (S.hero) { S.hero.dispose(); S.hero = null; }
    $('#auth').hidden = true;
    $('#shell').hidden = false;
    buildNav();
    S.lastNotifId = 0;
    await pollNotifs(true);
    clearInterval(S.poll);
    S.poll = setInterval(() => pollNotifs(false), 15000);
    if (user.role === 'ADMIN' && (!location.hash || location.hash === '#/dashboard')) history.replaceState(null, '', '#/map');
    route();
  }

  function leaveApp() {
    if (S.page && S.page.destroy) S.page.destroy();
    S.page = null; S.user = null; S.state = null; S.apt = null; S.catalog = null; S.route = null;
    clearInterval(S.poll);
    $('#view').innerHTML = '';
    $('#modal-root').innerHTML = '';
    showAuth();
  }

  async function logout() {
    try { await api('logout', {}); } catch (e) { /* бәрібір шығамыз */ }
    history.replaceState(null, '', '#/dashboard');
    leaveApp();
    toast('Жүйеден шықтыңыз', 'Сау болыңыз!', 'info', 2500);
  }

  /* ======================= ҚАБЫҚ: САЙДБАР, ТОПБАР ======================= */
  const PAGES = {
    dashboard: { nav: 'Басты бет', title: 'Басты бет', sub: 'Пәтердің электр жүктемесі бір қарағанда', icon: 'home', group: 'Негізгі', render: pageDashboard },
    map: { nav: 'Астана картасы', title: 'Пәтерлер картасы', sub: 'Астана · Электр тұтынуы және 3D пәтерлер', icon: 'building', group: 'Негізгі', render: pageMap },
    task: { nav: 'Тапсырма', title: 'Тапсырма: Үйдегі электр құралдары', sub: '5 қадам және қосымша талаптар', icon: 'task', group: 'Негізгі', render: pageTask },
    hierarchy: { nav: 'Иерархия', title: 'Класс иерархиясы', sub: '1-қадам · ElectricAppliance және оның ұрпақтары', icon: 'tree', group: 'Тапсырма қадамдары', step: 1, render: pageHierarchy },
    apartment: { nav: 'Менің пәтерім', title: 'Менің пәтерім', sub: '2-қадам · құралдарды розеткаға қосу', icon: 'building', group: 'Тапсырма қадамдары', step: 2, render: pageApartment },
    calc: { nav: 'Қуатты есептеу', title: 'Тұтынылатын қуатты есептеу', sub: '3-қадам · I = P / U, E = P · t / 1000', icon: 'calc', group: 'Тапсырма қадамдары', step: 3, render: pageCalc },
    sort: { nav: 'Сұрыптау', title: 'Қуаты бойынша сұрыптау', sub: '4-қадам · өсу / кему ретімен', icon: 'sort', group: 'Тапсырма қадамдары', step: 4, render: pageSort },
    search: { nav: 'Іздеу', title: 'Параметрлер аралығы бойынша іздеу', sub: '5-қадам · SQL BETWEEN', icon: 'search', group: 'Тапсырма қадамдары', step: 5, render: pageSearch },
    three: { nav: '3D пәтер', title: '3D пәтер', sub: 'three.js · қосулы құралдар жарқырайды', icon: 'cube', group: 'Көрнекілік', render: pageThree },
    media: { nav: 'Медиа', title: 'Видео мен суреттер', sub: 'Галерея, видео және энергия үнемдеу кеңестері', icon: 'film', group: 'Көрнекілік', render: pageMedia },
    notifications: { nav: 'Хабарламалар', title: 'Хабарламалар', sub: 'Ескертулер, жаңалықтар және оқиғалар тарихы', icon: 'bell', group: 'Жеке', render: pageNotifications },
    profile: { nav: 'Профиль', title: 'Профиль', sub: 'Аккаунт деректері және құпиясөз', icon: 'user', group: 'Жеке', render: pageProfile },
    settings: { nav: 'Баптаулар', title: 'Баптаулар', sub: 'Тақырып, акцент түсі, анимация', icon: 'palette', group: 'Жеке', render: pageSettings },
    'admin-users': { nav: 'Пайдаланушылар', title: 'Пайдаланушылар', sub: 'Рөлдер, бұғаттау, жою', icon: 'users', group: 'Әкімші', admin: true, render: pageAdminUsers },
    'admin-catalog': { nav: 'Каталог', title: 'Құралдар каталогы', sub: 'Үлгілерді қосу, өзгерту, жою', icon: 'box', group: 'Әкімші', admin: true, render: pageAdminCatalog },
    'admin-stats': { nav: 'Жалпы статистика', title: 'Жалпы статистика', sub: 'Барлық пайдаланушылар бойынша SQL есептер', icon: 'chart', group: 'Әкімші', admin: true, render: pageAdminStats },
    'admin-broadcast': { nav: 'Хабарлама жіберу', title: 'Хабарлама жіберу', sub: 'Барлық клиенттерге хабарландыру', icon: 'megaphone', group: 'Әкімші', admin: true, render: pageAdminBroadcast },
    'admin-system': { nav: 'Тариф пен лимит', title: 'Тариф пен лимиттер', sub: 'Жүйелік баптаулар', icon: 'sliders', group: 'Әкімші', admin: true, render: pageAdminSystem },
  };

  function buildNav() {
    const isAdmin = S.user.role === 'ADMIN';
    const groups = {};
    Object.entries(PAGES).forEach(([key, p]) => {
      if (p.admin && !isAdmin) return;
      (groups[p.group] = groups[p.group] || []).push([key, p]);
    });
    $('#nav').innerHTML = Object.entries(groups).map(([g, items]) => `
      <div class="nav-group"><div class="nav-label">${esc(g)}</div>
        ${items.map(([key, p]) => `<a href="#/${key}" data-route="${key}" title="${esc(p.nav)}">${ic(p.icon)}<span class="label">${esc(p.nav)}</span>${p.step ? `<span class="step">${p.step}</span>` : ''}${key === 'notifications' ? '<span class="count" id="nav-count" hidden></span>' : ''}</a>`).join('')}
      </div>`).join('');
    renderChrome();
  }

  function renderChrome() {
    if (!S.user || !S.state) return;
    const u = S.user;
    $('#sb-user').innerHTML = `<a class="avatar" href="#/profile" title="Профиль">${esc(u.initials)}</a>
      <div class="who"><b>${esc(u.fullName)}</b><span class="badge ${u.role === 'ADMIN' ? 'admin' : 'client'}">${ic(u.role === 'ADMIN' ? 'crown' : 'user')}${u.role === 'ADMIN' ? 'Сектор әкімшісі' : 'Тұрғын'}</span></div>
      <button class="icon-btn" id="logout-btn" title="Шығу" aria-label="Шығу">${ic('logout')}</button>`;
    $('#logout-btn').onclick = logout;
    $('#top-avatar').textContent = u.initials;
    const t = S.state.totals;
    const chip = $('#power-chip');
    chip.innerHTML = `${ic('bolt')}<span class="num">${fW(t.power, 0)}</span><span class="lbl muted">· ${fmt(t.loadPct, 0)}%</span><i class="fill" style="width:${Math.min(100, t.loadPct)}%"></i>`;
    chip.classList.toggle('over', t.apartmentOverload);
    chip.title = `Қосулы: ${t.plugged} құрал · жүктеме ${fmt(t.loadPct, 1)}% (шегі ${fW(S.state.settings.apartmentLimit, 0)})`;
    renderBell();
  }

  function renderBell() {
    const btn = $('#bell-btn');
    btn.innerHTML = ic('bell') + (S.unread ? `<span class="bell-count">${S.unread > 99 ? '99+' : S.unread}</span>` : '');
    const nc = $('#nav-count');
    if (nc) { nc.hidden = !S.unread; nc.textContent = S.unread; }
    if (!$('#bell-menu').hidden) renderBellMenu();
  }

  function ringBell() {
    const btn = $('#bell-btn');
    btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring');
    const c = $('.bell-count', btn); if (c) c.classList.add('bump');
  }

  const NOTIF_ICON = { WARNING: 'warn', SUCCESS: 'ok', BROADCAST: 'megaphone', INFO: 'info' };
  const notifHTML = (n, actions = true) => `<div class="notif ${n.kind} ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
      <span class="ic">${ic(NOTIF_ICON[n.kind] || 'info')}</span>
      <div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<time title="${fDate(n.created_at)}">${ago(n.created_at)}${n.kind === 'BROADCAST' ? ' · әкімшіден' : ''}</time></div>
      ${actions ? `<div class="acts">${n.is_read ? '' : `<button class="icon-btn" data-read="${n.id}" title="Оқылды деп белгілеу">${ic('check')}</button>`}<button class="icon-btn" data-del="${n.id}" title="Жою">${ic('trash')}</button></div>` : ''}
    </div>`;

  function renderBellMenu() {
    const menu = $('#bell-menu');
    const items = S.notifs.slice(0, 6);
    menu.innerHTML = `<div class="dd-head"><b>Хабарламалар ${S.unread ? `<span class="badge danger">${S.unread} жаңа</span>` : ''}</b>
        <button class="btn btn-sm btn-ghost" id="dd-readall" ${S.unread ? '' : 'disabled'}>${ic('check')}Барлығын оқу</button></div>
      <div class="notif-list">${items.length ? items.map((n) => notifHTML(n, false)).join('') : `<div class="empty">${ic('bell')}<span>Хабарлама жоқ</span></div>`}</div>
      <div class="dd-foot"><a href="#/notifications">Барлық хабарламалар →</a></div>`;
    $('#dd-readall').onclick = async (e) => { e.stopPropagation(); const d = await api('notif_read', { all: true }); S.notifs = d.items; S.unread = d.unread; renderBell(); };
    $$('.notif', menu).forEach((n) => n.addEventListener('click', async () => {
      const id = +n.dataset.id;
      const d = await api('notif_read', { id }); S.notifs = d.items; S.unread = d.unread;
      menu.hidden = true; renderBell();
      location.hash = '#/notifications';
    }));
  }

  function initChrome() {
    $('#menu-btn').innerHTML = ic('menu');
    $('#collapse-btn').innerHTML = ic('chevL');
    const shell = $('#shell');
    if (store.get('collapsed', '0') === '1') shell.classList.add('collapsed');
    $('#collapse-btn').onclick = () => {
      shell.classList.toggle('collapsed');
      store.set('collapsed', shell.classList.contains('collapsed') ? '1' : '0');
      setTimeout(() => window.dispatchEvent(new Event('resize')), 380);
    };
    $('#menu-btn').onclick = () => shell.classList.add('drawer');
    $('#scrim').onclick = () => shell.classList.remove('drawer');
    $('#theme-btn').onclick = () => Theme.toggle();
    $('#bell-btn').onclick = (e) => {
      e.stopPropagation();
      const menu = $('#bell-menu');
      menu.hidden = !menu.hidden;
      if (!menu.hidden) { renderBellMenu(); pollNotifs(false); }
    };
    document.addEventListener('click', (e) => {
      const menu = $('#bell-menu');
      if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true;
      $$('.ctx-menu').forEach((m) => { if (!m.contains(e.target)) m.remove(); });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#bell-menu').hidden = true; shell.classList.remove('drawer'); } });
  }

  /* ======================= МАРШРУТИЗАТОР ======================= */
  function route() {
    if (!S.user) return;
    let name = location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    if (!PAGES[name]) name = 'dashboard';
    if (PAGES[name].admin && S.user.role !== 'ADMIN') {
      toast('Рұқсат жоқ (403)', 'Бұл бет тек әкімшіге арналған.', 'error');
      name = 'dashboard';
      history.replaceState(null, '', '#/dashboard');
    }
    if (S.page && S.page.destroy) S.page.destroy();
    S.route = name;
    const p = PAGES[name];
    const operator = S.user.role === 'ADMIN';
    $('#power-chip').hidden = name === 'map' && operator;
    $('#page-title').textContent = name === 'map' && operator ? 'Сектордың энергия картасы' : p.title;
    $('#page-sub').textContent = name === 'map' && operator
      ? (S.user.demo ? 'Мемлекеттік сектор · Үлгі пәтерлер' : 'Мемлекеттік сектор · Пәтерлердің энергия тұтынуы') : p.sub;
    document.title = `${p.nav} — ЭлектроҮй`;
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    $('#shell').classList.remove('drawer');
    $('#bell-menu').hidden = true;
    const view = $('#view');
    view.innerHTML = '';
    const page = el('<div class="page"></div>');
    view.append(page);
    window.scrollTo({ top: 0 });
    try { S.page = p.render(page) || {}; } catch (e) {
      console.error(e);
      page.innerHTML = `<div class="card empty"><span class="ic">${ic('warn')}</span><b>Бетті көрсету кезінде қате шықты</b><span>${esc(e.message)}</span></div>`;
      S.page = {};
    }
  }
  window.addEventListener('hashchange', route);

  /* ======================= ОРТАҚ КОМПОНЕНТТЕР ======================= */
  const ARC = 314.159;
  function gaugeHTML() {
    const ticks = [0, 25, 50, 75, 100].map((p) => {
      const a = Math.PI * (1 - p / 100);
      const x1 = 120 + 80 * Math.cos(a), y1 = 120 - 80 * Math.sin(a), x2 = 120 + 87 * Math.cos(a), y2 = 120 - 87 * Math.sin(a);
      return `<line class="g-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }).join('');
    return `<div class="gauge"><svg viewBox="0 0 240 132" role="img" aria-label="Жүктеме пайызы">
        <path class="g-track" d="M20 120 A100 100 0 0 1 220 120"/>
        <path class="g-val" d="M20 120 A100 100 0 0 1 220 120" stroke="currentColor" stroke-dasharray="${ARC}" stroke-dashoffset="${ARC}"/>${ticks}
      </svg><div class="g-center"><b class="g-pct num">0%</b><span class="g-lbl"></span></div></div>`;
  }
  function loadStatus(pct) {
    if (pct > 100) return { cls: 'danger', color: '#ef4444', icon: 'warn', text: 'Шектен асты!' };
    if (pct >= 85) return { cls: 'warn', color: '#f59e0b', icon: 'warn', text: 'Шекке жақын' };
    if (pct >= 60) return { cls: 'warn', color: '#eab308', icon: 'info', text: 'Орташа жүктеме' };
    return { cls: 'ok', color: '#22c55e', icon: 'ok', text: 'Қалыпты жүктеме' };
  }
  function setGauge(root, pct, label) {
    const v = $('.g-val', root);
    const st = loadStatus(pct);
    requestAnimationFrame(() => {
      v.style.strokeDashoffset = ARC * (1 - Math.min(pct, 100) / 100);
      v.style.color = st.color;
    });
    $('.gauge', root).classList.toggle('over', pct > 100);
    countUp($('.g-pct', root), pct, (x) => `${fmt(x, 0)}%`);
    $('.g-lbl', root).textContent = label;
  }
  const statusPill = (pct) => { const s = loadStatus(pct); return `<span class="status-pill ${s.cls}">${ic(s.icon)}${s.text}</span>`; };
  const socketsHTML = (used, total) => `<span class="sockets" title="${used} / ${total} розетка бос емес">${Array.from({ length: total }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('')}</span>`;
  const emptyHTML = (icon, title, text, extra = '') => `<div class="empty"><span class="ic">${ic(icon)}</span><b>${esc(title)}</b><span>${esc(text)}</span>${extra}</div>`;

  function hl(code) {
    const KW = new Set(('SELECT FROM WHERE AND OR JOIN LEFT ON ORDER BY GROUP HAVING LIMIT BETWEEN IN LIKE ESCAPE AS DESC ASC CASE WHEN THEN ELSE END DISTINCT NOT NULL IS ' +
      'public private protected class interface extends implements abstract return void new static final this super if else for ' +
      'def lambda True False None const let function').split(' '));
    const FN = new Set('COUNT SUM AVG MAX MIN ROUND COALESCE CAST kz_lower sorted sort reversed comparingDouble comparing localeCompare indexOf'.split(' '));
    const TY = new Set('double boolean int long String EnergyClass Room REAL Comparator ElectricAppliance KitchenAppliance HouseholdAppliance MultimediaAppliance ClimateAppliance LightingAppliance Pluggable Heating'.split(' '));
    const re = /(\/\/.*$|--.*$|#.*$)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|(\?)|(@?[A-Za-z_][\w]*)/gm;
    let out = ''; let last = 0; let m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const [tok, com, str, numb, q, id] = m;
      if (com) out += `<span class="c">${esc(com)}</span>`;
      else if (str) out += `<span class="s">${esc(str)}</span>`;
      else if (numb) out += `<span class="n">${numb}</span>`;
      else if (q) out += '<span class="p">?</span>';
      else if (id && (KW.has(id) || id === '@Override')) out += `<span class="k">${id}</span>`;
      else if (id && FN.has(id)) out += `<span class="f">${id}</span>`;
      else if (id && TY.has(id)) out += `<span class="t">${id}</span>`;
      else out += esc(tok);
      last = m.index + tok.length;
    }
    return out + esc(code.slice(last));
  }

  /* ---------- Құрал формасы (пәтер + каталог) ---------- */
  function applianceForm(v = {}, { withRoom = false, withPlug = false, roomId = null } = {}) {
    const C = E.CLASS_BY_TYPE[v.type || 'KETTLE'];
    const typeOptions = E.GROUP_CLASSES.map((G) => `<optgroup label="${esc(G.KZ)} (${G.name})">${E.APPLIANCE_CLASSES.filter((X) => Object.getPrototypeOf(X) === G)
      .map((X) => `<option value="${X.TYPE}" ${X === C ? 'selected' : ''}>${esc(X.KZ)} — ${X.name}</option>`).join('')}</optgroup>`).join('');
    const imgs = (S.meta ? S.meta.images : []).filter((f) => f !== 'hero.jpg');
    const curImg = v.image !== undefined ? v.image : TYPE_IMAGE[C.TYPE];
    const f = el(`<form class="form" novalidate>
      <label class="field"><span>Құрал түрі (класс)</span><select name="type">${typeOptions}</select></label>
      <div class="field-row"><label class="field"><span>Атауы</span><input name="name" required maxlength="60" value="${esc(v.name || '')}" placeholder="Мысалы: Tefal KO150"></label>
        <label class="field"><span>Бренді</span><input name="brand" required maxlength="40" value="${esc(v.brand || '')}" placeholder="Tefal"></label></div>
      <div class="field-row three">
        <label class="field"><span>Қуаты P, Вт</span><input name="power" type="number" min="1" max="10000" step="any" required value="${v.power ?? ''}" placeholder="2000"></label>
        <label class="field"><span>Кернеуі U, В</span><input name="voltage" type="number" min="1" max="1000" step="any" required value="${v.voltage ?? 220}"></label>
        <label class="field"><span>Энергия класы</span><select name="energyClass">${E.ENERGY_CLASSES.map((c) => `<option ${c === (v.energyClass || 'A') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      </div>
      <div class="field-row three">
        <label class="field"><span>Салмағы, кг</span><input name="weight" type="number" min="0" max="1000" step="any" required value="${v.weight ?? ''}" placeholder="1.5"></label>
        <label class="field"><span data-extra-label>${esc(C.EXTRA_LABEL)}, ${esc(C.EXTRA_UNIT)}</span><input name="extra" type="number" min="0" step="any" required value="${v.extra ?? ''}"></label>
        <label class="field"><span>Тәулігіне t, сағ</span><input name="hoursPerDay" type="number" min="0" max="24" step="any" required value="${v.hoursPerDay ?? ''}" placeholder="1"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Сурет</span><select name="image"><option value="">— Суретсіз —</option>${imgs.map((i) => `<option value="${esc(i)}" ${i === curImg ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></label>
        ${withRoom ? `<label class="field"><span>Бөлме</span><select name="roomId">${S.state.rooms.map((r) => `<option value="${r.id}" ${r.id === (v.roomId ?? roomId) ? 'selected' : ''}>${esc(r.name)} (бос розетка: ${r.free})</option>`).join('')}</select></label>` : '<span></span>'}
      </div>
      ${withPlug ? `<label class="check"><span class="switch"><input type="checkbox" name="plugged"><span class="track"></span></span>Бірден розеткаға қосу</label>` : ''}
      <div class="form-error" hidden></div>
    </form>`);
    let autoImg = curImg;
    f.type.addEventListener('change', () => {
      const X = E.CLASS_BY_TYPE[f.type.value];
      $('[data-extra-label]', f).textContent = `${X.EXTRA_LABEL}, ${X.EXTRA_UNIT}`;
      if (f.image.value === autoImg || !f.image.value) { f.image.value = TYPE_IMAGE[X.TYPE]; autoImg = f.image.value; }
    });
    return f;
  }
  function readApplianceForm(f) {
    const d = Object.fromEntries(new FormData(f));
    ['power', 'voltage', 'weight', 'extra', 'hoursPerDay'].forEach((k) => { d[k] = d[k] === '' ? null : +d[k]; });
    if (d.roomId) d.roomId = +d.roomId;
    d.plugged = !!(f.plugged && f.plugged.checked);
    return d;
  }
  function formError(f, msg) { const b = $('.form-error', f); showFormError(b, msg); }

  async function loadCatalog(force = false) {
    if (!S.catalog || force) S.catalog = (await api('catalog')).items;
    return S.catalog;
  }

  function openAddModal(roomId = null) {
    const tabs = el(`<div class="stack"><div class="seg seg-wide"><button type="button" class="active" data-t="cat">${ic('box')}Каталогтан</button><button type="button" data-t="own">${ic('edit')}Өз құралым</button></div><div data-pane></div></div>`);
    const pane = $('[data-pane]', tabs);
    let mode = 'cat'; let picked = null; let ownForm = null; let catBox = null;
    const roomSelect = () => `<div class="field-row"><label class="field"><span>Бөлме</span><select name="roomId">${S.state.rooms.map((r) => `<option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>${esc(r.name)} (бос розетка: ${r.free})</option>`).join('')}</select></label>
      <label class="check" style="align-self:end;height:44px"><span class="switch"><input type="checkbox" name="plugged"><span class="track"></span></span>Бірден розеткаға қосу</label></div>`;
    const renderCat = async () => {
      catBox = el(`<form class="form"><div class="pick-grid"><div class="skeleton" style="height:140px"></div><div class="skeleton" style="height:140px"></div><div class="skeleton" style="height:140px"></div></div>${roomSelect()}<div class="form-error" hidden></div></form>`);
      pane.replaceChildren(catBox);
      try {
        const items = await loadCatalog();
        $('.pick-grid', catBox).innerHTML = items.map((c) => `<button type="button" class="pick" data-id="${c.id}">${c.image ? `<img src="media/${esc(c.image)}" alt="" loading="lazy">` : ''}<div><b>${esc(c.name)}</b><span>${esc(c.name_kz)} · ${fW(c.power, 0)}</span></div></button>`).join('');
        $$('.pick', catBox).forEach((b) => b.addEventListener('click', () => { $$('.pick', catBox).forEach((x) => x.classList.remove('active')); b.classList.add('active'); picked = +b.dataset.id; }));
      } catch (e) { formError(catBox, e.message); }
    };
    const renderOwn = () => { ownForm = ownForm || applianceForm({}, { withRoom: true, withPlug: true, roomId }); pane.replaceChildren(ownForm); };
    $$('[data-t]', tabs).forEach((b) => b.addEventListener('click', () => {
      $$('[data-t]', tabs).forEach((x) => x.classList.toggle('active', x === b));
      mode = b.dataset.t; if (mode === 'cat') renderCat(); else renderOwn();
    }));
    renderCat();
    modal({
      title: 'Пәтерге құрал қосу', size: 'wide', body: tabs,
      actions: [{ label: 'Бас тарту', kind: 'ghost' }, {
        label: 'Қосу', kind: 'primary', icon: 'plus', onClick: async () => {
          let payload; let form;
          if (mode === 'cat') {
            form = catBox;
            if (!picked) { formError(form, 'Каталогтан құралды таңдаңыз.'); return false; }
            payload = { catalogId: picked, roomId: +catBox.roomId.value, plugged: catBox.plugged.checked };
          } else { form = ownForm; payload = readApplianceForm(ownForm); }
          try {
            const r = await api('appliance_add', payload);
            applyResult(r);
            toast('Құрал қосылды', 'Пәтеріңізге жаңа құрал қосылды.', 'success');
            return true;
          } catch (e) { formError(form, e.message); return false; }
        },
      }],
    });
  }

  function openEditModal(a) {
    const f = applianceForm({ ...a, roomId: a.roomId }, { withRoom: true });
    modal({
      title: `Өзгерту: ${a.name}`, size: 'wide', body: f,
      actions: [{ label: 'Бас тарту', kind: 'ghost' }, {
        label: 'Сақтау', kind: 'primary', icon: 'check', onClick: async () => {
          try {
            applyResult(await api('appliance_update', { id: a.id, ...readApplianceForm(f) }));
            toast('Сақталды', a.name, 'success', 2500); return true;
          } catch (e) { formError(f, e.message); return false; }
        },
      }],
    });
  }

  async function deleteAppliance(a) {
    if (!(await confirmBox('Құралды жою', `«${a.name}» пәтеріңізден жойылады. Жалғастырасыз ба?`, 'Жою', true))) return;
    try { applyResult(await api('appliance_delete', { id: a.id })); toast('Жойылды', a.name, 'info', 2500); } catch (e) { toast('Қате', e.message, 'error'); }
  }

  /* ======================= БЕТ: БАСТЫ БЕТ ======================= */
  function pageDashboard(root) {
    const first = (S.user.fullName || '').split(/\s+/)[0];
    root.innerHTML = `
      <div class="hero-card">
        <p class="muted small">${todayKz()}</p>
        <h2>Сәлем, ${esc(first)}! <span class="grad-text">Пәтеріңіздің энергиясы</span> бақылауда.</h2>
        <p data-summary></p>
        <div class="row"><a class="btn btn-primary" href="#/apartment">${ic('plug')}Менің пәтерім</a><a class="btn" href="#/three">${ic('cube')}3D пәтер</a><a class="btn" href="#/map">${ic('building')}Астана картасы</a></div>
      </div>
      <div data-banner></div>
      <div class="stats">
        ${[['plug', '', 'Қосулы құралдар', 's-plug'], ['bolt', 'volt', 'Жалпы қуат P', 's-power'], ['activity', 'info', 'Жалпы ток I', 's-current'], ['clock', 'ok', 'Тәуліктік энергия E', 's-kwh'], ['tenge', 'pink', 'Айлық төлем', 's-cost']]
          .map(([i, c, l, k]) => `<div class="card stat"><span class="ic ${c}">${ic(i)}</span><div><div class="v" data-k="${k}">—</div><div class="l">${l}</div></div></div>`).join('')}
      </div>
      <div class="grid g-main">
        <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('gauge')}</span>Пәтер желісінің жүктемесі</h3><span data-pill></span></div>
          <div data-gauge>${gaugeHTML()}</div>
          <div class="legend-row"><span>0 Вт</span><span data-limit></span></div>
          <div class="row between" style="margin-top:14px"><span class="muted small" data-gsub></span>
            <button class="btn btn-danger btn-sm" data-unplug>${ic('power')}Барлығын өшіру</button></div>
        </div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('building')}</span>Бөлмелер бойынша қуат</h3><a class="small" href="#/apartment">Басқару →</a></div>
          <div class="hbars" data-rooms></div>
          <p class="muted tiny" style="margin-top:12px" data-rlimit></p>
        </div>
      </div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('task')}</span>Тапсырма: «Үйдегі электр құралдары»</h3><a class="small" href="#/task">Толығырақ →</a></div>
        <div class="tasks">${TASKS.map((t, i) => `<a class="task" href="#/${t.route}"><span class="n">${i + 1}</span><b>${t.title}</b><span>${t.short}</span><span class="go">${ic('chevR')}</span></a>`).join('')}</div>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('chart')}</span>Санаттар бойынша қосулы қуат</h3></div><div class="hbars" data-cats></div></div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('activity')}</span>Соңғы оқиғалар</h3><a class="small" href="#/notifications?tab=events">Барлығы →</a></div><div class="events" data-events><div class="skeleton" style="height:180px"></div></div></div>
      </div>`;
    $('[data-unplug]', root).onclick = unplugAll;
    const loadEvents = async () => {
      try {
        const d = await api('events');
        $('[data-events]', root).innerHTML = d.items.length ? d.items.slice(0, 7).map(eventHTML).join('') : emptyHTML('activity', 'Оқиға жоқ', 'Құралдарды қосып көріңіз');
      } catch (e) { /* бет ауыстырылған */ }
    };
    const update = () => {
      const st = S.state; const t = st.totals; const set = st.settings;
      $('[data-summary]', root).textContent = t.plugged
        ? `Қазір ${t.plugged} құрал розеткаға қосулы, олар ${fW(t.power, 0)} қуат тұтынады. Осы қарқынмен айына шамамен ${fT(t.costMonth)} төлейсіз (тариф ${fmt(set.tariff)} ₸/кВт·сағ).`
        : 'Қазір бірде-бір құрал розеткаға қосылмаған. «Менің пәтерім» бетінде құралдарды қосып көріңіз.';
      const overRooms = st.rooms.filter((r) => r.overload);
      $('[data-banner]', root).innerHTML = t.overload ? `<div class="banner"><span class="ic">${ic('warn')}</span><div class="txt"><b>Шамадан тыс жүктеме!</b><p class="small">${t.apartmentOverload ? `Пәтердің жалпы қуаты ${fW(t.power, 0)} — шектен (${fW(set.apartmentLimit, 0)}) ${fW(t.power - set.apartmentLimit, 0)} артық. ` : ''}${overRooms.length ? `Желі шегінен асқан бөлме: ${overRooms.map((r) => `«${esc(r.name)}» (${fW(r.power, 0)})`).join(', ')}.` : ''} Автомат ажырап кетуі мүмкін.</p></div><button class="btn btn-danger" data-unplug2>${ic('power')}Барлығын өшіру</button></div>` : '';
      const b2 = $('[data-unplug2]', root); if (b2) b2.onclick = unplugAll;
      countUp($('[data-k="s-plug"]', root), t.plugged, (x) => `${fmt(x, 0)}<small>/ ${t.count}</small>`);
      countUp($('[data-k="s-power"]', root), t.power, (x) => `${fmt(x, 0)}<small>Вт</small>`);
      countUp($('[data-k="s-current"]', root), t.current, (x) => `${fmt(x, 1)}<small>А</small>`);
      countUp($('[data-k="s-kwh"]', root), t.kwhDay, (x) => `${fmt(x, 2)}<small>кВт·сағ</small>`);
      countUp($('[data-k="s-cost"]', root), t.costMonth, (x) => `${fmt(x, 0)}<small>₸/ай</small>`);
      setGauge($('[data-gauge]', root), t.loadPct, `${fW(t.power, 0)} / ${fW(set.apartmentLimit, 0)}`);
      $('[data-pill]', root).innerHTML = statusPill(t.loadPct);
      $('[data-limit]', root).textContent = `${fW(set.apartmentLimit, 0)} (≈ 32 А × 220 В)`;
      $('[data-gsub]', root).textContent = `Бос қор: ${fW(Math.max(0, set.apartmentLimit - t.power), 0)}`;
      const scale = Math.max(set.roomLimit * 1.25, ...st.rooms.map((r) => r.power));
      $('[data-rooms]', root).innerHTML = st.rooms.map((r) => `<div class="hbar" title="${esc(r.name)}: ${fW(r.power, 0)} / ${fW(set.roomLimit, 0)}">
          <div class="top"><span class="row" style="gap:8px">${ic(roomIcon(r.name)).replace('<svg ', '<svg style="width:16px;height:16px;color:var(--muted)" ')}<b>${esc(r.name)}</b>${socketsHTML(r.used, r.sockets)}</span><span class="num ${r.overload ? 'badge danger' : ''}">${fW(r.power, 0)}</span></div>
          <div class="track"><i class="fill ${r.overload ? 'danger' : r.power > set.roomLimit * 0.85 ? 'warn' : ''}" data-w="${(r.power / scale) * 100}"></i><i class="marker" style="left:${(set.roomLimit / scale) * 100}%" title="Желі шегі"></i></div></div>`).join('');
      $('[data-rlimit]', root).innerHTML = `Тік сызық — бір бөлме желісінің шегі (${fW(set.roomLimit, 0)}). Шаршылар — қолданыстағы / барлық розеткалар.`;
      const groups = E.GROUP_CLASSES.map((G) => ({ G, p: S.apt.plugged().filter((a) => a instanceof G).reduce((s, a) => s + a.power, 0), n: S.apt.plugged().filter((a) => a instanceof G).length }));
      const gmax = Math.max(1, ...groups.map((g) => g.p));
      $('[data-cats]', root).innerHTML = groups.map((g) => `<div class="hbar" title="${esc(g.G.KZ)}: ${fW(g.p, 0)}"><div class="top"><span><b>${esc(g.G.KZ)}</b> <span class="muted tiny mono">${g.G.name}</span></span><span class="num">${fW(g.p, 0)} <span class="muted tiny">· ${g.n} құрал</span></span></div><div class="track"><i class="fill" data-w="${(g.p / gmax) * 100}"></i></div></div>`).join('');
      requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', root).forEach((i) => { i.style.width = i.dataset.w + '%'; })));
    };
    update(); loadEvents();
    return { onState() { update(); loadEvents(); } };
  }

  const EVENT_META = { ADD: ['plus', 'Пәтерге қосылды'], EDIT: ['edit', 'Өзгертілді'], DELETE: ['trash', 'Жойылды'], PLUG: ['plug', 'Розеткаға қосылды'], UNPLUG: ['power', 'Ажыратылды'], UNPLUG_ALL: ['power', 'Барлығы өшірілді'] };
  const eventHTML = (e) => `<div class="ev ${e.action}"><span class="dot">${ic((EVENT_META[e.action] || ['info'])[0])}</span><span><b>${esc((EVENT_META[e.action] || ['', e.action])[1])}</b> · ${esc(e.details)}${e.power ? ` <span class="muted">(${fW(e.power, 0)})</span>` : ''}</span><time title="${fDate(e.created_at)}">${ago(e.created_at)}</time></div>`;

  /* ======================= БЕТ: ТАПСЫРМА ======================= */
  const TASKS = [
    { route: 'hierarchy', title: 'Класс иерархиясын анықтау', short: 'ElectricAppliance → 5 санат → 12 класс', full: 'Абстрактілі ElectricAppliance класы, Pluggable және Heating интерфейстері, 5 аралық санат және 12 нақты класс. Полиморфты describe() әдісі.', where: 'static/model.js (JS кластары) · server.py, 1-бөлім (Python кластары)' },
    { route: 'apartment', title: 'Кейбірін розеткаға қосу', short: 'Бөлмедегі бос розеткаға қосу/ажырату', full: 'Әр бөлмеде розетка саны шектеулі (Ас үй — 4, Қонақ бөлме — 5, Жатын бөлме — 3, Жуынатын бөлме — 2). Бос розетка болмаса — «Бұл бөлмеде бос розетка жоқ».', where: 'Room.plug() · POST /api/plug · appliances.plugged бағаны' },
    { route: 'calc', title: 'Тұтынылатын қуатты есептеу', short: 'P, I = P/U, E = P·t/1000, ₸/ай', full: 'Қосулы құралдардың жалпы қуаты, ток күші, тәуліктік энергиясы және айлық төлемі. Шектен асса — ескерту хабарламасы.', where: 'current(), dailyKwh(), monthlyCost() · Apartment.totalPower()' },
    { route: 'sort', title: 'Қуаты бойынша сұрыптау', short: 'Өсу / кему, анимациялы рейтинг', full: 'Пәтердегі құралдарды қуаты бойынша (сондай-ақ атауы, энергия класы, кВт·сағ бойынша) сұрыптау.', where: 'sorted(key=…) Python · Comparator Java · ORDER BY SQL · GET /api/sort' },
    { route: 'search', title: 'Параметрлер аралығы бойынша іздеу', short: 'min–max аралықтары, SQL BETWEEN', full: 'Қуат, кернеу, салмақ, жұмыс уақыты аралықтары + энергия класы, санат, бөлме, атауы бойынша іздеу. Параметрленген SQL сұранысы көрсетіледі.', where: 'GET /api/search · get_search() · WHERE … BETWEEN ? AND ?' },
  ];
  const EXTRAS = [
    ['user', 'Тіркелу', 'Логин, email, құпиясөз күші өлшегіші, валидация', 'profile'],
    ['lock', 'Кіру және сессия', 'HttpOnly + SameSite=Strict cookie, 5 қатеден кейін 30 с бұғат', 'profile'],
    ['shield', 'Құпиясөзді хэштеу', 'PBKDF2-HMAC-SHA256, 16 байт тұз, 120 000 итерация', 'profile'],
    ['crown', 'Рөлдер ADMIN / CLIENT', 'Рөл серверде тексеріледі (403)', 'dashboard'],
    ['db', 'SQL дерекқор', 'SQLite: 9 кесте, сыртқы кілттер, параметрленген сұраныстар', 'search'],
    ['bell', 'Хабарламалар', 'Дерекқорда сақталады + тост + браузер Notification API', 'notifications'],
    ['menu', 'Сайдбар', 'Жиналатын; телефонда шығып тұратын мәзір', 'dashboard'],
    ['palette', 'Тақырыптар', 'Жарық / қараңғы / жүйелік + 4 акцент түсі', 'settings'],
    ['cube', '3D анимация', 'three.js: 3D пәтер, электр бөлшектері, кіру бетіндегі сахна', 'three'],
    ['film', 'Видео мен суреттер', '4 видео, 14 фото, лайтбокс галерея', 'media'],
  ];
  function pageTask(root) {
    root.innerHTML = `
      <div class="hero-card"><p class="muted small">ООП · «Үйдегі электр құралдары»</p>
        <h2>Тапсырма мәтіні</h2>
        <p><b>Үйдегі электр құралдары.</b> Электр құралдарының иерархиясын анықтау. Кейбірін розеткаға қосу. Тұтынылатын қуатты есептеу. Пәтердегі құралдарды қуаты бойынша сұрыптау. Пәтердегі берілген параметрлер аралығына сәйкес келетін құралды табу.</p>
      </div>
      <div class="stack">${TASKS.map((t, i) => `<div class="card"><div class="row" style="align-items:flex-start;gap:16px;flex-wrap:nowrap">
          <span class="task" style="padding:0;border:0;background:none"><span class="n">${i + 1}</span></span>
          <div style="flex:1;min-width:0"><h3 style="font-size:17px">${t.title}</h3><p class="muted" style="margin:4px 0 8px">${t.full}</p>
            <p class="small"><span class="badge iface">${ic('code')}Код</span> <span class="mono small">${esc(t.where)}</span></p></div>
          <a class="btn btn-sm" href="#/${t.route}">Ашу ${ic('chevR')}</a></div></div>`).join('')}</div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('check')}</span>Қосымша талаптар — барлығы орындалған</h3></div>
        <div class="tips">${EXTRAS.map(([i, t, d, r]) => `<a class="tip" href="#/${r}" style="text-decoration:none;color:inherit"><span class="ic">${ic(i)}</span><b>${t} <span class="badge on">${ic('check')}бар</span></b><p>${d}</p></a>`).join('')}</div>
      </div>`;
    return {};
  }

  /* ======================= БЕТ: ИЕРАРХИЯ (1-қадам) ======================= */
  function pageHierarchy(root) {
    const count = (C) => S.apt.appliances.filter((a) => a instanceof C).length;
    const leafNode = (C) => {
      const heat = C.INTERFACES.includes(E.Heating);
      return `<button class="node" data-cls="${C.name}"><div class="cn">${C.name}</div><div class="kz">${esc(C.KZ)}</div>
        <div class="meta"><span class="badge">${C.TYPE}</span>${heat ? `<span class="badge heat">${ic('flame')}Heating</span>` : ''}${count(C) ? `<span>× ${count(C)}</span>` : ''}</div></button>`;
    };
    root.innerHTML = `
      <div class="hero-card"><p class="muted small">1-қадам</p><h2>Электр құралдарының <span class="grad-text">класс иерархиясы</span></h2>
        <p>Түйінді басып, класстың өрістерін, әдістерін және Java кодын көріңіз. Иерархия үш жерде бірдей: <span class="mono">static/model.js</span> (JS), <span class="mono">server.py</span> (Python) және Android қосымшасы (Java).</p>
        <div class="row legend"><span><i style="background:linear-gradient(135deg,var(--accent),var(--accent-2))"></i>абстрактілі класс</span><span><i style="border:1.5px dashed var(--info)"></i>интерфейс</span><span><i style="background:var(--surface-2);border:1px solid var(--border-strong)"></i>нақты класс</span><span class="badge heat">${ic('flame')}Heating іске асырады</span></div>
      </div>
      <div class="grid g-side">
        <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('tree')}</span>Иерархия ағашы</h3><div class="row"><button class="btn btn-sm" data-expand>${ic('chevD')}Барлығын ашу/жабу</button></div></div>
          <div class="tree">
            <div class="tree-top">
              <button class="node iface" data-cls="Pluggable"><div class="stereo">«interface»</div><div class="cn">Pluggable</div><div class="kz">Розеткаға қосылатын</div></button>
              <button class="node root" data-cls="ElectricAppliance"><div class="stereo">«abstract»</div><div class="cn">ElectricAppliance</div><div class="kz">Электр құралы</div><div class="meta" style="justify-content:center">${S.apt.appliances.length} объект пәтерде</div></button>
              <button class="node iface" data-cls="Heating"><div class="stereo">«interface»</div><div class="cn">Heating</div><div class="kz">Қыздырғыш элемент</div></button>
            </div>
            <div class="tree-bus"></div>
            <div class="tree-cols">${E.GROUP_CLASSES.map((G) => `<div class="tree-col">
                <button class="node group" data-cls="${G.name}"><div class="stereo">«abstract»</div><div class="cn">${G.name}</div><div class="kz">${esc(G.KZ)}</div><div class="toggle">${ic('chevD').replace('<svg ', '<svg style="width:14px;height:14px;vertical-align:-2px" ')}</div></button>
                <div class="leaves">${E.APPLIANCE_CLASSES.filter((C) => Object.getPrototypeOf(C) === G).map(leafNode).join('')}</div></div>`).join('')}</div>
          </div>
        </div>
        <div class="detail-panel">
          <div class="card" data-detail></div>
          <div class="card" data-demo></div>
        </div>
      </div>`;
    const ALL = { Pluggable: E.Pluggable, Heating: E.Heating, ElectricAppliance: E.ElectricAppliance };
    E.GROUP_CLASSES.concat(E.APPLIANCE_CLASSES).forEach((C) => { ALL[C.name] = C; });
    let selected = 'ElectricAppliance';
    const select = (name) => {
      selected = name;
      const target = ALL[name];
      const iface = name === 'Pluggable' || name === 'Heating';
      $$('.node', root).forEach((n) => {
        const C = ALL[n.dataset.cls];
        let on = n.dataset.cls === name;
        if (iface && typeof C === 'function' && C.TYPE) on = C.INTERFACES.includes(target);
        if (iface && name === 'Pluggable' && typeof C === 'function') on = true;
        n.classList.toggle('active', on);
        n.classList.toggle('dim', iface && !on && n.dataset.cls !== name && !(name === 'Pluggable'));
      });
      if (!iface && typeof target === 'function' && target !== E.ElectricAppliance) {
        let p = Object.getPrototypeOf(target);
        while (p && p.name) { const n = $(`.node[data-cls="${p.name}"]`, root); if (n) n.classList.add('active'); p = Object.getPrototypeOf(p); }
      }
      renderDetail(name, target);
    };
    const renderDetail = (name, C) => {
      const box = $('[data-detail]', root);
      if (name === 'Pluggable' || name === 'Heating') {
        const impl = E.APPLIANCE_CLASSES.filter((X) => X.INTERFACES.includes(C));
        box.innerHTML = `<div class="card-head"><h3><span class="ic">${ic('plug')}</span>${esc(C.kz)}</h3><span class="badge iface">«interface»</span></div>
          <p class="mono" style="color:var(--info);font-weight:700">${C.name}</p>
          <p class="muted small" style="margin:6px 0 12px">${name === 'Pluggable' ? 'Барлық электр құралдары розеткаға қосылады — ElectricAppliance осы интерфейсті іске асырады, сондықтан 12 класстың бәрі оны мұраға алады.' : 'Қыздырғыш элементі бар құралдар: максималды температурасын қайтарады.'}</p>
          <div class="member-list">${C.methods.map((m) => `<div><code>${m}()</code><span>${m === 'maxTemperature' ? 'int, °C' : m === 'isPluggedIn' ? 'boolean' : 'void'}</span></div>`).join('')}</div>
          <p class="small" style="margin:12px 0 6px"><b>Іске асыратын кластар (${impl.length}):</b></p>
          <div class="chips">${impl.map((X) => `<span class="chip" data-go="${X.name}">${X.name}${name === 'Heating' ? ` · ${new X({}).maxTemperature()} °C` : ''}</span>`).join('')}</div>
          <pre class="code" style="margin-top:12px">${hl(javaCode(name, C))}</pre>`;
      } else {
        const isLeaf = !!C.TYPE;
        const chain = []; let p = C; while (p && p.name && p !== Function.prototype) { chain.unshift(p.name); p = Object.getPrototypeOf(p); }
        const inst = isLeaf ? new C({}) : null;
        const fields = E.ElectricAppliance.FIELDS.map(([f, t, d]) => {
          const desc = isLeaf && f === 'extra' ? `${C.EXTRA_LABEL}, ${C.EXTRA_UNIT}` : d;
          return `<div class="${C === E.ElectricAppliance ? '' : 'inh'}"><code>${t} ${f}</code><span>${esc(desc)}</span></div>`;
        }).join('');
        const methods = E.ElectricAppliance.METHODS.map(([m, t, d]) => {
          const own = m === 'describe()' && (isLeaf || C === E.ElectricAppliance);
          return `<div class="${C === E.ElectricAppliance || own ? '' : 'inh'}"><code>${t} ${m}</code><span>${esc(d)}${isLeaf && m === 'describe()' ? ' — @Override' : ''}</span></div>`;
        }).join('') + (inst && inst.isHeating() ? `<div><code>int maxTemperature()</code><span>Heating: ${inst.maxTemperature()} °C — @Override</span></div>` : '');
        box.innerHTML = `<div class="card-head"><h3><span class="ic">${ic(isLeaf ? TYPE_ICON[C.TYPE] : 'tree')}</span>${esc(C.KZ)}</h3><span class="badge ${isLeaf ? 'on' : 'client'}">${isLeaf ? 'нақты класс' : '«abstract»'}</span></div>
          <p class="small mono" style="margin-bottom:10px">${chain.map((n, i) => `<span style="${i === chain.length - 1 ? 'color:var(--accent);font-weight:700' : 'color:var(--muted)'}">${n}</span>`).join(' → ')}</p>
          ${C.NOTE ? `<p class="muted small" style="margin-bottom:10px">${esc(C.NOTE)}</p>` : ''}
          ${isLeaf ? `<div class="row" style="margin-bottom:10px"><span class="badge">TYPE = ${C.TYPE}</span>${C.INTERFACES.map((i) => `<span class="badge ${i === E.Heating ? 'heat' : 'iface'}">implements ${i.name}</span>`).join('')}<span class="badge">пәтерде: ${count(C)}</span></div>` : `<p class="small" style="margin-bottom:10px">Пәтердегі объектілер: <b>${count(C)}</b></p>`}
          <p class="small" style="margin-bottom:6px"><b>Өрістер</b> ${C === E.ElectricAppliance ? '' : '<span class="muted">(ElectricAppliance-тен мұра)</span>'}</p><div class="member-list">${fields}</div>
          <p class="small" style="margin:12px 0 6px"><b>Әдістер</b></p><div class="member-list">${methods}</div>
          <p class="small" style="margin:12px 0 6px"><b>Java коды</b> <span class="muted">(Android қосымшасындағыдай)</span></p>
          <pre class="code">${hl(javaCode(name, C))}</pre>`;
      }
      $$('[data-go]', box).forEach((c) => c.addEventListener('click', () => select(c.dataset.go)));
    };
    const renderDemo = () => {
      const box = $('[data-demo]', root);
      const apps = S.apt.appliances;
      box.innerHTML = `<div class="card-head"><h3><span class="ic">${ic('code')}</span>Тірі демо: полиморфизм</h3></div>
        ${apps.length ? `<label class="field"><span>Пәтердегі объектіні таңдаңыз</span><select data-pick>${apps.map((a) => `<option value="${a.id}">${esc(a.name)} — ${esc(a.kz)} (${esc(a.room ? a.room.name : '')})</option>`).join('')}</select></label>
        <div data-out style="margin-top:12px"></div>` : emptyHTML('box', 'Пәтерде құрал жоқ', 'Алдымен «Менің пәтерім» бетінде құрал қосыңыз')}
        <button class="btn btn-sm" data-abstract style="margin-top:12px">${ic('warn')}new ElectricAppliance() жасап көру</button>
        <div data-abs-out class="small" style="margin-top:8px"></div>`;
      const pick = $('[data-pick]', box);
      const show = () => {
        const json = S.state.appliances.find((x) => x.id === +pick.value);
        const a = E.ApplianceFactory.create(json);
        const C = a.constructor; const G = Object.getPrototypeOf(C);
        const t = S.state.settings.tariff;
        const same = Math.abs(a.monthlyCost(t) - json.monthlyCost) < 0.01;
        $('[data-out]', box).innerHTML = `<pre class="code">${hl(`const a = ApplianceFactory.create(json); // → ${C.name}
a instanceof ${C.name}          // true
a instanceof ${G.name}  // true
a instanceof ElectricAppliance  // true
implementsInterface(a, Heating) // ${a.isHeating()}
a.current()    // ${fmt(a.current(), 3)} А
a.dailyKwh()   // ${fmt(a.dailyKwh(), 3)} кВт·сағ
a.monthlyCost(${fmt(t)}) // ${fmt(a.monthlyCost(t), 2)} ₸`)}</pre>
          <p class="small" style="margin-top:10px"><b>a.describe()</b> — JS (браузер):</p><p class="small muted">${esc(a.describe())}</p>
          <p class="small" style="margin-top:8px"><b>describe()</b> — Python (сервер):</p><p class="small muted">${esc(json.describe)}</p>
          <p class="verify" style="margin-top:8px">${ic(same ? 'ok' : 'warn')}${same ? 'JS және Python есептері сәйкес' : 'Есептер сәйкес емес'}</p>`;
        select(C.name);
      };
      if (pick) { pick.addEventListener('change', show); show(); }
      $('[data-abstract]', box).onclick = () => {
        try { new E.ElectricAppliance({ name: 'x' }); $('[data-abs-out]', box).textContent = 'Объект жасалды (күтілмеген)'; } catch (e) { $('[data-abs-out]', box).innerHTML = `<span style="color:var(--danger)">TypeError:</span> ${esc(e.message)}`; }
      };
    };
    $$('.node', root).forEach((n) => n.addEventListener('click', (e) => {
      if (n.classList.contains('group') && e.target.closest('.toggle')) { n.parentElement.classList.toggle('closed'); return; }
      select(n.dataset.cls);
    }));
    $('[data-expand]', root).onclick = () => {
      const cols = $$('.tree-col', root); const anyOpen = cols.some((c) => !c.classList.contains('closed'));
      cols.forEach((c) => c.classList.toggle('closed', anyOpen));
    };
    renderDemo();
    if (!S.apt.appliances.length) select('ElectricAppliance');
    return { onState() { /* иерархия тұрақты */ } };
  }

  function javaCode(name, C) {
    if (name === 'Pluggable') return 'public interface Pluggable {\n    void plugIn();\n    void unplug();\n    boolean isPluggedIn();\n}';
    if (name === 'Heating') return 'public interface Heating {\n    int maxTemperature(); // °C\n}';
    if (C === E.ElectricAppliance) {
      return `public abstract class ElectricAppliance implements Pluggable {
    protected long id;
    protected String name, brand;
    protected double power;        // Вт
    protected double voltage;      // В
    protected EnergyClass energyClass;
    protected double weight;       // кг
    protected double extra;        // түріне тән параметр
    protected double hoursPerDay;  // сағ
    protected boolean pluggedIn;
    protected Room room;

    public void plugIn()  { pluggedIn = true; }
    public void unplug()  { pluggedIn = false; }
    public boolean isPluggedIn() { return pluggedIn; }

    public double current()  { return power / voltage; }          // I = P / U
    public double dailyKwh() { return power * hoursPerDay / 1000; } // E = P·t/1000
    public double monthlyCost(double tariff) { return dailyKwh() * 30 * tariff; }

    public abstract String describe();
}`;
    }
    if (!C.TYPE) return `// ${C.KZ}\npublic abstract class ${C.name} extends ElectricAppliance {\n    // санатқа ортақ әрекеттер осында\n}`;
    const parent = Object.getPrototypeOf(C).name;
    const heat = C.INTERFACES.includes(E.Heating);
    const temp = heat ? new C({}).maxTemperature() : 0;
    return `// ${C.KZ} · TYPE = "${C.TYPE}" · extra → «${C.EXTRA_LABEL}», ${C.EXTRA_UNIT}
public class ${C.name} extends ${parent}${heat ? ' implements Heating' : ''} {
${heat ? `    @Override
    public int maxTemperature() { return ${temp}; }

` : ''}    @Override
    public String describe() {
        return String.format("${C.KZ} «%s»: ${C.EXTRA_LABEL.toLowerCase()} %.1f ${C.EXTRA_UNIT}, %.0f Вт",
                name, extra, power);
    }
}`;
  }

  /* ======================= БЕТ: МЕНІҢ ПӘТЕРІМ (2-қадам) ======================= */
  function pageApartment(root) {
    let filter = store.get('aptFilter', 'all'); let roomFilter = 'all'; let q = '';
    root.innerHTML = `
      <div class="card"><div class="row between">
        <div class="row">
          <div class="seg" data-filter>${[['all', 'Барлығы'], ['on', 'Қосулы'], ['off', 'Өшірулі']].map(([k, l]) => `<button type="button" data-f="${k}" class="${k === filter ? 'active' : ''}">${l}</button>`).join('')}</div>
          <select data-room style="width:auto;height:38px"><option value="all">Барлық бөлмелер</option>${S.state.rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
          <input data-q type="search" placeholder="Атауы бойынша сүзу…" style="width:200px;height:38px">
        </div>
        <div class="row"><button class="btn" data-unplug>${ic('power')}Барлығын өшіру</button><button class="btn btn-primary" data-add>${ic('plus')}Құрал қосу</button></div>
      </div></div>
      <div data-rooms class="stack" style="gap:26px"></div>`;
    $$('[data-f]', root).forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.f; store.set('aptFilter', filter);
      $$('[data-f]', root).forEach((x) => x.classList.toggle('active', x === b)); render();
    }));
    $('[data-room]', root).onchange = (e) => { roomFilter = e.target.value; render(); };
    $('[data-q]', root).oninput = debounce((e) => { q = e.target.value.trim().toLowerCase(); render(); }, 200);
    $('[data-add]', root).onclick = () => openAddModal();
    $('[data-unplug]', root).onclick = unplugAll;

    const cardHTML = (a) => {
      const j = S.state.appliances.find((x) => x.id === a.id);
      return `<article class="app-card ${a.pluggedIn ? 'on' : ''}" data-id="${a.id}">
        <div class="media">${a.image ? `<img src="media/${esc(a.image)}" alt="${esc(a.name)}" loading="lazy">` : `<div class="ph">${ic(TYPE_ICON[a.type])}</div>`}
          <span class="tag badge">${esc(a.kz)}</span>
          <button class="menu-btn" data-menu aria-label="Әрекеттер">${ic('more')}</button>
          <span class="live"><i></i><span data-live>${a.pluggedIn ? 'Қосулы' : 'Өшірулі'}</span></span></div>
        <div class="body">
          <div><h4>${esc(a.name)}</h4><div class="sub row" style="gap:6px">${esc(a.brand)} ${eclass(a.energyClass)} ${a.isHeating() ? `<span class="badge heat">${ic('flame')}${a.maxTemperature()} °C</span>` : ''}</div></div>
          <div class="kv"><span>Кернеу U</span><b>${fV(a.voltage)}</b><span>Ток I = P/U</span><b>${fA(a.current())}</b>
            <span>${esc(a.constructor.EXTRA_LABEL)}</span><b>${fmt(a.extra)} ${esc(a.constructor.EXTRA_UNIT)}</b>
            <span>Жұмыс t</span><b>${fmt(a.hoursPerDay)} сағ/тәу</b><span>Энергия E</span><b>${fmt(a.dailyKwh(), 2)} кВт·сағ</b>
            <span>Айына</span><b>${fT(j ? j.monthlyCost : a.monthlyCost(S.state.settings.tariff))}</b></div>
          <div class="foot"><div class="pw num">${fmt(a.power)}<small> Вт</small></div>
            <label class="plug-label">${ic('plug').replace('<svg ', '<svg style="width:16px;height:16px" ')}<span>Розетка</span><span class="switch"><input type="checkbox" data-plug ${a.pluggedIn ? 'checked' : ''} aria-label="Розеткаға қосу"><span class="track"></span></span></label></div>
        </div></article>`;
    };

    const render = () => {
      const box = $('[data-rooms]', root);
      const set = S.state.settings;
      const rooms = S.apt.rooms.filter((r) => roomFilter === 'all' || String(r.id) === roomFilter);
      if (!S.apt.appliances.length) {
        box.innerHTML = `<div class="card">${emptyHTML('plug', 'Пәтеріңіз әзірге бос', 'Каталогтан шәйнек, тоңазытқыш, теледидар сияқты құралдарды қосыңыз.', `<button class="btn btn-primary" data-add2>${ic('plus')}Бірінші құралды қосу</button>`)}</div>`;
        $('[data-add2]', box).onclick = () => openAddModal();
        return;
      }
      box.innerHTML = rooms.map((r) => {
        const list = r.appliances.filter((a) => (filter === 'all' || (filter === 'on') === a.isPluggedIn()) && (!q || a.name.toLowerCase().includes(q) || a.kz.toLowerCase().includes(q)));
        const rs = S.state.rooms.find((x) => x.id === r.id);
        const pct = Math.min(100, (r.power() / set.roomLimit) * 100);
        return `<section class="room-block" data-room-id="${r.id}">
          <div class="room-head"><h3><span class="ic">${ic(roomIcon(r.name))}</span>${esc(r.name)}</h3>
            <div class="room-meta" data-meta>${roomMeta(r, rs, pct)}</div><span class="spacer"></span>
            <button class="btn btn-sm" data-add-room="${r.id}">${ic('plus')}Қосу</button></div>
          ${list.length ? `<div class="app-grid">${list.map(cardHTML).join('')}</div>` : `<div class="card" style="padding:4px">${emptyHTML(roomIcon(r.name), r.appliances.length ? 'Сүзгіге сәйкес құрал жоқ' : 'Бұл бөлмеде құрал жоқ', r.appliances.length ? 'Сүзгіні өзгертіп көріңіз' : '«Қосу» батырмасы арқылы құрал қосыңыз')}</div>`}
        </section>`;
      }).join('');
      $$('[data-add-room]', box).forEach((b) => b.addEventListener('click', () => openAddModal(+b.dataset.addRoom)));
      $$('.app-card', box).forEach(bindCard);
    };
    const roomMeta = (r, rs, pct) => `${socketsHTML(r.usedSockets(), r.sockets)}<span>${r.usedSockets()} / ${r.sockets} розетка · бос: <b>${r.freeSockets()}</b></span>
      <span class="row" style="gap:8px"><span class="mini-track"><i class="${rs && rs.overload ? 'danger' : ''}" style="width:${pct}%"></i></span><b class="num">${fW(r.power(), 0)}</b> / ${fW(S.state.settings.roomLimit, 0)}</span>
      ${rs && rs.overload ? `<span class="badge danger">${ic('warn')}желі шегінен асты</span>` : ''}`;
    const bindCard = (card) => {
      const id = +card.dataset.id;
      const sw = $('[data-plug]', card);
      sw.addEventListener('change', async () => {
        sw.disabled = true;
        const ok = await togglePlug(id, sw.checked);
        sw.disabled = false;
        if (ok && sw.checked) { card.classList.remove('zap'); void card.offsetWidth; card.classList.add('zap'); }
      });
      $('[data-menu]', card).addEventListener('click', (e) => {
        e.stopPropagation();
        $$('.ctx-menu').forEach((m) => m.remove());
        const a = S.apt.appliances.find((x) => x.id === id);
        const m = el(`<div class="ctx-menu"><button data-a="edit">${ic('edit')}Өзгерту</button><button data-a="3d">${ic('cube')}3D-де көрсету</button><button data-a="del" class="danger">${ic('trash')}Жою</button></div>`);
        m.addEventListener('click', (ev) => {
          const act = ev.target.closest('button') && ev.target.closest('button').dataset.a;
          m.remove();
          if (act === 'edit') openEditModal(S.state.appliances.find((x) => x.id === id));
          if (act === '3d') { store.set('select3d', String(id)); location.hash = '#/three'; }
          if (act === 'del') deleteAppliance(a);
        });
        card.append(m);
      });
    };
    const signature = () => S.state.appliances.map((a) => `${a.id}:${a.roomId}:${a.name}:${a.power}:${a.image}:${a.energyClass}:${a.hoursPerDay}:${a.extra}`).join('|');
    let sig = signature();
    const patch = () => {
      if (filter !== 'all') return render();
      S.apt.appliances.forEach((a) => {
        const card = $(`.app-card[data-id="${a.id}"]`, root);
        if (!card) return;
        card.classList.toggle('on', a.pluggedIn);
        const sw = $('[data-plug]', card); if (sw && !sw.disabled) sw.checked = a.pluggedIn;
        $('[data-live]', card).textContent = a.pluggedIn ? 'Қосулы' : 'Өшірулі';
      });
      S.apt.rooms.forEach((r) => {
        const meta = $(`[data-room-id="${r.id}"] [data-meta]`, root);
        const rs = S.state.rooms.find((x) => x.id === r.id);
        if (meta) meta.innerHTML = roomMeta(r, rs, Math.min(100, (r.power() / S.state.settings.roomLimit) * 100));
      });
    };
    render();
    return { onState() { const s = signature(); if (s !== sig) { sig = s; render(); } else patch(); } };
  }

  /* ======================= БЕТ: ҚУАТТЫ ЕСЕПТЕУ (3-қадам) ======================= */
  function pageCalc(root) {
    let scope = 'on';
    root.innerHTML = `
      <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('calc')}</span>Формулалар</h3><span class="badge" data-tariff></span></div>
        <div class="formulas">
          <div class="formula"><span class="f"><b>I</b> = P / U</span><span class="d">Ток күші, ампер (А). P — қуат (Вт), U — кернеу (В). Класс әдісі: <span class="mono">current()</span></span></div>
          <div class="formula"><span class="f"><b>E</b> = P · t / 1000</span><span class="d">Тәуліктік энергия, кВт·сағ. t — тәулігіне жұмыс уақыты (сағ). <span class="mono">dailyKwh()</span></span></div>
          <div class="formula"><span class="f"><b>Төлем</b> = E · 30 · T</span><span class="d">Айлық төлем, ₸. T — тариф (₸/кВт·сағ). <span class="mono">monthlyCost(tariff)</span></span></div>
        </div></div>
      <div class="grid g-main">
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('grid')}</span>Есептеу кестесі</h3>
            <div class="seg" data-scope><button type="button" data-s="on" class="active">Қосулылар</button><button type="button" data-s="all">Барлық құралдар</button></div></div>
          <div class="table-wrap"><table><thead><tr><th>Құрал</th><th>Бөлме</th><th class="r">P, Вт</th><th class="r">U, В</th><th class="r">I, А</th><th class="r">t, сағ</th><th class="r">E, кВт·сағ</th><th class="r">₸ / ай</th></tr></thead><tbody data-body></tbody><tfoot data-foot></tfoot></table></div>
          <p data-verify style="margin-top:12px"></p>
        </div>
        <div class="stack" style="gap:20px">
          <div class="card"><div class="card-head"><h3><span class="ic">${ic('gauge')}</span>Пәтер жүктемесі</h3><span data-pill></span></div><div data-gauge>${gaugeHTML()}</div>
            <p class="muted small" style="margin-top:10px" data-gnote></p></div>
          <div class="card"><div class="card-head"><h3><span class="ic">${ic('chart')}</span>Жалпы қуаттағы үлесі</h3></div><div class="hbars" data-share></div></div>
        </div>
      </div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('bolt')}</span>Мини-калькулятор</h3><span class="muted small">Кез келген құрал үшін формуланы тексеріңіз</span></div>
        <div class="calc-mini">
          <label class="field"><span>Қуаты P, Вт</span><input type="number" data-cp value="2000" min="0" step="any"></label>
          <label class="field"><span>Кернеуі U, В</span><input type="number" data-cu value="220" min="1" step="any"></label>
          <label class="field"><span>Тәулігіне t, сағ</span><input type="number" data-ct value="1" min="0" max="24" step="any"></label>
        </div>
        <div class="calc-out" data-cout></div></div>`;
    $$('[data-s]', root).forEach((b) => b.addEventListener('click', () => { scope = b.dataset.s; $$('[data-s]', root).forEach((x) => x.classList.toggle('active', x === b)); update(); }));
    const mini = () => {
      const p = +$('[data-cp]', root).value || 0; const u = +$('[data-cu]', root).value || 0; const t = +$('[data-ct]', root).value || 0;
      const tariff = S.state.settings.tariff;
      const I = u ? p / u : 0; const Ek = (p * t) / 1000;
      $('[data-cout]', root).innerHTML = `<div><span>I = ${fmt(p)} / ${fmt(u)}</span><b>${fA(I)}</b></div><div><span>E = ${fmt(p)} · ${fmt(t)} / 1000</span><b>${fKwh(Ek)}</b></div><div><span>${fmt(Ek, 3)} · 30 · ${fmt(tariff)}</span><b>${fT(Ek * 30 * tariff)}</b></div>`;
    };
    $$('[data-cp],[data-cu],[data-ct]', root).forEach((i) => i.addEventListener('input', mini));
    const update = () => {
      const st = S.state; const set = st.settings; const t = st.totals;
      $('[data-tariff]', root).textContent = `Тариф: ${fmt(set.tariff)} ₸/кВт·сағ`;
      const list = (scope === 'on' ? S.apt.plugged() : S.apt.appliances).slice().sort((a, b) => b.power - a.power);
      const sum = (f) => list.reduce((s, a) => s + f(a), 0);
      $('[data-body]', root).innerHTML = list.length ? list.map((a) => `<tr><td><div class="cell-app">${thumb(a)}<div><b>${esc(a.name)}</b><div class="muted tiny">${esc(a.kz)} ${a.pluggedIn ? '' : '· өшірулі'}</div></div></div></td><td>${esc(a.room ? a.room.name : '')}</td>
          <td class="r">${fmt(a.power)}</td><td class="r">${fmt(a.voltage)}</td><td class="r">${fmt(a.current(), 2)}</td><td class="r">${fmt(a.hoursPerDay)}</td><td class="r">${fmt(a.dailyKwh(), 3)}</td><td class="r">${fmt(a.monthlyCost(set.tariff), 0)}</td></tr>`).join('')
        : `<tr><td colspan="8">${emptyHTML('plug', 'Қосулы құрал жоқ', 'Есептеу үшін «Менің пәтерім» бетінде құралдарды розеткаға қосыңыз.')}</td></tr>`;
      $('[data-foot]', root).innerHTML = list.length ? `<tr><td>Барлығы: ${list.length} құрал</td><td></td><td class="r">${fmt(sum((a) => a.power))}</td><td class="r">—</td><td class="r">${fmt(sum((a) => a.current()), 2)}</td><td class="r">—</td><td class="r">${fmt(sum((a) => a.dailyKwh()), 3)}</td><td class="r">${fmt(sum((a) => a.monthlyCost(set.tariff)), 0)}</td></tr>` : '';
      const jsCost = S.apt.monthlyCost();
      const ok = Math.abs(jsCost - t.costMonth) < 0.05 && Math.abs(S.apt.totalPower() - t.power) < 0.01;
      $('[data-verify]', root).innerHTML = `<span class="verify" style="color:${ok ? 'var(--ok)' : 'var(--danger)'}">${ic(ok ? 'ok' : 'warn')}Сервер (Python: Apartment.monthly_cost) = ${fT(t.costMonth)} · Браузер (JS: Apartment.monthlyCost) = ${fT(jsCost)} ${ok ? '— сәйкес' : ''}</span>`;
      setGauge($('[data-gauge]', root), t.loadPct, `${fW(t.power, 0)} / ${fW(set.apartmentLimit, 0)}`);
      $('[data-pill]', root).innerHTML = statusPill(t.loadPct);
      $('[data-gnote]', root).innerHTML = `Пәтер автоматы: ${fW(set.apartmentLimit, 0)} ≈ 32 А × 220 В. Қазір жалпы ток <b>${fA(t.current)}</b>${t.current > 32 ? ' — 32 А-ден көп!' : ''}.`;
      const plugged = S.apt.plugged().slice().sort((a, b) => b.power - a.power);
      const total = Math.max(1, S.apt.totalPower());
      $('[data-share]', root).innerHTML = plugged.length ? plugged.map((a) => `<div class="hbar" title="${esc(a.name)}: ${fmt((a.power / total) * 100, 1)}%"><div class="top"><span>${esc(a.name)}</span><span class="num">${fmt((a.power / total) * 100, 1)}%</span></div><div class="track"><i class="fill" data-w="${(a.power / total) * 100}"></i></div></div>`).join('') : '<p class="muted small">Қосулы құрал жоқ.</p>';
      requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', root).forEach((i) => { i.style.width = i.dataset.w + '%'; })));
      mini();
    };
    update();
    return { onState: update };
  }

  /* ======================= БЕТ: СҰРЫПТАУ (4-қадам) ======================= */
  function pageSort(root) {
    let by = store.get('sortBy', 'power'); let dir = store.get('sortDir', 'desc'); let plugged = false; let codeTab = 'python';
    const KEYS = [['power', 'Қуаты', 'bolt'], ['name', 'Атауы', 'edit'], ['energy', 'Энергия класы', 'leaf'], ['kwh', 'кВт·сағ / тәулік', 'clock']];
    root.innerHTML = `
      <div class="card"><div class="row between">
        <div class="row"><div class="seg" data-by>${KEYS.map(([k, l, i]) => `<button type="button" data-k="${k}" class="${k === by ? 'active' : ''}">${ic(i)}${l}</button>`).join('')}</div>
          <div class="seg" data-dir><button type="button" data-d="asc" class="${dir === 'asc' ? 'active' : ''}">${ic('up')}Өсу</button><button type="button" data-d="desc" class="${dir === 'desc' ? 'active' : ''}">${ic('down')}Кему</button></div></div>
        <label class="check"><span class="switch"><input type="checkbox" data-pl><span class="track"></span></span>Тек қосулылар</label>
      </div></div>
      <div class="grid g-side">
        <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('sort')}</span><span data-title>Рейтинг</span></h3><span class="muted small" data-meta></span></div><div class="rank-list" data-list></div></div>
        <div class="stack" style="gap:20px">
          <div class="card"><div class="card-head"><h3><span class="ic">${ic('code')}</span>Сұрыптау коды</h3></div>
            <div class="seg" data-tabs>${['python', 'java', 'sql', 'js'].map((t) => `<button type="button" data-t="${t}" class="${t === codeTab ? 'active' : ''}">${{ python: 'Python', java: 'Java', sql: 'SQL', js: 'JavaScript' }[t]}</button>`).join('')}</div>
            <pre class="code" data-code style="margin-top:12px"></pre>
            <p class="muted small" style="margin-top:10px">Сұрыптау серверде <span class="mono">Apartment.sorted_by()</span> әдісімен — Python объектілері мен key-функция арқылы орындалады.</p></div>
          <div class="card"><div class="card-head"><h3><span class="ic">${ic('info')}</span>Түсіндірме</h3></div><p class="small muted" data-explain></p></div>
        </div>
      </div>`;
    let last = null;
    const jsCode = () => {
      const [a, b] = dir === 'desc' ? ['b', 'a'] : ['a', 'b'];
      return { power: `apartment.appliances.sort((a, b) => ${a}.power - ${b}.power);`, name: `apartment.appliances.sort((a, b) => ${a}.name.localeCompare(${b}.name, 'kk'));`, energy: `apartment.appliances.sort((a, b) =>\n    ENERGY_CLASSES.indexOf(${a}.energyClass) - ENERGY_CLASSES.indexOf(${b}.energyClass));`, kwh: `apartment.appliances.sort((a, b) => ${a}.dailyKwh() - ${b}.dailyKwh());` }[by];
    };
    const showCode = () => { if (last) $('[data-code]', root).innerHTML = hl(codeTab === 'js' ? jsCode() : last.code[codeTab]); };
    const load = async () => {
      try {
        const d = await api(`sort?by=${by}&dir=${dir}&plugged=${plugged ? 1 : 0}`);
        last = d;
        $('[data-title]', root).textContent = `${d.label} бойынша · ${dir === 'asc' ? 'өсу ретімен' : 'кему ретімен'}`;
        $('[data-meta]', root).textContent = `${d.items.length} құрал · ${fmt(d.ms, 3)} мс`;
        renderList(d.items);
        showCode();
        $('[data-explain]', root).innerHTML = {
          power: 'Негізгі тапсырма: құралдар <b>қуаты P (Вт)</b> бойынша салыстырылады. Бірдей қуатта атауы бойынша реттеледі.',
          name: 'Атауы бойынша әліпби ретімен (регистрге тәуелсіз). Жолақ ұзындығы — қуат.',
          energy: 'Энергия класы: A+++ (ең үнемді) → D (ең көп тұтынатын). Жолақ — класс үнемділігі.',
          kwh: 'Тәуліктік энергия E = P · t / 1000. Аз қуатты, бірақ ұзақ істейтін тоңазытқыш шәйнектен көп тұтынуы мүмкін!',
        }[by];
      } catch (e) { toast('Қате', e.message, 'error'); }
    };
    const metric = (a) => (by === 'kwh' ? a.dailyKwh : by === 'energy' ? 7 - E.ENERGY_CLASSES.indexOf(a.energyClass) : a.power);
    const valueText = (a) => (by === 'kwh' ? fKwh(a.dailyKwh) : by === 'energy' ? `${eclass(a.energyClass)} <span class="muted">${fW(a.power, 0)}</span>` : fW(a.power, 0));
    const renderList = (items) => {
      const list = $('[data-list]', root);
      if (!items.length) { list.innerHTML = emptyHTML('sort', 'Сұрыптайтын құрал жоқ', plugged ? 'Қосулы құрал жоқ — «Тек қосулылар» сүзгісін алып тастаңыз.' : 'Пәтерге құрал қосыңыз.'); return; }
      const first = new Map($$('.rank', list).map((r) => [r.dataset.id, r.getBoundingClientRect().top]));
      if (!first.size) list.innerHTML = '';
      const max = Math.max(...items.map(metric), 0.0001);
      const existing = new Map($$('.rank', list).map((r) => [r.dataset.id, r]));
      const keep = new Set();
      items.forEach((a, i) => {
        const id = String(a.id); keep.add(id);
        let row = existing.get(id);
        if (!row) { row = el(`<div class="rank" data-id="${id}"><span class="pos"></span>${thumb(a)}<div class="nm"><b>${esc(a.name)}</b><span>${esc(a.kz)} · ${esc(a.room || '')}</span></div><div class="barwrap"><span class="bar"></span><span class="val"></span></div></div>`); }
        row.classList.toggle('on', a.pluggedIn);
        $('.pos', row).textContent = i + 1;
        $('.val', row).innerHTML = valueText(a);
        row.dataset.w = Math.max(2, (metric(a) / max) * 78);
        list.append(row);
      });
      existing.forEach((r, id) => { if (!keep.has(id)) r.remove(); });
      $$('.rank', list).forEach((row) => {
        const old = first.get(row.dataset.id);
        const now = row.getBoundingClientRect().top;
        if (old !== undefined && old !== now) {
          row.style.transition = 'none'; row.style.transform = `translateY(${old - now}px)`;
          requestAnimationFrame(() => requestAnimationFrame(() => { row.style.transition = 'transform .7s var(--ease)'; row.style.transform = ''; }));
        } else if (old === undefined) { row.style.animation = 'rise .5s var(--ease) both'; }
      });
      requestAnimationFrame(() => requestAnimationFrame(() => $$('.rank', list).forEach((r) => { $('.bar', r).style.width = r.dataset.w + '%'; })));
    };
    $$('[data-k]', root).forEach((b) => b.addEventListener('click', () => { by = b.dataset.k; store.set('sortBy', by); $$('[data-k]', root).forEach((x) => x.classList.toggle('active', x === b)); load(); }));
    $$('[data-d]', root).forEach((b) => b.addEventListener('click', () => { dir = b.dataset.d; store.set('sortDir', dir); $$('[data-d]', root).forEach((x) => x.classList.toggle('active', x === b)); load(); }));
    $('[data-pl]', root).onchange = (e) => { plugged = e.target.checked; load(); };
    $$('[data-t]', root).forEach((b) => b.addEventListener('click', () => { codeTab = b.dataset.t; $$('[data-t]', root).forEach((x) => x.classList.toggle('active', x === b)); showCode(); }));
    load();
    return { onState: load };
  }

  /* ======================= БЕТ: ІЗДЕУ (5-қадам) ======================= */
  const RANGES = [
    { key: 'power', label: 'Қуаты P', unit: 'Вт', min: 0, max: 5000, step: 10 },
    { key: 'voltage', label: 'Кернеуі U', unit: 'В', min: 0, max: 400, step: 5 },
    { key: 'weight', label: 'Салмағы', unit: 'кг', min: 0, max: 100, step: 0.5 },
    { key: 'hours', label: 'Тәулігіне жұмыс t', unit: 'сағ', min: 0, max: 24, step: 0.5 },
  ];
  const PRESETS = [
    ['Қуатты: 1000–2500 Вт', { power: [1000, 2500] }],
    ['Аз қуатты: ≤ 200 Вт', { power: [0, 200] }],
    ['Ұзақ жұмыс: ≥ 5 сағ', { hours: [5, 24] }],
    ['Ауыр: ≥ 10 кг', { weight: [10, 100] }],
    ['Үнемді: A+ және жоғары', { classes: ['A+++', 'A++', 'A+'] }],
    ['Тек қосулылар', { plugged: true }],
  ];
  function pageSearch(root) {
    let classes = new Set(); let showFilled = false; let last = null;
    root.innerHTML = `
      <div class="grid g-side">
        <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('filter')}</span>Іздеу параметрлері</h3><button class="btn btn-sm btn-ghost" data-reset>${ic('reset')}Тазарту</button></div>
          <form class="form" data-form novalidate>
            <div class="chips" data-presets>${PRESETS.map(([l], i) => `<button type="button" class="chip" data-p="${i}">${ic('bolt')}${l}</button>`).join('')}</div>
            <div class="range-grid">${RANGES.map((r) => `<div class="range" data-range="${r.key}">
                <div class="lbl">${r.label} <span>${r.unit}</span></div>
                <div class="dual"><span class="rt"></span><span class="rf"></span><input type="range" data-lo min="${r.min}" max="${r.max}" step="${r.step}" value="${r.min}" aria-label="${r.label} минимум"><input type="range" data-hi min="${r.min}" max="${r.max}" step="${r.step}" value="${r.max}" aria-label="${r.label} максимум"></div>
                <div class="mm"><input type="number" name="${r.key}_min" value="${r.min}" step="any" aria-label="min"><span class="muted">—</span><input type="number" name="${r.key}_max" value="${r.max}" step="any" aria-label="max"></div></div>`).join('')}</div>
            <div class="field"><span>Энергия класы</span><div class="chips" data-classes>${E.ENERGY_CLASSES.map((c) => `<button type="button" class="chip" data-c="${c}">${eclass(c)}</button>`).join('')}</div></div>
            <div class="field-row">
              <label class="field"><span>Санат (класс)</span><select name="group"><option value="">Кез келген</option>${E.GROUP_CLASSES.map((G) => `<option value="${G.name}">${esc(G.KZ)}</option>`).join('')}</select></label>
              <label class="field"><span>Бөлме</span><select name="room"><option value="">Кез келген</option>${S.state.rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Атауы немесе бренді</span><input name="q" type="search" placeholder="мысалы: Samsung"></label>
              <label class="check" style="align-self:end;height:44px"><span class="switch"><input type="checkbox" name="plugged"><span class="track"></span></span>Тек розеткаға қосулылар</label>
            </div>
            <button class="btn btn-primary btn-block" type="submit">${ic('search')}Іздеу</button>
          </form></div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('db')}</span>Орындалған SQL</h3><label class="check small"><span class="switch"><input type="checkbox" data-filled><span class="track"></span></span>Мәндерімен</label></div>
          <div class="sql-box"><pre class="code" data-sql>…</pre><div class="params" data-params></div>
          <p class="muted small">${ic('shield').replace('<svg ', '<svg style="width:14px;height:14px;vertical-align:-2px;color:var(--ok)" ')} Барлық мәндер <b>?</b> параметрлері арқылы жіберіледі (sqlite3 параметрленген сұраныс) — SQL injection мүмкін емес. Аралықтар <span class="mono">BETWEEN ? AND ?</span> арқылы тексеріледі.</p></div></div>
      </div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('search')}</span>Нәтижелер</h3><div class="result-meta" data-rmeta></div></div><div data-results></div></div>`;
    const form = $('[data-form]', root);
    const syncRange = (box) => {
      const lo = $('[data-lo]', box); const hi = $('[data-hi]', box);
      const min = +lo.min; const max = +lo.max;
      const a = Math.min(+lo.value, +hi.value); const b = Math.max(+lo.value, +hi.value);
      const rf = $('.rf', box); rf.style.left = ((a - min) / (max - min)) * 100 + '%'; rf.style.right = (100 - ((b - min) / (max - min)) * 100) + '%';
    };
    $$('[data-range]', root).forEach((box) => {
      const key = box.dataset.range;
      const lo = $('[data-lo]', box); const hi = $('[data-hi]', box);
      const nlo = form[key + '_min']; const nhi = form[key + '_max'];
      const fromSlider = () => {
        if (+lo.value > +hi.value) { if (document.activeElement === lo) lo.value = hi.value; else hi.value = lo.value; }
        nlo.value = lo.value; nhi.value = hi.value; syncRange(box); run();
      };
      lo.addEventListener('input', fromSlider); hi.addEventListener('input', fromSlider);
      const fromNum = () => { lo.value = nlo.value || lo.min; hi.value = nhi.value || hi.max; syncRange(box); run(); };
      nlo.addEventListener('input', fromNum); nhi.addEventListener('input', fromNum);
      syncRange(box);
    });
    $$('[data-c]', root).forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.c; if (classes.has(c)) classes.delete(c); else classes.add(c);
      b.classList.toggle('active', classes.has(c)); run();
    }));
    ['group', 'room', 'plugged'].forEach((n) => form[n].addEventListener('change', () => run()));
    form.q.addEventListener('input', () => run());
    const reset = () => {
      RANGES.forEach((r) => { form[r.key + '_min'].value = r.min; form[r.key + '_max'].value = r.max; const box = $(`[data-range="${r.key}"]`, root); $('[data-lo]', box).value = r.min; $('[data-hi]', box).value = r.max; syncRange(box); });
      classes = new Set(); $$('[data-c]', root).forEach((b) => b.classList.remove('active'));
      form.group.value = ''; form.room.value = ''; form.q.value = ''; form.plugged.checked = false;
      $$('[data-p]', root).forEach((b) => b.classList.remove('active'));
    };
    $('[data-reset]', root).onclick = () => { reset(); run(true); };
    $$('[data-p]', root).forEach((b) => b.addEventListener('click', () => {
      reset();
      const p = PRESETS[+b.dataset.p][1];
      RANGES.forEach((r) => { if (p[r.key]) { form[r.key + '_min'].value = p[r.key][0]; form[r.key + '_max'].value = p[r.key][1]; const box = $(`[data-range="${r.key}"]`, root); $('[data-lo]', box).value = p[r.key][0]; $('[data-hi]', box).value = p[r.key][1]; syncRange(box); } });
      if (p.classes) p.classes.forEach((c) => { classes.add(c); $(`[data-c="${c}"]`, root).classList.add('active'); });
      if (p.plugged) form.plugged.checked = true;
      b.classList.add('active'); run(true);
    }));
    $('[data-filled]', root).onchange = (e) => { showFilled = e.target.checked; renderSql(); };
    const renderSql = () => {
      if (!last) return;
      let sql = last.sql;
      if (showFilled) { let i = 0; sql = sql.replace(/\?/g, () => { const v = last.params[i++]; return typeof v === 'string' ? `'${v}'` : String(v); }); }
      $('[data-sql]', root).innerHTML = hl(sql);
      $('[data-params]', root).innerHTML = last.params.map((v, i) => `<code>?${i + 1} = ${esc(typeof v === 'string' ? `'${v}'` : fmt(v, 2).replace(/ /g, ''))}${i === 0 ? ' (user_id)' : ''}</code>`).join('');
    };
    const doRun = async () => {
      const fd = new FormData(form);
      const qs = new URLSearchParams();
      RANGES.forEach((r) => { qs.set(r.key + '_min', fd.get(r.key + '_min')); qs.set(r.key + '_max', fd.get(r.key + '_max')); });
      if (classes.size) qs.set('classes', [...classes].join(','));
      if (fd.get('group')) qs.set('group', fd.get('group'));
      if (fd.get('room')) qs.set('room', fd.get('room'));
      if (form.plugged.checked) qs.set('plugged', '1');
      if (fd.get('q').trim()) qs.set('q', fd.get('q').trim());
      try {
        const d = await api('search?' + qs.toString());
        last = d; renderSql();
        $('[data-rmeta]', root).innerHTML = `<span class="badge ${d.count ? 'on' : 'off'}">Табылды: ${d.count}</span><span class="muted small">${S.apt.appliances.length} құралдың ішінен · ${fmt(d.ms, 3)} мс</span>`;
        $('[data-results]', root).innerHTML = d.items.length ? `<div class="table-wrap"><table><thead><tr><th>Құрал</th><th>Түрі</th><th>Бөлме</th><th class="r">P, Вт</th><th class="r">U, В</th><th class="r">Салмақ, кг</th><th class="r">t, сағ</th><th>Класс</th><th>Күйі</th></tr></thead><tbody>
            ${d.items.map((a) => `<tr><td><div class="cell-app">${thumb(a)}<div><b>${esc(a.name)}</b><div class="muted tiny">${esc(a.brand)}</div></div></div></td><td>${esc(a.kz)}<div class="muted tiny mono">${a.className}</div></td><td>${esc(a.room)}</td><td class="r"><b>${fmt(a.power)}</b></td><td class="r">${fmt(a.voltage)}</td><td class="r">${fmt(a.weight)}</td><td class="r">${fmt(a.hoursPerDay)}</td><td>${eclass(a.energyClass)}</td><td>${a.pluggedIn ? `<span class="badge on">${ic('plug')}қосулы</span>` : '<span class="badge off">өшірулі</span>'}</td></tr>`).join('')}
          </tbody></table></div>` : emptyHTML('search', 'Сәйкес құрал табылмады', 'Аралықтарды кеңейтіп немесе сүзгілерді азайтып көріңіз.');
      } catch (e) {
        $('[data-rmeta]', root).innerHTML = `<span class="badge danger">${esc(e.message)}</span>`;
      }
    };
    const debounced = debounce(doRun, 250);
    function run(now) { if (now) doRun(); else debounced(); }
    form.addEventListener('submit', (e) => { e.preventDefault(); doRun(); });
    doRun();
    return { onState: doRun };
  }

  /* ======================= БЕТ: 3D ПӘТЕР ======================= */
  function pageMap(root) {
    return window.ApartmentAtlas.open(root, { user: S.user, api, pageThree, setState, ownState: () => S.state, fW, fKwh, ic });
  }

  function pageThree(root, inspection = null) {
    const view = inspection
      ? { state: inspection, apt: new E.Apartment(inspection.rooms, inspection.appliances, inspection.settings) } : S;
    root.innerHTML = `
      <div class="row between"><a class="btn btn-sm" href="#/map" data-back-map>${ic('building')}Картаға оралу</a></div>
      <div class="stage" data-stage>
        <div class="hud"><div class="glass"><div class="muted tiny">Жалпы қуат · <span data-hud-count></span></div><div class="big" data-hud-power>—</div><div class="load"><i data-hud-load></i></div><div class="tiny muted" data-hud-sub style="margin-top:4px"></div></div></div>
        <div class="hud-controls">
          <button class="icon-btn" data-c="reset" title="Көріністі қалпына келтіру" aria-label="Қалпына келтіру">${ic('reset')}</button>
          <button class="icon-btn" data-c="top" title="Жоғарыдан көру" aria-label="Жоғарыдан">${ic('layers')}</button>
          <button class="icon-btn" data-c="spin" title="Автоматты айналу" aria-label="Айналу">${ic('orbit')}</button>
          <button class="icon-btn" data-c="full" title="Толық экран" aria-label="Толық экран">${ic('maximize')}</button>
        </div>
        <div class="hud-help">${ic('cube').replace('<svg ', '<svg style="width:14px;height:14px;vertical-align:-2px" ')} Сүйреп айналдырыңыз · дөңгелекшемен / екі саусақпен масштабтаңыз · құралды басыңыз</div>
      </div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('building')}</span>Бөлмелер мен құралдар</h3><span class="legend"><span><i style="background:var(--accent);box-shadow:0 0 8px var(--accent)"></i>розеткаға қосулы (жарқырайды, ток ағады)</span><span><i style="background:#64748b"></i>өшірулі</span><span><i style="background:#ef4444"></i>шамадан тыс жүктеме</span></span></div>
        <div class="grid g4" data-rooms></div>
        ${inspection ? '' : '<button class="btn btn-sm" data-add-in-model style="margin-top:14px">Құрал қосу</button>'}</div>`;
    const addInModel = $('[data-add-in-model]', root);
    if (addInModel) addInModel.onclick = () => openAddModal();
    if (root.closest('[data-atlas-model]')) $('[data-back-map]', root).parentElement.remove();
    const stage = $('[data-stage]', root);
    let scene = null; let selectedId = null; let planRender = null;
    const hud = () => {
      const t = view.state.totals; const set = view.state.settings;
      $('[data-hud-power]', root).textContent = fW(t.power, 0);
      $('[data-hud-power]', root).style.color = t.apartmentOverload ? 'var(--danger)' : '';
      $('[data-hud-load]', root).style.width = Math.min(100, t.loadPct) + '%';
      $('[data-hud-count]', root).textContent = `${t.plugged} құрал қосулы`;
      $('[data-hud-sub]', root).textContent = `${fmt(t.loadPct, 0)}% · шегі ${fW(set.apartmentLimit, 0)} · ${fKwh(t.kwhDay)}/тәул.`;
    };
    const roomsList = () => {
      $('[data-rooms]', root).innerHTML = view.apt.rooms.map((r) => {
        const rs = view.state.rooms.find((x) => x.id === r.id);
        return `<div class="stack" style="gap:8px"><div class="row" style="gap:8px">${ic(roomIcon(r.name)).replace('<svg ', '<svg style="width:18px;height:18px;color:var(--accent)" ')}<b>${esc(r.name)}</b>${socketsHTML(r.usedSockets(), r.sockets)}</div>
          <span class="small ${rs.overload ? '' : 'muted'}" style="${rs.overload ? 'color:var(--danger);font-weight:700' : ''}">${fW(r.power(), 0)} / ${fW(view.state.settings.roomLimit, 0)}</span>
          <div class="chips">${r.appliances.map((a) => `<button class="chip ${a.pluggedIn ? 'active' : ''}" data-sel="${a.id}" title="${esc(a.name)}">${ic(TYPE_ICON[a.type])}${esc(a.kz)}</button>`).join('') || '<span class="muted small">құрал жоқ</span>'}</div></div>`;
      }).join('');
      $$('[data-sel]', root).forEach((b) => b.addEventListener('click', () => { if (scene) scene.select(+b.dataset.sel); else showInfo(+b.dataset.sel); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    };
    const showInfo = (id) => {
      selectedId = id;
      let box = $('.info3d', stage);
      if (!id) { if (box) box.remove(); return; }
      const a = view.apt.appliances.find((x) => x.id === id);
      if (!a) { if (box) box.remove(); return; }
      if (!box) { box = el('<div class="info3d glass"></div>'); stage.append(box); }
      const free = a.room ? a.room.freeSockets() : 0;
      box.innerHTML = `<button class="icon-btn x" aria-label="Жабу">${ic('x')}</button>
        ${a.image ? `<img src="media/${esc(a.image)}" alt="">` : ''}
        <div><b style="font-size:16px">${esc(a.name)}</b><div class="muted small">${esc(a.kz)} · <span class="mono">${a.constructor.name}</span> · ${esc(a.room ? a.room.name : '')}</div></div>
        <div class="kv"><span>Қуаты P</span><b>${fW(a.power)}</b><span>Ток I</span><b>${fA(a.current())}</b><span>Тәулігіне E</span><b>${fKwh(a.dailyKwh())}</b><span>Айына</span><b>${fT(a.monthlyCost(view.state.settings.tariff))}</b><span>Класс</span><b>${eclass(a.energyClass)}</b></div>
        <p class="small muted">${esc(a.describe())}</p>
        <button class="btn ${a.pluggedIn ? 'btn-danger' : 'btn-primary'}" data-toggle ${!a.pluggedIn && free <= 0 ? 'title="Бұл бөлмеде бос розетка жоқ"' : ''}>${ic(a.pluggedIn ? 'power' : 'plug')}${a.pluggedIn ? 'Розеткадан ажырату' : 'Розеткаға қосу'}</button>
        <span class="tiny muted">${a.room ? `«${esc(a.room.name)}»: бос розетка ${free} / ${a.room.sockets}` : ''}</span>`;
      $('.x', box).onclick = () => { if (scene) scene.select(null); showInfo(null); };
      if (inspection) { $('[data-toggle]', box).remove(); return; }
      $('[data-toggle]', box).onclick = async (e) => {
        const btn = e.currentTarget; btn.classList.add('loading');
        await togglePlug(a.id, !a.pluggedIn);
        btn.classList.remove('loading');
      };
    };
    const update = () => {
      hud(); roomsList();
      if (scene) scene.update(view.state);
      if (selectedId) showInfo(selectedId);
    };
    if (window.Scene3D) {
      scene = Scene3D.createApartment(stage, { state: view.state, onSelect: (id) => showInfo(id) });
    }
    if (!scene) {
      const fb = el(`<div class="fallback3d"><div class="banner" style="animation:none"><span class="ic">${ic('cube')}</span><div class="txt"><b>3D көрініс қолжетімсіз</b><p class="small">Браузеріңіз WebGL қолдамайды немесе ол өшірулі (немесе static/three.min.js табылмады). Төменде пәтердің 2D жоспары көрсетілген.</p></div></div><div class="plan2d" data-plan></div></div>`);
      stage.append(fb);
      $$('.hud-controls, .hud-help', stage).forEach((n) => n.remove());
      const renderPlan = () => {
        $('[data-plan]', fb).innerHTML = view.apt.rooms.map((r) => `<div class="rm"><h4>${esc(r.name)} · ${fW(r.power(), 0)}</h4><div class="chips">${r.appliances.map((a) => `<button class="chip ${a.pluggedIn ? 'active' : ''}" data-sel2="${a.id}">${ic(a.pluggedIn ? 'plug' : 'power')}${esc(a.name)}</button>`).join('')}</div></div>`).join('');
        $$('[data-sel2]', fb).forEach((b) => b.addEventListener('click', () => showInfo(+b.dataset.sel2)));
      };
      renderPlan();
      planRender = renderPlan;
    }
    $$('[data-c]', stage).forEach((b) => b.addEventListener('click', () => {
      if (!scene) return;
      const c = b.dataset.c;
      if (c === 'reset') scene.resetView();
      if (c === 'top') scene.topView();
      if (c === 'spin') b.classList.toggle('active', scene.toggleAutoRotate());
      if (c === 'full') {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => toast('Толық экран', 'Браузер толық экранға рұқсат бермеді.', 'info'));
      }
    }));
    hud(); roomsList();
    const pre = !inspection && +store.get('select3d', '0');
    if (pre && scene) { store.set('select3d', '0'); setTimeout(() => scene && scene.select(pre), 600); }
    return {
      onState() { update(); if (planRender) planRender(); },
      destroy() { if (scene) scene.dispose(); scene = null; },
    };
  }

  /* ======================= БЕТ: МЕДИА ======================= */
  const TIPS = [
    ['plug', 'Қолданбаған құралды ажыратыңыз', 'Күту режиміндегі (standby) теледидар мен компьютер жылына ондаған кВт·сағ «жасырын» тұтынады.'],
    ['leaf', 'A+++ класын таңдаңыз', 'A+++ тоңазытқыш D класты құралдан 2–3 есе аз энергия жұмсайды — бұл айлық төлемде анық көрінеді.'],
    ['bulb', 'LED шамға ауысыңыз', '10 Вт LED шам 60–75 Вт қыздыру шамымен бірдей жарық береді (≈ 806 лм).'],
    ['flame', 'Шәйнекке қажетті суды ғана құйыңыз', '2 200 Вт шәйнек 1,7 л-ді 4 минутта қайнатады. Артық су — артық кВт·сағ.'],
    ['thermo', 'Жылытқышты бағдарламалаңыз', 'Майлы жылытқыш 2 000 Вт — бөлмеде ешкім жоқта өшіріп қойыңыз.'],
    ['warn', 'Қуатты құралдарды бір мезгілде қоспаңыз', 'Шәйнек + кір жуғыш + жылытқыш = 6 200 Вт: пәтер автоматы (32 А) шегіне жақындайды.'],
    ['wind', 'Кондиционер температурасы 24–26 °C', 'Әр 1 °C төмен температура энергия шығынын шамамен 6–8 %-ға арттырады.'],
    ['drop', 'Кірді толық жүктемемен жуыңыз', 'Жартылай жүктелген машина бір жуғанда толық жүктемедегідей энергия жұмсайды.'],
  ];
  function pageMedia(root) {
    root.innerHTML = `
      <div class="hero-card" style="background-image:linear-gradient(110deg, color-mix(in srgb, var(--bg) 88%, transparent) 20%, color-mix(in srgb, var(--bg) 30%, transparent)), url('media/hero.jpg');background-size:cover;background-position:center">
        <p class="muted small">Медиа</p><h2>Электр құралдары: <span class="grad-text">видео мен суреттер</span></h2>
        <p>Барлық суреттер Wikimedia Commons-тан (ашық лицензиялар), видеолар Mixkit-тен алынды. Авторлары әр суреттің астында және <span class="mono">IMAGE_SOURCES.txt</span> файлында көрсетілген.</p></div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('bolt')}</span>Android қосымшасы</h3><a class="btn" href="media/electroui.apk" download="ElectroUi.apk">APK жүктеп алу</a></div>
        <p class="muted small">Дәл осы тапсырманың Android нұсқасы (Java, SQLite, фрагменттер, бүйірлік мәзір, 3D пәтер). Android 8.0 және жоғары. Аккаунттар сайттағыдай: admin / Admin123!, aru / Aru12345!</p></div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('video')}</span>Видеолар</h3></div><div class="video-grid" data-videos><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div></div></div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('image')}</span>Фотогалерея</h3><span class="muted small">Суретті басып үлкейтіңіз</span></div><div class="gallery" data-gallery></div></div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('leaf')}</span>Энергия үнемдеу кеңестері</h3></div>
        <div class="tips">${TIPS.map(([i, t, d]) => `<div class="tip"><span class="ic">${ic(i)}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div></div>`;
    const missing = (v) => `<img src="media/${esc(v.poster)}" alt=""><div class="missing">${ic('video')}<b>Видео әлі қосылмаған</b><small>Файлды <span class="mono">media/${esc(v.file)}</span> ретінде салыңыз — бет автоматты түрде ойнатады.</small></div>`;
    api('media').then((d) => {
      const vbox = $('[data-videos]', root);
      vbox.innerHTML = d.videos.map((v, i) => `<div class="video-card"><div class="vbox" data-v="${i}">${v.available
        ? `<video controls preload="metadata" playsinline muted loop poster="media/${esc(v.poster)}" src="media/${esc(v.file)}"></video>` : missing(v)}</div>
        <div class="cap"><b>${esc(v.caption)}</b><span class="attr">${attribution(v)}</span></div></div>`).join('');
      $$('video', vbox).forEach((vid) => vid.addEventListener('error', () => {
        const i = +vid.closest('[data-v]').dataset.v; vid.closest('.vbox').innerHTML = missing(d.videos[i]);
      }));
      const imgs = d.images.filter((x) => x.available);
      $('[data-gallery]', root).innerHTML = imgs.map((im, i) => `<button class="gal" data-i="${i}"><img src="media/${esc(im.file)}" alt="${esc(im.caption)}" loading="lazy"><span class="gc">${esc(im.caption)}</span></button>`).join('');
      $$('.gal', root).forEach((b) => b.addEventListener('click', () => lightbox(imgs, +b.dataset.i)));
    }).catch((e) => { $('[data-videos]', root).innerHTML = `<p class="muted">${esc(e.message)}</p>`; });
    return { destroy() { $$('video', root).forEach((v) => { try { v.pause(); } catch (e) { /* */ } }); } };
  }

  /* ======================= БЕТ: ХАБАРЛАМАЛАР ======================= */
  function pageNotifications(root) {
    let tab = location.hash.includes('tab=events') ? 'events' : 'notifs'; let filter = 'all';
    root.innerHTML = `
      <div class="card"><div class="row between">
        <div class="seg" data-tabs><button type="button" data-t="notifs">${ic('bell')}Хабарламалар</button><button type="button" data-t="events">${ic('activity')}Оқиғалар тарихы</button></div>
        <div class="row" data-perm></div></div></div>
      <div class="card" data-body></div>`;
    const perm = () => {
      const box = $('[data-perm]', root);
      if (!('Notification' in window)) { box.innerHTML = '<span class="muted small">Браузер хабарламалары қолдау таппайды</span>'; return; }
      const p = Notification.permission;
      box.innerHTML = p === 'granted' ? `<span class="badge on">${ic('check')}Браузер хабарламалары қосулы</span><button class="btn btn-sm" data-test>${ic('bell')}Тексеру</button>`
        : p === 'denied' ? `<span class="badge danger">${ic('ban')}Браузер хабарламаларына тыйым салынған</span>`
          : `<button class="btn btn-sm btn-primary" data-ask>${ic('bell')}Браузер хабарламаларын қосу</button>`;
      const ask = $('[data-ask]', box);
      if (ask) ask.onclick = async () => { try { await Notification.requestPermission(); } catch (e) { /* */ } perm(); };
      const test = $('[data-test]', box);
      if (test) test.onclick = () => { try { new Notification('ЭлектроҮй', { body: 'Браузер хабарламалары жұмыс істейді!', icon: 'static/icon.svg' }); } catch (e) { toast('Қате', 'Бұл браузерде хабарлама көрсету мүмкін емес.', 'error'); } };
    };
    const render = async () => {
      $$('[data-t]', root).forEach((b) => b.classList.toggle('active', b.dataset.t === tab));
      const body = $('[data-body]', root);
      if (tab === 'events') {
        body.innerHTML = '<div class="skeleton" style="height:300px"></div>';
        const d = await api('events');
        body.innerHTML = `<div class="card-head"><h3><span class="ic">${ic('activity')}</span>Оқиғалар тарихы (events кестесі)</h3><span class="muted small">соңғы ${d.items.length}</span></div>
          <div class="events">${d.items.length ? d.items.map(eventHTML).join('') : emptyHTML('activity', 'Оқиға жоқ', 'Құралды қосу/ажырату тарихы осында жазылады')}</div>`;
        return;
      }
      const items = S.notifs.filter((n) => filter === 'all' || (filter === 'unread' && !n.is_read) || n.kind === filter);
      body.innerHTML = `<div class="card-head"><div class="chips">${[['all', 'Барлығы'], ['unread', `Оқылмаған (${S.unread})`], ['WARNING', 'Ескертулер'], ['BROADCAST', 'Әкімшіден'], ['SUCCESS', 'Сәтті'], ['INFO', 'Ақпарат']].map(([k, l]) => `<button class="chip ${k === filter ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
          <div class="row"><button class="btn btn-sm" data-readall ${S.unread ? '' : 'disabled'}>${ic('check')}Барлығын оқу</button><button class="btn btn-sm btn-ghost" data-clear>${ic('trash')}Оқылғандарды өшіру</button></div></div>
        <div class="notif-list">${items.length ? items.map((n) => notifHTML(n)).join('') : emptyHTML('bell', 'Хабарлама жоқ', 'Шектен асу ескертулері мен әкімші хабарламалары осында келеді')}</div>`;
      $$('[data-f]', body).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
      const upd = (d) => { S.notifs = d.items; S.unread = d.unread; renderBell(); render(); };
      $('[data-readall]', body).onclick = async () => upd(await api('notif_read', { all: true }));
      $('[data-clear]', body).onclick = async () => upd(await api('notif_delete', { read: true }));
      $$('[data-read]', body).forEach((b) => b.addEventListener('click', async () => upd(await api('notif_read', { id: +b.dataset.read }))));
      $$('[data-del]', body).forEach((b) => b.addEventListener('click', async () => upd(await api('notif_delete', { id: +b.dataset.del }))));
    };
    $$('[data-t]', root).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; render(); }));
    perm(); render();
    return { refresh: render, onState() { if (tab === 'events') render(); } };
  }

  /* ======================= БЕТ: ПРОФИЛЬ ======================= */
  function pageProfile(root) {
    const u = S.user; const t = S.state.totals;
    root.innerHTML = `
      <div class="grid g-main">
        <div class="card glow"><div class="row" style="gap:20px;align-items:center">
            <span class="avatar avatar-xl">${esc(u.initials)}</span>
            <div style="min-width:0"><h2 style="font-size:24px">${esc(u.fullName)}</h2><p class="muted">@${esc(u.login)} · ${esc(u.email)}</p>
              <div class="row" style="margin-top:8px"><span class="badge ${u.role === 'ADMIN' ? 'admin' : 'client'}">${ic(u.role === 'ADMIN' ? 'crown' : 'user')}${u.role}</span><span class="badge">${ic('calendar')}Тіркелген: ${fDate(u.createdAt)}</span></div></div></div>
          <div class="stats" style="margin-top:18px">
            <div class="stat" style="padding:0"><span class="ic">${ic('box')}</span><div><div class="v">${t.count}</div><div class="l">құрал</div></div></div>
            <div class="stat" style="padding:0"><span class="ic volt">${ic('plug')}</span><div><div class="v">${t.plugged}</div><div class="l">қосулы</div></div></div>
            <div class="stat" style="padding:0"><span class="ic pink">${ic('tenge')}</span><div><div class="v">${fmt(t.costMonth, 0)}</div><div class="l">₸ / ай</div></div></div>
          </div>
          <form class="form" data-pf style="margin-top:18px"><div class="field-row">
            <label class="field"><span>Аты-жөні</span><input name="fullName" value="${esc(u.fullName)}" maxlength="60"></label>
            <label class="field"><span>Email</span><input name="email" type="email" value="${esc(u.email)}" maxlength="80"></label></div>
            <div class="form-error" hidden></div>
            <div class="row"><button class="btn btn-primary" type="submit">${ic('check')}Сақтау</button><button class="btn btn-ghost" type="button" data-logout>${ic('logout')}Жүйеден шығу</button></div></form>
        </div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('lock')}</span>Құпиясөзді өзгерту</h3></div>
          <form class="form" data-pw autocomplete="off">
            <label class="field"><span>Ағымдағы құпиясөз</span><span class="pw-wrap"><input name="old" type="password" autocomplete="current-password"><button type="button" class="pw-eye">${ic('eye')}</button></span></label>
            <label class="field"><span>Жаңа құпиясөз</span><span class="pw-wrap"><input name="new" type="password" autocomplete="new-password"><button type="button" class="pw-eye">${ic('eye')}</button></span>
              <span class="strength" data-meter><i></i><i></i><i></i><i></i></span><small class="hint" data-hint>Кемінде 8 таңба, бір әріп және бір цифр</small></label>
            <label class="field"><span>Жаңа құпиясөзді қайталаңыз</span><input name="confirm" type="password" autocomplete="new-password"></label>
            <div class="form-error" hidden></div>
            <button class="btn btn-primary" type="submit">${ic('shield')}Құпиясөзді жаңарту</button>
          </form>
          <div class="secure-note" style="margin-top:16px">${ic('shield')}<span>Ескі құпиясөз сервердегі хэшпен <span class="mono">hmac.compare_digest</span> арқылы салыстырылады, жаңасы жаңа 16 байттық тұзбен PBKDF2-HMAC-SHA256 (120 000 итерация) арқылы хэштеледі. Ашық мәтін ешқайда сақталмайды.</span></div>
        </div>
      </div>`;
    $$('.pw-eye', root).forEach((b) => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = ic(i.type === 'password' ? 'eye' : 'eyeOff'); }));
    $('[data-logout]', root).onclick = logout;
    $('[data-pf]', root).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      try { const r = await api('profile', { fullName: f.fullName.value, email: f.email.value }); S.user = r.user; S.state.me = r.user; renderChrome(); toast('Профиль сақталды', '', 'success', 2500); route(); } catch (err) { formError(f, err.message); }
    });
    const pw = $('[data-pw]', root);
    pw.new.addEventListener('input', () => updateStrength($('[data-meter]', pw), pw.new.value, $('[data-hint]', pw)));
    pw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', pw); btn.classList.add('loading');
      try {
        const r = await api('password', { old: pw.old.value, new: pw.new.value, confirm: pw.confirm.value });
        pw.reset(); $('[data-meter]', pw).dataset.level = '0';
        applyResult(r); pollNotifs(true);
      } catch (err) { formError(pw, err.message); } finally { btn.classList.remove('loading'); }
    });
    return {};
  }

  /* ======================= БЕТ: БАПТАУЛАР ======================= */
  function pageSettings(root) {
    const ACC = [['blue', 'Көк', '#3b82f6', '#22d3ee'], ['green', 'Жасыл', '#10b981', '#a3e635'], ['orange', 'Қызғылт сары', '#f97316', '#facc15'], ['purple', 'Күлгін', '#8b5cf6', '#ec4899']];
    const render = () => {
      root.innerHTML = `
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('sun')}</span>Тақырып</h3><span class="muted small">Таңдау осы браузерде сақталады</span></div>
          <div class="theme-opts">${[['light', 'Жарық', 'sun'], ['dark', 'Қараңғы', 'moon'], ['system', 'Жүйелік', 'monitor']].map(([k, l, i]) => `<button class="theme-opt ${Theme.mode === k ? 'active' : ''}" data-mode="${k}"><span class="pv ${k}"><i></i><i></i></span><b>${ic(i)}${l}</b></button>`).join('')}</div></div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('palette')}</span>Акцент түсі</h3></div>
          <div class="accents">${ACC.map(([k, l, a, b]) => `<button class="accent-opt ${Theme.accent === k ? 'active' : ''}" data-acc="${k}" style="color:${a}"><i style="background:linear-gradient(135deg, ${a}, ${b})">${ic('check')}</i><span>${l}</span></button>`).join('')}</div></div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('sliders')}</span>Интерфейс</h3></div>
          <div class="set-row"><div><b>Анимацияларды азайту</b><span>Өту анимациялары мен жыпылықтауларды өшіреді</span></div><span class="switch"><input type="checkbox" data-motion ${store.get('motion', 'on') === 'off' ? 'checked' : ''}><span class="track"></span></span></div>
          <div class="set-row"><div><b>Бүйірлік мәзірді жиюлы ұстау</b><span>Компьютерде тек белгішелер көрінеді</span></div><span class="switch"><input type="checkbox" data-coll ${$('#shell').classList.contains('collapsed') ? 'checked' : ''}><span class="track"></span></span></div>
          <div class="set-row"><div><b>Браузер хабарламалары</b><span>Шектен асу ескертулері мен әкімші хабарламалары жүйелік хабарлама ретінде</span></div><span data-np></span></div>
        </div>
        ${S.user.role === 'ADMIN' ? `<div class="card"><div class="row between"><div><b>Жүйе баптаулары (әкімші)</b><p class="muted small">Тариф, пәтер және бөлме желісінің шегі</p></div><a class="btn" href="#/admin-system">${ic('sliders')}Тариф пен лимит</a></div></div>` : ''}`;
      $$('[data-mode]', root).forEach((b) => b.addEventListener('click', () => { Theme.setMode(b.dataset.mode); render(); }));
      $$('[data-acc]', root).forEach((b) => b.addEventListener('click', () => { Theme.setAccent(b.dataset.acc); render(); }));
      $('[data-motion]', root).onchange = (e) => { store.set('motion', e.target.checked ? 'off' : 'on'); Theme.apply(); };
      $('[data-coll]', root).onchange = (e) => { $('#shell').classList.toggle('collapsed', e.target.checked); store.set('collapsed', e.target.checked ? '1' : '0'); };
      const np = $('[data-np]', root);
      if (!('Notification' in window)) np.innerHTML = '<span class="badge off">қолдау жоқ</span>';
      else if (Notification.permission === 'granted') np.innerHTML = `<span class="badge on">${ic('check')}қосулы</span>`;
      else if (Notification.permission === 'denied') np.innerHTML = '<span class="badge danger">тыйым салынған</span>';
      else { np.innerHTML = '<button class="btn btn-sm btn-primary">Рұқсат сұрау</button>'; $('button', np).onclick = async () => { try { await Notification.requestPermission(); } catch (e) { /* */ } render(); }; }
    };
    render();
    return {};
  }

  /* ======================= ӘКІМШІ: ПАЙДАЛАНУШЫЛАР ======================= */
  function pageAdminUsers(root) {
    let items = []; let q = '';
    root.innerHTML = `<div class="card"><div class="card-head"><h3><span class="ic">${ic('users')}</span>Барлық пайдаланушылар</h3>
        <input type="search" data-q placeholder="Логин, аты немесе email…" style="width:260px;height:38px"></div>
      <div data-table><div class="skeleton" style="height:200px"></div></div>
      <p class="muted small" style="margin-top:12px">${ic('shield').replace('<svg ', '<svg style="width:14px;height:14px;vertical-align:-2px" ')} Рөл серверде тексеріледі: CLIENT /api/admin/... сұрауына <b>403</b> алады. Өзіңізді жоя, бұғаттай немесе рөліңізді түсіре алмайсыз.</p></div>`;
    const render = () => {
      const list = items.filter((u) => !q || `${u.login} ${u.full_name} ${u.email}`.toLowerCase().includes(q));
      $('[data-table]', root).innerHTML = `<div class="table-wrap"><table><thead><tr><th>Пайдаланушы</th><th>Email</th><th>Рөлі</th><th>Күйі</th><th class="r">Құрал</th><th class="r">Қосулы, Вт</th><th>Тіркелген</th><th class="r">Әрекет</th></tr></thead><tbody>
        ${list.map((u) => {
          const self = u.id === S.user.id;
          const ini = u.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
          return `<tr data-id="${u.id}"><td><div class="user-cell"><span class="avatar">${esc(ini)}</span><div><b>${esc(u.full_name)}</b>${self ? ' <span class="badge client">сіз</span>' : ''}<div class="muted tiny">@${esc(u.login)}</div></div></div></td><td>${esc(u.email)}</td>
            <td><select data-role ${self ? 'disabled' : ''} style="height:34px;width:auto"><option ${u.role === 'CLIENT' ? 'selected' : ''}>CLIENT</option><option ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option></select></td>
            <td>${u.blocked ? `<span class="badge danger">${ic('lock')}бұғатталған</span>` : `<span class="badge on">${ic('check')}белсенді</span>`}</td>
            <td class="r">${u.appliances}</td><td class="r">${fmt(u.plugged_power)}</td><td class="muted small">${fDate(u.created_at)}</td>
            <td class="r"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><button class="btn btn-sm" data-block ${self ? 'disabled' : ''}>${ic(u.blocked ? 'unlock' : 'ban')}${u.blocked ? 'Ашу' : 'Бұғаттау'}</button><button class="btn btn-sm btn-ghost" data-del ${self ? 'disabled' : ''} title="Жою" aria-label="Жою" style="color:var(--danger)">${ic('trash')}</button></div></td></tr>`;
        }).join('')}</tbody></table></div>`;
      $$('tr[data-id]', root).forEach((tr) => {
        const id = +tr.dataset.id; const u = items.find((x) => x.id === id);
        const act = async (path, body, msg) => { try { const d = await api(path, body); items = d.items; render(); toast(msg, `@${u.login}`, 'success', 2500); } catch (e) { toast('Қате', e.message, 'error'); render(); } };
        $('[data-role]', tr).onchange = (e) => act('admin/role', { id, role: e.target.value }, `Рөл өзгертілді: ${e.target.value}`);
        $('[data-block]', tr).onclick = () => act('admin/block', { id, blocked: !u.blocked }, u.blocked ? 'Бұғаттан шығарылды' : 'Бұғатталды');
        $('[data-del]', tr).onclick = async () => { if (await confirmBox('Пайдаланушыны жою', `@${u.login} және оның пәтеріндегі барлық деректер (бөлмелер, құралдар, хабарламалар) біржола жойылады.`, 'Жою', true)) act('admin/user_delete', { id }, 'Пайдаланушы жойылды'); };
      });
    };
    $('[data-q]', root).oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
    api('admin/users').then((d) => { items = d.items; render(); }).catch((e) => { $('[data-table]', root).innerHTML = emptyHTML('ban', `Қате ${e.status || ''}`, e.message); });
    return {};
  }

  /* ======================= ӘКІМШІ: КАТАЛОГ ======================= */
  function pageAdminCatalog(root) {
    root.innerHTML = `<div class="card"><div class="row between"><div><b>Каталог үлгілері</b><p class="muted small">Клиенттер «Менің пәтерім» бетінде осы үлгілерден құрал қосады.</p></div><button class="btn btn-primary" data-add>${ic('plus')}Жаңа үлгі</button></div></div><div class="app-grid" data-grid><div class="skeleton" style="height:300px"></div><div class="skeleton" style="height:300px"></div><div class="skeleton" style="height:300px"></div></div>`;
    const render = (items) => {
      S.catalog = items;
      $('[data-grid]', root).innerHTML = items.length ? items.map((c) => `<article class="app-card on" data-id="${c.id}"><div class="media">${c.image ? `<img src="media/${esc(c.image)}" alt="" loading="lazy">` : `<div class="ph">${ic(TYPE_ICON[c.type])}</div>`}<span class="tag badge">${esc(c.name_kz)}</span></div>
          <div class="body"><div><h4>${esc(c.name)}</h4><div class="sub row" style="gap:6px">${esc(c.brand)} ${eclass(c.energy_class)} <span class="badge">${c.type}</span></div></div>
            <div class="kv"><span>Қуаты</span><b>${fW(c.power)}</b><span>Кернеуі</span><b>${fV(c.voltage)}</b><span>Салмағы</span><b>${fmt(c.weight)} кг</b><span>${esc(c.extra_label)}</span><b>${fmt(c.extra)} ${esc(c.extra_unit)}</b><span>Жұмыс t</span><b>${fmt(c.hours_per_day)} сағ</b></div>
            <div class="foot"><button class="btn btn-sm" data-edit>${ic('edit')}Өзгерту</button><button class="btn btn-sm btn-ghost" data-del style="color:var(--danger)">${ic('trash')}Жою</button></div></div></article>`).join('')
        : `<div class="card">${emptyHTML('box', 'Каталог бос', 'Жаңа үлгі қосыңыз')}</div>`;
      $$('.app-card', root).forEach((card) => {
        const c = items.find((x) => x.id === +card.dataset.id);
        $('[data-edit]', card).onclick = () => edit(c);
        $('[data-del]', card).onclick = async () => {
          if (!(await confirmBox('Үлгіні жою', `«${c.name}» каталогтан жойылады. Клиенттердің пәтеріндегі құралдар сақталады.`, 'Жою', true))) return;
          try { render((await api('admin/catalog_delete', { id: c.id })).items); toast('Үлгі жойылды', c.name, 'info'); } catch (e) { toast('Қате', e.message, 'error'); }
        };
      });
    };
    const edit = (c) => {
      const v = c ? { type: c.type, name: c.name, brand: c.brand, power: c.power, voltage: c.voltage, energyClass: c.energy_class, weight: c.weight, extra: c.extra, hoursPerDay: c.hours_per_day, image: c.image } : {};
      const f = applianceForm(v);
      modal({
        title: c ? `Үлгіні өзгерту: ${c.name}` : 'Жаңа каталог үлгісі', size: 'wide', body: f,
        actions: [{ label: 'Бас тарту', kind: 'ghost' }, {
          label: 'Сақтау', kind: 'primary', icon: 'check', onClick: async () => {
            try { render((await api('admin/catalog_save', { ...readApplianceForm(f), id: c ? c.id : undefined })).items); toast('Каталог жаңартылды', '', 'success', 2500); return true; } catch (e) { formError(f, e.message); return false; }
          },
        }],
      });
    };
    $('[data-add]', root).onclick = () => edit(null);
    loadCatalog(true).then(render).catch((e) => toast('Қате', e.message, 'error'));
    return {};
  }

  /* ======================= ӘКІМШІ: СТАТИСТИКА ======================= */
  function pageAdminStats(root) {
    root.innerHTML = '<div class="stats">' + '<div class="skeleton" style="height:90px"></div>'.repeat(4) + '</div><div class="skeleton" style="height:300px"></div>';
    api('admin/stats').then((d) => {
      const s = d.summary;
      const cat = d.reports[0];
      const pi = cat.columns.indexOf('жалпы_қуат_Вт');
      const cmax = Math.max(1, ...cat.rows.map((r) => r[pi] || 0));
      root.innerHTML = `
        <div class="stats">
          ${[['users', '', 'Пайдаланушылар', `${s.users}`, `${s.clients} клиент · ${s.blocked} бұғатталған`], ['box', 'info', 'Барлық құралдар', `${s.appliances}`, `${s.catalog} каталог үлгісі`], ['plug', 'volt', 'Қосулы құралдар', `${s.plugged}`, fW(s.plugged_power, 0)], ['activity', 'ok', 'Оқиғалар', `${s.events}`, 'events кестесінде']]
            .map(([i, c, l, v, sub]) => `<div class="card stat"><span class="ic ${c}">${ic(i)}</span><div><div class="v">${v}</div><div class="l">${l}</div><div class="tiny muted">${sub}</div></div></div>`).join('')}
        </div>
        <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('chart')}</span>Санаттар бойынша жалпы қуат (барлық пәтерлер)</h3></div>
          <div class="hbars">${cat.rows.map((r) => `<div class="hbar" title="${esc(r[0])}: ${fW(r[pi], 0)}"><div class="top"><b>${esc(r[0])}</b><span class="num">${fW(r[pi], 0)} <span class="muted tiny">· ${r[1]} құрал</span></span></div><div class="track"><i class="fill" data-w="${(r[pi] / cmax) * 100}"></i></div></div>`).join('')}</div></div>
        ${d.reports.map((rep, i) => `<div class="card report"><div class="card-head"><h3><span class="ic">${ic('db')}</span>${i + 1}. ${esc(rep.title)}</h3><span class="badge">${rep.rows.length} жол</span></div>
          <details ${i < 4 ? 'open' : ''}><summary>${ic('code').replace('<svg ', '<svg style="width:14px;height:14px" ')}SQL сұранысы</summary><pre class="code">${hl(rep.sql)}</pre></details>
          <div class="table-wrap"><table><thead><tr>${rep.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rep.rows.length ? rep.rows.map((r) => `<tr>${r.map((v) => `<td class="${typeof v === 'number' ? 'r' : ''}">${typeof v === 'number' ? fmt(v, 2) : esc(v ?? '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${rep.columns.length}" class="muted">Нәтиже жоқ</td></tr>`}</tbody></table></div></div>`).join('')}`;
      requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', root).forEach((i) => { i.style.width = i.dataset.w + '%'; })));
    }).catch((e) => { root.innerHTML = `<div class="card">${emptyHTML('ban', `Қате ${e.status || ''}`, e.message)}</div>`; });
    return {};
  }

  /* ======================= ӘКІМШІ: ХАБАРЛАМА ЖІБЕРУ ======================= */
  function pageAdminBroadcast(root) {
    root.innerHTML = `<div class="grid g2">
        <div class="card glow"><div class="card-head"><h3><span class="ic">${ic('megaphone')}</span>Барлық клиенттерге хабарлама</h3></div>
          <form class="form" data-f><label class="field"><span>Тақырыбы</span><input name="title" maxlength="80" placeholder="Мысалы: Ертең 10:00–12:00 жоспарлы жөндеу"></label>
            <label class="field"><span>Мәтіні</span><textarea name="body" maxlength="500" placeholder="Хабарлама мәтіні…"></textarea></label>
            <div class="form-error" hidden></div>
            <button class="btn btn-primary" type="submit">${ic('send')}Жіберу</button></form></div>
        <div class="card"><div class="card-head"><h3><span class="ic">${ic('eye')}</span>Алдын ала қарау</h3><span class="muted small" data-rc></span></div><div class="notif-list" data-prev></div>
          <p class="muted small" style="margin-top:12px">Клиенттер хабарламаны қоңыраушадан, тост ретінде және (рұқсат берсе) браузердің жүйелік хабарламасы ретінде көреді.</p></div>
      </div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('clock')}</span>Жіберілгендер тарихы</h3><span class="muted small mono">GROUP BY title, body, created_at</span></div><div data-hist></div></div>`;
    const f = $('[data-f]', root);
    const prev = () => { $('[data-prev]', root).innerHTML = notifHTML({ id: 0, kind: 'BROADCAST', title: f.title.value || 'Тақырып', body: f.body.value || 'Мәтін осында көрінеді', is_read: 0, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }, false); };
    f.addEventListener('input', prev); prev();
    const hist = (h) => {
      $('[data-hist]', root).innerHTML = h.length ? `<div class="table-wrap"><table><thead><tr><th>Тақырыбы</th><th>Мәтіні</th><th>Уақыты</th><th class="r">Алушылар</th><th class="r">Оқығандар</th></tr></thead><tbody>${h.map((x) => `<tr><td><b>${esc(x.title)}</b></td><td style="white-space:normal;min-width:220px">${esc(x.body)}</td><td>${fDate(x.created_at)}</td><td class="r">${x.recipients}</td><td class="r">${x.read_count}</td></tr>`).join('')}</tbody></table></div>` : emptyHTML('megaphone', 'Әзірге хабарлама жіберілмеген', 'Жоғарыдағы форма арқылы жіберіңіз');
    };
    api('admin/users').then((d) => { $('[data-rc]', root).textContent = `Алушылар: ${d.items.filter((u) => u.role === 'CLIENT' && !u.blocked).length} клиент`; }).catch(() => {});
    api('admin/broadcasts').then((d) => hist(d.history)).catch(() => {});
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', f); btn.classList.add('loading');
      try { const d = await api('admin/broadcast', { title: f.title.value, body: f.body.value }); toast('Хабарлама жіберілді', `${d.count} клиентке жеткізілді`, 'success'); f.reset(); prev(); hist(d.history); } catch (err) { formError(f, err.message); } finally { btn.classList.remove('loading'); }
    });
    return {};
  }

  /* ======================= ӘКІМШІ: ТАРИФ ПЕН ЛИМИТ ======================= */
  function pageAdminSystem(root) {
    root.innerHTML = `<div class="grid g2"><div class="card glow"><div class="card-head"><h3><span class="ic">${ic('sliders')}</span>Жүйелік баптаулар</h3></div>
        <form class="form" data-f><label class="field"><span>Электр энергиясының тарифі, ₸/кВт·сағ</span><input name="tariff" type="number" step="any" min="0.1"></label>
          <label class="field"><span>Пәтердің жалпы шегі, Вт</span><input name="apartmentLimit" type="number" step="any" min="500"><small class="hint" data-calc></small></label>
          <label class="field"><span>Бір бөлме желісінің шегі, Вт</span><input name="roomLimit" type="number" step="any" min="100"></label>
          <div class="form-error" hidden></div><button class="btn btn-primary" type="submit">${ic('check')}Сақтау</button></form></div>
      <div class="card"><div class="card-head"><h3><span class="ic">${ic('info')}</span>Түсіндірме</h3></div>
        <div class="stack small"><p>Пәтер кірісіндегі автомат әдетте <b>32 А</b>. Кернеу 220 В болғанда рұқсат етілген қуат: <span class="mono">P = I · U = 32 · 220 = 7 040 Вт ≈ 7 000 Вт</span>.</p>
        <p>Әр бөлменің розетка желісі бөлек автоматқа (≈ 16 А) қосылады: <span class="mono">16 · 220 ≈ 3 500 Вт</span>.</p>
        <p>Клиент құралды қосқанда жалпы қуат шектен асса — <b>WARNING</b> хабарламасы жазылады, басты бетте қызыл ескерту көрсетіледі.</p>
        <p class="muted">Мәндер <span class="mono">settings</span> кестесінде сақталады: <span class="mono">INSERT … ON CONFLICT(key) DO UPDATE</span>.</p></div></div></div>`;
    const f = $('[data-f]', root);
    const calc = () => { $('[data-calc]', root).textContent = `≈ ${fmt((+f.apartmentLimit.value || 0) / 220, 1)} А × 220 В`; };
    f.apartmentLimit.addEventListener('input', calc);
    api('admin/settings').then((d) => { f.tariff.value = d.settings.tariff; f.apartmentLimit.value = d.settings.apartmentLimit; f.roomLimit.value = d.settings.roomLimit; calc(); }).catch((e) => toast('Қате', e.message, 'error'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api('admin/settings', { tariff: +f.tariff.value, apartmentLimit: +f.apartmentLimit.value, roomLimit: +f.roomLimit.value }); toast('Баптаулар сақталды', 'Тариф пен лимиттер жаңартылды.', 'success'); refreshState(); } catch (err) { formError(f, err.message); }
    });
    return {};
  }

  /* ======================= ІСКЕ ҚОСУ ======================= */
  async function boot() {
    Theme.apply();
    initAuth();
    initChrome();
    window.addEventListener('eu:theme', () => { /* 3D сахналар өздері тыңдайды */ });
    try {
      const [me, meta] = await Promise.all([api('me'), api('meta')]);
      S.meta = meta;
      if (me.user) await enterApp(me.user); else showAuth();
    } catch (e) {
      showAuth();
      toast('Сервер қолжетімсіз', e.message, 'error', 8000);
    }
    const b = $('#boot'); b.classList.add('done'); setTimeout(() => b.remove(), 500);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.user) pollNotifs(false); });
  boot();
})();
