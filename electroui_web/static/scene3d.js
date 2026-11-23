/* =============================================================================
   scene3d.js — three.js 3D сахналары (жергілікті static/three.min.js, r149)
     Scene3D.createHero(container)          — кіру бетіндегі жарқыраған найзағай
     Scene3D.createApartment(container, o)  — 4 бөлмелі пәтер, құралдар, сымдар
   Орбита/масштаб басқаруы өзіміз жазылған (three/examples қолжетімсіз).
   WebGL жоқ болса — null қайтарады, app.js 2D нұсқаны көрсетеді.
   ============================================================================= */
'use strict';
(() => {
  const T = window.THREE;

  function webglOK() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  const cssVar = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d);
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const reduced = () => document.documentElement.classList.contains('reduce-motion');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function makeRenderer(container) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    r.setClearColor(0x000000, 0);
    container.appendChild(r.domElement);
    return r;
  }

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,.65)');
    grd.addColorStop(0.6, 'rgba(255,255,255,.15)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function disposeObject(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  function observeSize(container, renderer, camera, after) {
    const fit = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (after) after(w, h);
    };
    fit();
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(container); } else window.addEventListener('resize', fit);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', fit); };
  }

  /* ===========================================================================
     1. КІРУ БЕТІНІҢ САХНАСЫ: найзағай, сақиналар, бөлшектер, электр доғалары
     =========================================================================== */
  function createHero(container) {
    if (!T || !webglOK()) return null;
    let renderer;
    try { renderer = makeRenderer(container); } catch (e) { return null; }
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 11);
    const glow = glowTexture();
    const colA = () => new T.Color(cssVar('--accent', '#3b82f6'));
    const colB = () => new T.Color(cssVar('--accent-2', '#22d3ee'));

    const group = new T.Group();
    scene.add(group);

    // Найзағай (ExtrudeGeometry)
    const pts = [[-0.2, 2], [0.8, 2], [0.15, 0.3], [0.9, 0.3], [-0.6, -2.2], [-0.05, -0.2], [-0.8, -0.2]];
    const shape = new T.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const boltGeo = new T.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 4, curveSegments: 4 });
    boltGeo.center();
    const boltMat = new T.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffa400, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.25 });
    const bolt = new T.Mesh(boltGeo, boltMat);
    bolt.scale.setScalar(1.15);
    group.add(bolt);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xffc83d, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
    halo.scale.set(7.5, 7.5, 1);
    halo.position.z = -0.6;
    group.add(halo);

    // Орбита сақиналары және олардағы «электрондар»
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const m = new T.Mesh(new T.TorusGeometry(2.7 + i * 0.6, 0.016, 8, 180),
        new T.MeshBasicMaterial({ color: i % 2 ? colB() : colA(), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false }));
      m.rotation.set(1.1 + i * 0.35, 0.3 * i, 0.4 * i);
      const e = new T.Sprite(new T.SpriteMaterial({ map: glow, color: i % 2 ? colB() : colA(), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      e.scale.set(0.55, 0.55, 1);
      m.add(e);
      m.userData = { r: 2.7 + i * 0.6, speed: 0.6 + i * 0.25, e };
      group.add(m);
      rings.push(m);
    }

    // Бөлшектер бұлты
    const N = 1100;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 3 + Math.random() * 9;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 2] = Math.sin(a) * r - 3;
    }
    const pGeo = new T.BufferGeometry();
    pGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pMat = new T.PointsMaterial({ size: 0.09, map: glow, color: colA(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 });
    const points = new T.Points(pGeo, pMat);
    scene.add(points);

    // Қалқып жүрген «құралдар» (low-poly пішіндер)
    const shapes = [new T.IcosahedronGeometry(0.45, 0), new T.BoxGeometry(0.55, 0.8, 0.5), new T.CylinderGeometry(0.28, 0.36, 0.7, 7),
      new T.OctahedronGeometry(0.45, 0), new T.TorusGeometry(0.32, 0.11, 8, 24), new T.DodecahedronGeometry(0.4, 0)];
    const spots = [[-3.6, 2.1, -1], [3.9, 2.4, -2], [-4.2, -1.8, -0.5], [3.6, -2.2, -1], [0.2, 3.3, -3], [-1.2, -3.1, -2]];
    const floaters = shapes.map((geo, i) => {
      const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x1b2440, metalness: 0.6, roughness: 0.3, emissive: colA(), emissiveIntensity: 0.18, transparent: true, opacity: 0.92 }));
      const edges = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: colB(), transparent: true, opacity: 0.85 }));
      m.add(edges);
      m.position.set(...spots[i]);
      m.userData = { base: m.position.clone(), sp: 0.4 + Math.random() * 0.6, ph: Math.random() * 6 };
      group.add(m);
      return m;
    });

    // Аша (вилка) және сым
    const plug = new T.Group();
    const dark = new T.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.3, roughness: 0.45 });
    const brass = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2, emissive: 0x332200 });
    const body = new T.Mesh(new T.CylinderGeometry(0.42, 0.5, 1.0, 24), dark);
    body.rotation.z = Math.PI / 2;
    plug.add(body);
    [-0.18, 0.18].forEach((y) => { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.7, 12), brass); p.rotation.z = Math.PI / 2; p.position.set(0.82, y, 0); plug.add(p); });
    const curve = new T.CatmullRomCurve3([new T.Vector3(-0.5, 0, 0), new T.Vector3(-1.6, -0.3, 0.2), new T.Vector3(-2.6, -1.4, -0.3), new T.Vector3(-3.4, -3.6, 0)]);
    plug.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.09, 8, false), dark));
    plug.position.set(-2.6, -0.4, 0.8);
    plug.rotation.set(0.2, -0.35, 0.15);
    plug.scale.setScalar(0.85);
    group.add(plug);

    // Электр доғасы (найзағайдан құралға)
    const arcGeo = new T.BufferGeometry();
    const arcPts = new Float32Array(14 * 3);
    arcGeo.setAttribute('position', new T.BufferAttribute(arcPts, 3));
    const arcMat = new T.LineBasicMaterial({ color: colB(), transparent: true, opacity: 0, blending: T.AdditiveBlending });
    const arc = new T.Line(arcGeo, arcMat);
    group.add(arc);
    let arcTarget = 0; let arcUntil = 0; let nextArc = 1.5;

    scene.add(new T.AmbientLight(0xffffff, 0.45));
    const key = new T.PointLight(0xffcc55, 2.2, 14);
    key.position.set(0, 0, 3);
    group.add(key);
    const rim = new T.PointLight(colA(), 2.5, 20);
    rim.position.set(-4, 3, 4);
    scene.add(rim);
    const dir = new T.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 6, 8);
    scene.add(dir);

    let mx = 0; let my = 0;
    const onMove = (e) => { mx = (e.clientX / window.innerWidth) * 2 - 1; my = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener('pointermove', onMove);
    const layout = (w, h) => {
      const a = w / h;
      const wide = a > 1.05;
      camera.position.z = a < 0.8 ? 15 : 11;
      group.position.set(wide ? 1.5 : 0.9, wide ? 0 : 3.4, wide ? 0 : -1);
      group.scale.setScalar(wide ? 1 : 0.62);
    };
    const stopObs = observeSize(container, renderer, camera, layout);
    const onTheme = () => {
      pMat.color = colA(); rim.color = colA(); arcMat.color = colB();
      rings.forEach((r, i) => { r.material.color = i % 2 ? colB() : colA(); r.userData.e.material.color = i % 2 ? colB() : colA(); });
      floaters.forEach((f) => { f.material.emissive = colA(); f.children[0].material.color = colB(); });
    };
    window.addEventListener('eu:theme', onTheme);

    let raf = 0; let t = 0; let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const k = reduced() ? 0.15 : 1;
      t += dt * k;
      bolt.rotation.y = Math.sin(t * 0.7) * 0.55;
      bolt.position.y = Math.sin(t * 1.3) * 0.15;
      halo.material.opacity = 0.65 + Math.sin(t * 2.4) * 0.15;
      boltMat.emissiveIntensity = 0.5 + Math.sin(t * 2.4) * 0.12;
      rings.forEach((r) => {
        r.rotation.z += dt * 0.15 * k;
        const a = t * r.userData.speed;
        r.userData.e.position.set(Math.cos(a) * r.userData.r, Math.sin(a) * r.userData.r, 0);
      });
      points.rotation.y += dt * 0.03 * k;
      floaters.forEach((f) => {
        const u = f.userData;
        f.position.y = u.base.y + Math.sin(t * u.sp + u.ph) * 0.25;
        f.rotation.x += dt * 0.3 * u.sp * k; f.rotation.y += dt * 0.4 * u.sp * k;
      });
      plug.position.y = -0.4 + Math.sin(t * 0.9) * 0.12;
      // доға
      if (t > nextArc && !reduced()) { arcTarget = Math.floor(Math.random() * floaters.length); arcUntil = t + 0.45; nextArc = t + 2 + Math.random() * 2.5; }
      if (t < arcUntil) {
        const a = new T.Vector3(0, bolt.position.y, 0.3);
        const b = floaters[arcTarget].position;
        for (let i = 0; i < 14; i++) {
          const s = i / 13;
          const j = i === 0 || i === 13 ? 0 : 0.35;
          arcPts[i * 3] = a.x + (b.x - a.x) * s + (Math.random() - 0.5) * j;
          arcPts[i * 3 + 1] = a.y + (b.y - a.y) * s + (Math.random() - 0.5) * j;
          arcPts[i * 3 + 2] = a.z + (b.z - a.z) * s + (Math.random() - 0.5) * j;
        }
        arcGeo.attributes.position.needsUpdate = true;
        arcMat.opacity = 0.9;
        floaters[arcTarget].material.emissiveIntensity = 0.8;
        boltMat.emissiveIntensity = 1.1;
      } else {
        arcMat.opacity = 0;
        floaters.forEach((f) => { f.material.emissiveIntensity += (0.18 - f.material.emissiveIntensity) * 0.1; });
      }
      camera.position.x += (mx * 1.2 - camera.position.x) * 0.04;
      camera.position.y += (-my * 0.8 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return {
      dispose() {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('eu:theme', onTheme);
        stopObs();
        disposeObject(scene);
        glow.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      },
    };
  }

  /* ===========================================================================
     2. 3D ПӘТЕР
     =========================================================================== */
  const HW = 8;     // пәтердің жарты ені (x)
  const HD = 5.5;   // пәтердің жарты тереңдігі (z)
  const WALL_H = 1.25;
  const GAP = 0.95; // орталық дәліз (қалқан тұрған жер)

  const M = (color, o = {}) => new T.MeshStandardMaterial({
    color, roughness: o.r ?? 0.5, metalness: o.m ?? 0.1, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: !!o.t, opacity: o.o ?? 1, side: o.side ?? T.FrontSide,
  });
  function add(g, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    g.add(m);
    return m;
  }
  function counter(g, w = 0.8) {
    add(g, new T.BoxGeometry(w, 0.82, 0.6), M(isDark() ? 0x334155 : 0xe2e8f0, { r: 0.6 }), 0, 0.41, 0);
    add(g, new T.BoxGeometry(w + 0.04, 0.05, 0.64), M(0x8b6b4a, { r: 0.5 }), 0, 0.845, 0);
    return 0.87;
  }

  /* --- Процедуралық low-poly модельдер (әр тип үшін) --- */
  const BUILD = {
    FRIDGE() {
      const g = new T.Group();
      add(g, new T.BoxGeometry(0.78, 1.9, 0.7), M(0xeef2f7, { r: 0.35, m: 0.2 }), 0, 0.95, 0);
      add(g, new T.BoxGeometry(0.8, 0.025, 0.02), M(0x64748b), 0, 1.28, 0.352);
      const metal = M(0x9aa4b2, { m: 0.85, r: 0.25 });
      add(g, new T.BoxGeometry(0.04, 0.4, 0.05), metal, 0.3, 1.58, 0.37);
      add(g, new T.BoxGeometry(0.04, 0.55, 0.05), metal, 0.3, 0.88, 0.37);
      const led = M(0x0b1220);
      add(g, new T.BoxGeometry(0.22, 0.09, 0.02), led, -0.14, 1.62, 0.36);
      return { g, h: 1.9, glow: [[led, 0x38bdf8, 1.8]] };
    },
    KETTLE() {
      const g = new T.Group();
      const top = counter(g);
      add(g, new T.CylinderGeometry(0.2, 0.22, 0.05, 24), M(0x111827), 0, top + 0.025, 0);
      const ring = M(0x0b1220);
      add(g, new T.TorusGeometry(0.205, 0.012, 6, 32), ring, 0, top + 0.05, 0).rotation.x = Math.PI / 2;
      add(g, new T.CylinderGeometry(0.14, 0.19, 0.36, 24), M(0xcbd5e1, { m: 0.85, r: 0.2 }), 0, top + 0.23, 0);
      add(g, new T.CylinderGeometry(0.1, 0.13, 0.04, 20), M(0x1f2937), 0, top + 0.43, 0);
      const handle = add(g, new T.TorusGeometry(0.12, 0.025, 8, 16, Math.PI), M(0x111827), -0.17, top + 0.25, 0);
      handle.rotation.z = Math.PI / 2;
      const spout = add(g, new T.ConeGeometry(0.05, 0.16, 10), M(0xcbd5e1, { m: 0.8 }), 0.2, top + 0.34, 0);
      spout.rotation.z = -Math.PI / 3;
      const steam = [];
      for (let i = 0; i < 5; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        s.scale.set(0.22, 0.22, 1); g.add(s); steam.push({ s, ph: i / 5 });
      }
      return {
        g, h: top + 0.45, glow: [[ring, 0x60a5fa, 2.2]],
        tick(t, dt, on) {
          steam.forEach((p) => {
            const k = (t * 0.45 + p.ph) % 1;
            p.s.position.set(0.28 + Math.sin(k * 6 + p.ph * 9) * 0.05, top + 0.42 + k * 0.7, 0);
            p.s.material.opacity = on ? (1 - k) * 0.45 : 0;
            p.s.scale.setScalar(0.15 + k * 0.3);
          });
        },
      };
    },
    MICROWAVE() {
      const g = new T.Group();
      const top = counter(g, 0.85);
      add(g, new T.BoxGeometry(0.66, 0.38, 0.46), M(0xe5e7eb, { r: 0.4, m: 0.3 }), 0, top + 0.19, 0);
      const win = M(0x0f172a, { r: 0.15, m: 0.4 });
      add(g, new T.BoxGeometry(0.4, 0.26, 0.02), win, -0.08, top + 0.19, 0.235);
      add(g, new T.BoxGeometry(0.14, 0.28, 0.02), M(0x1f2937), 0.24, top + 0.19, 0.235);
      const disp = M(0x0b1220);
      add(g, new T.BoxGeometry(0.1, 0.05, 0.01), disp, 0.24, top + 0.28, 0.25);
      return { g, h: top + 0.4, glow: [[win, 0xfbbf24, 1.1], [disp, 0x22d3ee, 2]], tick(t, dt, on) { if (on) win.emissiveIntensity = 0.9 + Math.sin(t * 6) * 0.2; } };
    },
    WASHER() {
      const g = new T.Group();
      add(g, new T.BoxGeometry(0.66, 0.9, 0.62), M(0xf1f5f9, { r: 0.35, m: 0.2 }), 0, 0.45, 0);
      add(g, new T.TorusGeometry(0.2, 0.035, 10, 32), M(0x94a3b8, { m: 0.8, r: 0.25 }), 0, 0.42, 0.315);
      const glass = M(0x1e3a5f, { r: 0.1, m: 0.3, t: true, o: 0.85 });
      const door = add(g, new T.CylinderGeometry(0.19, 0.19, 0.02, 32), glass, 0, 0.42, 0.31);
      door.rotation.x = Math.PI / 2;
      const drum = new T.Group();
      drum.position.set(0, 0.42, 0.29);
      add(drum, new T.BoxGeometry(0.3, 0.04, 0.01), M(0xcbd5e1), 0, 0, 0, false);
      add(drum, new T.BoxGeometry(0.04, 0.3, 0.01), M(0xcbd5e1), 0, 0, 0, false);
      g.add(drum);
      const led = M(0x0b1220);
      add(g, new T.BoxGeometry(0.5, 0.06, 0.02), led, 0, 0.8, 0.315);
      let v = 0;
      return { g, h: 0.9, glow: [[led, 0x22c55e, 1.6], [glass, 0x0ea5e9, 0.35]], tick(t, dt, on) { v += ((on ? 9 : 0) - v) * Math.min(1, dt * 1.5); drum.rotation.z += v * dt; } };
    },
    VACUUM() {
      const g = new T.Group();
      add(g, new T.CylinderGeometry(0.24, 0.27, 0.3, 20), M(0xdc2626, { r: 0.35, m: 0.2 }), 0, 0.2, 0);
      add(g, new T.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x1f2937, { r: 0.3 }), 0, 0.35, 0);
      [-0.22, 0.22].forEach((x) => { const w = add(g, new T.CylinderGeometry(0.09, 0.09, 0.06, 16), M(0x111827), x, 0.09, -0.05); w.rotation.z = Math.PI / 2; });
      const hose = new T.CatmullRomCurve3([new T.Vector3(0, 0.3, 0.22), new T.Vector3(0.1, 0.55, 0.45), new T.Vector3(0.15, 0.9, 0.5), new T.Vector3(0.2, 1.0, 0.55)]);
      add(g, new T.TubeGeometry(hose, 24, 0.035, 8, false), M(0x374151));
      const wand = add(g, new T.CylinderGeometry(0.02, 0.02, 1.0, 10), M(0x9ca3af, { m: 0.8 }), 0.3, 0.52, 0.62);
      wand.rotation.z = -0.12;
      add(g, new T.BoxGeometry(0.34, 0.05, 0.12), M(0x111827), 0.36, 0.03, 0.62);
      const led = M(0x0b1220);
      add(g, new T.SphereGeometry(0.03, 10, 8), led, 0, 0.36, 0.2);
      return { g, h: 1.05, glow: [[led, 0x22c55e, 2.5]], tick(t, dt, on) { g.children[0].position.x = on ? Math.sin(t * 60) * 0.004 : 0; } };
    },
    IRON() {
      const g = new T.Group();
      const boardMat = M(0x93c5fd, { r: 0.7 });
      add(g, new T.BoxGeometry(1.15, 0.04, 0.36), boardMat, 0, 0.82, 0);
      const leg = M(0x64748b, { m: 0.7 });
      [-1, 1].forEach((s) => { const l = add(g, new T.BoxGeometry(0.03, 0.95, 0.03), leg, 0, 0.42, 0); l.rotation.z = s * 0.55; });
      const sole = new T.Shape();
      sole.moveTo(-0.17, -0.1); sole.lineTo(0.08, -0.1); sole.quadraticCurveTo(0.24, -0.04, 0.26, 0); sole.quadraticCurveTo(0.24, 0.04, 0.08, 0.1); sole.lineTo(-0.17, 0.1); sole.closePath();
      const soleMat = M(0x9ca3af, { m: 0.9, r: 0.2 });
      const plate = add(g, new T.ExtrudeGeometry(sole, { depth: 0.05, bevelEnabled: false }), soleMat, 0.2, 0.84, 0);
      plate.rotation.x = -Math.PI / 2; plate.position.y = 0.845;
      const bodyShape = add(g, new T.ExtrudeGeometry(sole, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), M(0x7c3aed, { r: 0.35 }), 0.2, 0.9, 0);
      bodyShape.rotation.x = -Math.PI / 2; bodyShape.scale.set(0.92, 0.92, 1);
      const h = add(g, new T.TorusGeometry(0.1, 0.022, 8, 16, Math.PI), M(0x1f2937), 0.2, 1.0, 0);
      h.rotation.y = 0;
      return { g, h: 1.12, glow: [[soleMat, 0xf97316, 1.4]], tick(t, dt, on) { if (on) soleMat.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.35; } };
    },
    TV() {
      const g = new T.Group();
      add(g, new T.BoxGeometry(1.25, 0.42, 0.4), M(isDark() ? 0x3f3f46 : 0xd6d3d1, { r: 0.6 }), 0, 0.21, 0);
      add(g, new T.BoxGeometry(0.36, 0.03, 0.2), M(0x111827), 0, 0.435, 0);
      add(g, new T.BoxGeometry(0.06, 0.16, 0.05), M(0x111827), 0, 0.52, 0);
      add(g, new T.BoxGeometry(1.15, 0.68, 0.05), M(0x0a0a0a, { r: 0.3, m: 0.5 }), 0, 0.94, 0);
      const screen = M(0x020617, { r: 0.15 });
      add(g, new T.BoxGeometry(1.07, 0.6, 0.01), screen, 0, 0.94, 0.027);
      return { g, h: 1.3, glow: [[screen, 0x3b82f6, 0.9]], tick(t, dt, on) { if (on) screen.emissive.setHSL((t * 0.05) % 1, 0.65, 0.5); } };
    },
    COMPUTER() {
      const g = new T.Group();
      const desk = M(isDark() ? 0x44403c : 0xe7e5e4, { r: 0.55 });
      add(g, new T.BoxGeometry(1.15, 0.05, 0.6), desk, 0, 0.74, 0);
      [[-0.53, -0.25], [0.53, -0.25], [-0.53, 0.25], [0.53, 0.25]].forEach(([x, z]) => add(g, new T.BoxGeometry(0.04, 0.72, 0.04), M(0x52525b), x, 0.36, z));
      add(g, new T.BoxGeometry(0.66, 0.4, 0.035), M(0x0a0a0a), 0, 1.07, -0.12);
      const screen = M(0x020617);
      add(g, new T.BoxGeometry(0.62, 0.36, 0.01), screen, 0, 1.07, -0.1);
      add(g, new T.BoxGeometry(0.05, 0.16, 0.05), M(0x18181b), 0, 0.84, -0.14);
      add(g, new T.BoxGeometry(0.5, 0.02, 0.16), M(0x27272a), 0, 0.775, 0.12);
      add(g, new T.BoxGeometry(0.26, 0.52, 0.5), M(0x111827, { m: 0.5, r: 0.3 }), 0.72, 0.26, 0);
      const rgb = M(0x111111);
      add(g, new T.BoxGeometry(0.02, 0.44, 0.02), rgb, 0.72, 0.26, 0.255);
      add(g, new T.BoxGeometry(0.2, 0.02, 0.02), rgb, 0.72, 0.5, 0.255);
      return { g, h: 1.3, glow: [[screen, 0x60a5fa, 0.8], [rgb, 0xec4899, 2.5]], tick(t, dt, on) { if (on) rgb.emissive.setHSL((t * 0.2) % 1, 1, 0.5); } };
    },
    AIRCON() {
      const g = new T.Group();
      add(g, new T.BoxGeometry(1.0, 2.1, 0.08), M(isDark() ? 0x334155 : 0xcbd5e1, { r: 0.8, t: true, o: 0.55 }), 0, 1.05, -0.3);
      add(g, new T.BoxGeometry(0.92, 0.3, 0.24), M(0xf8fafc, { r: 0.3, m: 0.15 }), 0, 1.72, -0.14);
      add(g, new T.BoxGeometry(0.8, 0.03, 0.02), M(0x334155), 0, 1.6, -0.01);
      const led = M(0x0b1220);
      add(g, new T.BoxGeometry(0.06, 0.03, 0.01), led, 0.36, 1.78, -0.015);
      const flow = [];
      for (let i = 0; i < 6; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color: 0x7dd3fc, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
        s.scale.set(0.2, 0.2, 1); g.add(s); flow.push({ s, ph: i / 6, x: (i % 3 - 1) * 0.28 });
      }
      return {
        g, h: 1.9, glow: [[led, 0x22d3ee, 3]],
        tick(t, dt, on) {
          flow.forEach((p) => {
            const k = (t * 0.6 + p.ph) % 1;
            p.s.position.set(p.x, 1.55 - k * 0.9, 0.05 + k * 0.7);
            p.s.material.opacity = on ? (1 - k) * 0.55 : 0;
          });
        },
      };
    },
    HEATER() {
      const g = new T.Group();
      const fins = M(0xe5e7eb, { r: 0.4, m: 0.3 });
      for (let i = 0; i < 7; i++) {
        const fin = add(g, new T.CylinderGeometry(0.16, 0.16, 0.06, 16, 1), fins, -0.27 + i * 0.09, 0.45, 0);
        fin.rotation.z = Math.PI / 2;
        fin.scale.set(1, 1, 1);
        add(g, new T.BoxGeometry(0.06, 0.6, 0.3), fins, -0.27 + i * 0.09, 0.45, 0);
      }
      add(g, new T.BoxGeometry(0.64, 0.04, 0.08), M(0x9ca3af, { m: 0.8 }), 0, 0.12, 0);
      [-0.25, 0.25].forEach((x) => add(g, new T.BoxGeometry(0.06, 0.06, 0.4), M(0x374151), x, 0.06, 0));
      const knob = M(0x111827);
      add(g, new T.BoxGeometry(0.1, 0.12, 0.08), knob, 0.36, 0.7, 0.05);
      return { g, h: 0.8, glow: [[fins, 0xf97316, 0.55], [knob, 0xef4444, 1.5]], tick(t, dt, on) { if (on) fins.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.2; } };
    },
    FAN() {
      const g = new T.Group();
      add(g, new T.CylinderGeometry(0.24, 0.28, 0.05, 24), M(0x1f2937, { m: 0.5 }), 0, 0.025, 0);
      add(g, new T.CylinderGeometry(0.025, 0.025, 1.05, 10), M(0x9ca3af, { m: 0.85, r: 0.2 }), 0, 0.55, 0);
      const motor = add(g, new T.CylinderGeometry(0.1, 0.1, 0.2, 18), M(0xe5e7eb, { r: 0.3 }), 0, 1.12, -0.05);
      motor.rotation.x = Math.PI / 2;
      const blades = new T.Group();
      blades.position.set(0, 1.12, 0.08);
      const bm = M(0x93c5fd, { t: true, o: 0.9, side: T.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const b = add(blades, new T.BoxGeometry(0.1, 0.28, 0.01), bm, 0, 0.15, 0, false);
        const pivot = new T.Group(); pivot.rotation.z = (i * Math.PI * 2) / 3; pivot.add(b); blades.add(pivot);
      }
      g.add(blades);
      const cage = add(g, new T.TorusGeometry(0.33, 0.01, 6, 40), M(0xd1d5db, { m: 0.8 }), 0, 1.12, 0.08, false);
      cage.rotation.x = 0;
      const led = M(0x0b1220);
      add(g, new T.SphereGeometry(0.02, 8, 6), led, 0.12, 0.05, 0.18);
      let v = 0;
      return { g, h: 1.45, glow: [[led, 0x22c55e, 3]], tick(t, dt, on) { v += ((on ? 16 : 0) - v) * Math.min(1, dt * 1.2); blades.rotation.z += v * dt; } };
    },
    LAMP() {
      const g = new T.Group();
      add(g, new T.CylinderGeometry(0.2, 0.24, 0.04, 24), M(0x1f2937, { m: 0.6 }), 0, 0.02, 0);
      add(g, new T.CylinderGeometry(0.018, 0.018, 1.45, 10), M(0xd4af37, { m: 0.9, r: 0.25 }), 0, 0.75, 0);
      add(g, new T.CylinderGeometry(0.17, 0.3, 0.3, 24, 1, true), M(0xfef3c7, { r: 0.8, side: T.DoubleSide, t: true, o: 0.92 }), 0, 1.5, 0);
      const bulb = M(0xfffbeb, { r: 0.2 });
      add(g, new T.SphereGeometry(0.08, 16, 12), bulb, 0, 1.43, 0, false);
      const light = new T.PointLight(0xffd59a, 0, 4.5, 2);
      light.position.set(0, 1.35, 0);
      g.add(light);
      return { g, h: 1.65, glow: [[bulb, 0xffd59a, 2.5]], tick(t, dt, on) { light.intensity += ((on ? 2.2 : 0) - light.intensity) * Math.min(1, dt * 4); } };
    },
  };

  function floorTexture(kind, base) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    if (kind === 'tile') {
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
      for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
      for (let i = 2; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
    } else {
      for (let y = 0; y < 256; y += 32) {
        const off = (y / 32) % 2 ? 90 : 0;
        for (let x = -off; x < 256; x += 180) {
          g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${(Math.random() * 0.08).toFixed(3)})`;
          g.fillRect(x, y, 178, 30);
        }
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 30, 256, 2);
      }
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function labelSprite() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 168;
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    s.renderOrder = 10;
    s.scale.set(3.3, 3.3 * (168 / 512), 1);
    s.userData.draw = (title, sub, danger) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, 512, 168);
      const dark = isDark();
      g.fillStyle = dark ? 'rgba(10,16,36,.78)' : 'rgba(255,255,255,.88)';
      g.strokeStyle = danger ? 'rgba(239,68,68,.95)' : (dark ? 'rgba(148,163,255,.35)' : 'rgba(30,41,90,.18)');
      g.lineWidth = 4;
      const r = 34;
      g.beginPath(); g.moveTo(r, 4); g.arcTo(508, 4, 508, 164, r); g.arcTo(508, 164, 4, 164, r); g.arcTo(4, 164, 4, 4, r); g.arcTo(4, 4, 508, 4, r); g.closePath();
      g.fill(); g.stroke();
      g.textAlign = 'center';
      g.fillStyle = danger ? '#ef4444' : (dark ? '#e9edff' : '#0e1630');
      g.font = '700 50px "Segoe UI", system-ui, sans-serif';
      g.fillText(title, 256, 74);
      g.fillStyle = danger ? '#f87171' : (dark ? '#9aa6d0' : '#56617f');
      g.font = '600 36px "Segoe UI", system-ui, sans-serif';
      g.fillText(sub, 256, 130);
      tex.needsUpdate = true;
    };
    return s;
  }

  const fmt = (n) => (window.Electro ? window.Electro.fmtNum(n, 0) : String(Math.round(n)));

  function createApartment(container, opts) {
    if (!T || !webglOK()) return null;
    let renderer;
    try { renderer = makeRenderer(container); } catch (e) { return null; }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', '3D пәтер: құралды таңдау үшін басыңыз');
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 200);
    const tip = document.createElement('div');
    tip.className = 'tip3d'; tip.hidden = true;
    container.appendChild(tip);

    let state = opts.state;
    let env = null;            // тұрақты орта (еден, қабырға, қалқан)
    let apps = [];             // құралдар жазбалары
    let rooms = [];            // бөлме жазбалары
    let selected = null;
    let glow = null;
    let sig = '';

    const ctl = { theta: 0.65, phi: 0.92, radius: 22, tx: 0, ty: 0, tz: 0 };
    const want = { ...ctl };
    let auto = false;
    const fitRadius = () => clamp(Math.max(13, 8.4 / (Math.tan((21 * Math.PI) / 180) * camera.aspect)) + 2.5, 12, 44);
    const resetView = () => { Object.assign(want, { theta: 0.65, phi: 0.92, radius: fitRadius(), tx: 0, ty: 0, tz: 0 }); };

    const accent = () => new T.Color(cssVar('--accent', '#3b82f6'));
    const accent2 = () => new T.Color(cssVar('--accent-2', '#22d3ee'));
    const OFF = new T.Color(0x64748b);
    const BLACK = new T.Color(0x000000);
    const RED = new T.Color(0xef4444);

    function roomRect(i) {
      const xs = [[-HW, 0], [0, HW], [-HW, 0], [0, HW]][i % 4];
      const zs = [[-HD, 0], [-HD, 0], [0, HD], [0, HD]][i % 4];
      return { x0: xs[0], x1: xs[1], z0: zs[0], z1: zs[1], cx: (xs[0] + xs[1]) / 2, cz: (zs[0] + zs[1]) / 2, sx: Math.sign((xs[0] + xs[1]) / 2), sz: Math.sign((zs[0] + zs[1]) / 2) };
    }
    function slots(r) {
      const out = [];
      const nx = 4; const nz = 3;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          out.push({ x: r.x0 + 1.05 + (i * (r.x1 - r.x0 - 2.1)) / (nx - 1), z: r.z0 + 1.0 + (j * (r.z1 - r.z0 - 2.0)) / (nz - 1) });
        }
      }
      // алдымен шеттегі орындар (бөлме ортасынан алыс), сосын ортаңғылары
      return out.sort((a, b) => Math.hypot(b.x - r.cx, (b.z - r.cz) * 1.4) - Math.hypot(a.x - r.cx, (a.z - r.cz) * 1.4) || a.x - b.x);
    }

    /* --- Тұрақты орта --- */
    function buildEnv() {
      env = new T.Group();
      scene.add(env);
      glow = glowTexture();
      const dark = isDark();
      env.add(new T.HemisphereLight(dark ? 0x9fb4ff : 0xffffff, dark ? 0x1a1f33 : 0xb8c2d6, dark ? 0.55 : 0.75));
      const sun = new T.DirectionalLight(0xffffff, dark ? 0.75 : 0.95);
      sun.position.set(9, 16, 7);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
      sun.shadow.bias = -0.0005;
      env.add(sun);

      // табан
      add(env, new T.BoxGeometry(HW * 2 + 0.6, 0.3, HD * 2 + 0.6), M(dark ? 0x0f172a : 0xcbd5e1, { r: 0.8 }), 0, -0.16, 0, false);
      const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(HW * 2 + 0.6, 0.3, HD * 2 + 0.6)), new T.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0.6 }));
      edge.position.y = -0.16;
      env.add(edge);

      // қабырғалар (сыртқы + ішкі, ортада дәліз)
      const wallMat = M(dark ? 0x5b6b9a : 0xe2e8f0, { r: 0.25, m: 0.1, t: true, o: dark ? 0.42 : 0.6 });
      const capMat = new T.MeshBasicMaterial({ color: accent(), transparent: true, opacity: 0.75 });
      const wall = (x, z, w, d) => {
        add(env, new T.BoxGeometry(w, WALL_H, d), wallMat, x, WALL_H / 2, z, false);
        add(env, new T.BoxGeometry(w + 0.02, 0.035, d + 0.02), capMat, x, WALL_H + 0.02, z, false);
      };
      wall(0, -HD, HW * 2, 0.12); wall(0, HD, HW * 2, 0.12); wall(-HW, 0, 0.12, HD * 2); wall(HW, 0, 0.12, HD * 2);
      wall(0, -(HD + GAP) / 2, 0.12, HD - GAP); wall(0, (HD + GAP) / 2, 0.12, HD - GAP);
      wall(-(HW + GAP) / 2, 0, HW - GAP, 0.12); wall((HW + GAP) / 2, 0, HW - GAP, 0.12);

      // электр қалқаны (орталықта)
      const panel = new T.Group();
      add(panel, new T.BoxGeometry(0.75, 1.7, 0.75), M(0x1e293b, { m: 0.6, r: 0.35 }), 0, 0.85, 0);
      const breakers = [];
      for (let f = 0; f < 4; f++) {
        const face = new T.Group();
        face.rotation.y = (f * Math.PI) / 2;
        for (let i = 0; i < 4; i++) {
          const bm = M(0x0b1220);
          add(face, new T.BoxGeometry(0.1, 0.18, 0.04), bm, -0.22 + i * 0.147, 1.15, 0.39, false);
          breakers.push(bm);
        }
        add(face, new T.BoxGeometry(0.55, 0.32, 0.01), M(0x94a3b8, { m: 0.7, r: 0.3 }), 0, 0.6, 0.38, false);
        panel.add(face);
      }
      const panelHalo = new T.Sprite(new T.SpriteMaterial({ map: glow, color: accent(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
      panelHalo.scale.set(3.2, 3.2, 1);
      panelHalo.position.y = 1.9;
      panel.add(panelHalo);
      const panelRing = new T.Mesh(new T.RingGeometry(0.62, 0.78, 48), new T.MeshBasicMaterial({ color: accent(), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
      panelRing.rotation.x = -Math.PI / 2; panelRing.position.y = 0.02;
      panel.add(panelRing);
      const panelLabel = labelSprite();
      panelLabel.position.set(0, 2.75, 0);
      panel.add(panelLabel);
      env.add(panel);
      env.userData = { panel, breakers, panelHalo, panelRing, panelLabel };

      // таңдау сақинасы
      const sel = new T.Mesh(new T.RingGeometry(0.78, 0.9, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
      sel.rotation.x = -Math.PI / 2; sel.position.y = 0.035; sel.visible = false;
      env.add(sel);
      env.userData.sel = sel;
    }

    /* --- Бөлмелер мен құралдар --- */
    function buildContent(st) {
      const dark = isDark();
      const FLOORS = [['tile', dark ? '#3a4566' : '#d5dae4'], ['wood', dark ? '#5e4633' : '#c8a27a'], ['wood', dark ? '#4f3f55' : '#d9b99b'], ['tile', dark ? '#2e4b64' : '#c4dceb']];
      rooms = st.rooms.slice(0, 4).map((r, i) => {
        const rect = roomRect(i);
        const n = r.name.toLowerCase();
        const kind = n.includes('ас үй') ? 0 : n.includes('қонақ') ? 1 : n.includes('жатын') ? 2 : n.includes('жуынатын') ? 3 : i;
        const [tk, col] = FLOORS[kind];
        const tex = floorTexture(tk, col);
        tex.repeat.set((rect.x1 - rect.x0) / 2, (rect.z1 - rect.z0) / 2);
        const fm = new T.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05, emissive: 0x000000 });
        const floor = new T.Mesh(new T.PlaneGeometry(rect.x1 - rect.x0, rect.z1 - rect.z0), fm);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(rect.cx, 0.001, rect.cz);
        floor.receiveShadow = true;
        env.add(floor);
        const label = labelSprite();
        label.position.set(rect.cx, 2.3, rect.sz < 0 ? rect.z0 + 0.45 : rect.z1 - 0.45);
        env.add(label);
        return { id: r.id, rect, floor, fm, label, slots: slots(rect) };
      });

      const byRoom = new Map(rooms.map((r) => [r.id, r]));
      const counters = new Map();
      apps = [];
      st.appliances.forEach((a) => {
        const room = byRoom.get(a.roomId);
        if (!room || !BUILD[a.type]) return;
        const j = counters.get(room.id) || 0;
        counters.set(room.id, j + 1);
        const slot = room.slots[j % room.slots.length];
        const extra = Math.floor(j / room.slots.length) * 0.35;
        const model = BUILD[a.type].call({ glow });
        const g = model.g;
        g.scale.setScalar(1);
        g.position.set(slot.x + extra, 0, slot.z + extra);
        g.rotation.y = Math.atan2(room.rect.cx - slot.x, room.rect.cz - slot.z);
        g.traverse((o) => { o.userData.appId = a.id; });
        env.add(g);

        // сым: қалқаннан құралға дейін (L-пішінді жол)
        const y = 0.05;
        const lane = room.rect.sx * (0.42 + j * 0.09);
        const zRow = slot.z + 0.55 * Math.sign(room.rect.cz - slot.z || 1);
        const path = new T.CurvePath();
        const P = [new T.Vector3(0, y, 0), new T.Vector3(lane, y, room.rect.sz * 0.42), new T.Vector3(lane, y, zRow), new T.Vector3(g.position.x, y, zRow), new T.Vector3(g.position.x, y, g.position.z)];
        for (let k = 0; k < P.length - 1; k++) if (P[k].distanceTo(P[k + 1]) > 0.001) path.add(new T.LineCurve3(P[k], P[k + 1]));
        const wireMat = new T.MeshStandardMaterial({ color: OFF, emissive: BLACK, roughness: 0.4, metalness: 0.2 });
        const wire = new T.Mesh(new T.TubeGeometry(path, 80, 0.028, 6, false), wireMat);
        env.add(wire);
        const sparks = [];
        for (let k = 0; k < 6; k++) {
          const s = new T.Sprite(new T.SpriteMaterial({ map: glow, color: accent2(), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
          s.scale.set(0.32, 0.32, 1); s.visible = false; env.add(s);
          sparks.push({ s, ph: k / 6 });
        }
        const halo = new T.Sprite(new T.SpriteMaterial({ map: glow, color: accent(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
        halo.scale.set(1.8, 1.8, 1);
        halo.position.set(g.position.x, model.h * 0.6, g.position.z);
        env.add(halo);
        const ringMat = new T.MeshBasicMaterial({ color: accent(), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false });
        const ring = new T.Mesh(new T.RingGeometry(0.55, 0.66, 40), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(g.position.x, 0.03, g.position.z);
        env.add(ring);
        apps.push({ id: a.id, data: a, g, model, path, wireMat, sparks, halo, ring, ringMat, on: null, h: model.h });
      });
    }

    function applyStates(st) {
      state = st;
      const ac = accent(); const ac2 = accent2();
      const byId = new Map(st.appliances.map((a) => [a.id, a]));
      apps.forEach((e) => {
        const a = byId.get(e.id); if (!a) return;
        e.data = a;
        const on = !!a.pluggedIn;
        e.on = on;
        e.wireMat.color.copy(on ? ac : OFF);
        e.wireMat.emissive.copy(on ? ac : BLACK);
        e.wireMat.emissiveIntensity = on ? 0.9 : 0;
        e.sparks.forEach((p) => { p.s.visible = on; p.s.material.color.copy(ac2); });
        e.halo.visible = on;
        e.halo.material.color.copy(ac);
        e.ringMat.color.copy(on ? ac : OFF);
        e.ringMat.opacity = on ? 0.7 : 0.22;
        (e.model.glow || []).forEach(([mat, col, int]) => {
          mat.emissive.copy(on ? new T.Color(col) : BLACK);
          mat.emissiveIntensity = on ? int : 0;
        });
      });
      const set = st.settings;
      rooms.forEach((r) => {
        const rs = st.rooms.find((x) => x.id === r.id);
        if (!rs) return;
        r.over = rs.overload;
        r.label.userData.draw(rs.name, `${rs.used}/${rs.sockets} розетка · ${fmt(rs.power)} Вт`, rs.overload);
        if (!rs.overload) { r.fm.emissive.copy(BLACK); r.fm.emissiveIntensity = 0; }
      });
      const u = env.userData;
      const over = st.totals.apartmentOverload;
      u.over = over;
      u.panelLabel.userData.draw('Электр қалқаны', `${fmt(st.totals.power)} / ${fmt(set.apartmentLimit)} Вт`, over);
      u.breakers.forEach((b, i) => { b.emissive.copy(over ? RED : i % 4 < Math.ceil((st.totals.loadPct / 100) * 4) ? new T.Color(0x22c55e) : new T.Color(0x0f766e)); b.emissiveIntensity = over ? 2 : 1.4; });
      u.panelHalo.material.color.copy(over ? RED : ac);
      u.panelRing.material.color.copy(over ? RED : ac);
    }

    const structSig = (st) => `${isDark()}|${cssVar('--accent', '')}|` + st.rooms.map((r) => `${r.id}:${r.name}`).join(',') + '|' + st.appliances.map((a) => `${a.id}:${a.roomId}:${a.type}`).join(',');
    function rebuild(st) {
      if (env) { scene.remove(env); disposeObject(env); }
      if (glow) glow.dispose();
      buildEnv();
      buildContent(st);
      sig = structSig(st);
      applyStates(st);
      if (selected && !apps.find((a) => a.id === selected)) select(null, true);
    }

    /* --- Басқару (орбита, масштаб, жылжыту) --- */
    const pointers = new Map();
    let moved = 0; let pinch = 0; let dragging = false;
    const hover = { x: 0, y: 0, pending: false, id: null };
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    const dist2 = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    function pick(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(apps.map((a) => a.g), true);
      const h = hits.find((x) => x.object.userData.appId);
      return h ? h.object.userData.appId : null;
    }
    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey });
      moved = 0; dragging = true;
      if (pointers.size === 2) pinch = dist2();
      canvas.classList.add('dragging');
      tip.hidden = true;
    };
    const onMove = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) { hover.x = e.clientX; hover.y = e.clientY; hover.pending = true; return; }
      const dx = e.clientX - p.x; const dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 1) {
        if (p.b === 2 || p.shift) {
          const s = want.radius * 0.0016;
          const fx = Math.sin(want.theta); const fz = Math.cos(want.theta);
          want.tx = clamp(want.tx - (dx * fz) * s - (dy * fx) * s, -HW, HW);
          want.tz = clamp(want.tz + (dx * fx) * s - (dy * fz) * s, -HD, HD);
        } else {
          want.theta -= dx * 0.006;
          want.phi = clamp(want.phi - dy * 0.005, 0.06, 1.42);
        }
        moved += Math.abs(dx) + Math.abs(dy);
      } else if (pointers.size === 2) {
        const d = dist2();
        if (pinch) want.radius = clamp(want.radius * (pinch / d), 7, 50);
        pinch = d; moved += 10;
      }
    };
    const onUp = (e) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!pointers.size) { dragging = false; canvas.classList.remove('dragging'); }
      if (p && moved < 7 && p.b === 0) {
        const id = pick(e.clientX, e.clientY);
        select(id);
      }
    };
    const onWheel = (e) => { e.preventDefault(); want.radius = clamp(want.radius * Math.exp(e.deltaY * 0.0012), 7, 50); };
    const onLeave = () => { tip.hidden = true; canvas.classList.remove('hovering'); hover.id = null; };
    const noMenu = (e) => e.preventDefault();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', noMenu);
    const onLost = (e) => {
      e.preventDefault();
      const n = document.createElement('div');
      n.className = 'fallback3d';
      n.innerHTML = '<div class="banner" style="animation:none"><div class="txt"><b>WebGL контексті жоғалды</b><p class="small">Бетті жаңартыңыз (F5).</p></div></div>';
      container.appendChild(n);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    function doHover() {
      hover.pending = false;
      if (dragging) return;
      const id = pick(hover.x, hover.y);
      hover.id = id;
      canvas.classList.toggle('hovering', !!id);
      if (!id) { tip.hidden = true; return; }
      const e = apps.find((a) => a.id === id);
      const r = container.getBoundingClientRect();
      tip.hidden = false;
      tip.textContent = `${e.data.name} · ${fmt(e.data.power)} Вт · ${e.on ? 'қосулы' : 'өшірулі'}`;
      tip.style.left = `${hover.x - r.left}px`;
      tip.style.top = `${hover.y - r.top}px`;
    }

    function select(id, silent) {
      selected = id || null;
      const sel = env.userData.sel;
      const e = apps.find((a) => a.id === selected);
      sel.visible = !!e;
      if (e) {
        sel.position.x = e.g.position.x; sel.position.z = e.g.position.z;
        want.tx = e.g.position.x * 0.45; want.tz = e.g.position.z * 0.45;
        want.radius = Math.min(want.radius, fitRadius() * 0.85);
      }
      if (!silent && opts.onSelect) opts.onSelect(selected);
    }

    /* --- Анимация циклы --- */
    const stopObs = observeSize(container, renderer, camera);
    rebuild(state);
    resetView();
    Object.assign(ctl, want);
    let raf = 0; let t = 0; let last = performance.now();
    const tmp = new T.Vector3();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += dt * (reduced() ? 0.25 : 1);
      if (auto && !dragging) want.theta += dt * 0.2;
      const k = 1 - Math.pow(0.001, dt);
      ['theta', 'phi', 'radius', 'tx', 'ty', 'tz'].forEach((key) => { ctl[key] += (want[key] - ctl[key]) * k; });
      camera.position.set(
        ctl.tx + ctl.radius * Math.sin(ctl.phi) * Math.sin(ctl.theta),
        ctl.ty + ctl.radius * Math.cos(ctl.phi),
        ctl.tz + ctl.radius * Math.sin(ctl.phi) * Math.cos(ctl.theta),
      );
      camera.lookAt(ctl.tx, ctl.ty + 0.3, ctl.tz);

      apps.forEach((e) => {
        if (e.model.tick) e.model.tick(t, dt, e.on);
        if (e.on) {
          e.sparks.forEach((p) => {
            const u = (t * 0.32 + p.ph) % 1;
            e.path.getPointAt(u, tmp);
            p.s.position.set(tmp.x, tmp.y + 0.04, tmp.z);
            p.s.material.opacity = Math.min(1, u * 6) * 0.95;
          });
          const pulse = 0.5 + Math.sin(t * 3 + e.id) * 0.5;
          e.halo.material.opacity = 0.28 + pulse * 0.3;
          e.halo.scale.setScalar(1.5 + pulse * 0.35);
          e.ring.scale.setScalar(1 + pulse * 0.08);
        }
      });
      const u = env.userData;
      const blink = 0.5 + Math.sin(t * (u.over ? 9 : 2.5)) * 0.5;
      u.panelHalo.material.opacity = u.over ? 0.4 + blink * 0.6 : 0.45 + blink * 0.25;
      u.panelRing.scale.setScalar(1 + blink * 0.12);
      rooms.forEach((r) => {
        if (r.over) { r.fm.emissive.copy(RED); r.fm.emissiveIntensity = 0.12 + blink * 0.25; }
      });
      if (u.sel.visible) { u.sel.rotation.z += dt * 1.5; u.sel.material.opacity = 0.55 + blink * 0.4; }
      if (hover.pending) doHover();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    const onTheme = () => rebuild(state);
    window.addEventListener('eu:theme', onTheme);

    return {
      update(st) { if (structSig(st) !== sig) rebuild(st); else applyStates(st); },
      select(id) { select(id); },
      resetView() { resetView(); },
      topView() { Object.assign(want, { phi: 0.06, radius: fitRadius() * 1.05, tx: 0, tz: 0 }); },
      toggleAutoRotate() { auto = !auto; return auto; },
      dispose() {
        cancelAnimationFrame(raf);
        window.removeEventListener('eu:theme', onTheme);
        stopObs();
        if (env) disposeObject(env);
        if (glow) glow.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
        tip.remove();
      },
    };
  }

  window.Scene3D = { available: () => !!T && webglOK(), createHero, createApartment };
})();
