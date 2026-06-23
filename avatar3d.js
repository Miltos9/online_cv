/* ============================================================
   Persistent particle avatar.
   - At the top it IS the photo (crisp, recognizable).
   - As you scroll, the photo dissolves into particles that
     reassemble into the SQL query of the section in view
     (e.g. Kosmocar -> SELECT * FROM companies WHERE ...).
   - On desktop it stays pinned to the right and follows the page;
     on smaller screens it lives in the hero.
   Falls back to the static photo if WebGL / Three.js is missing
   or the user prefers reduced motion.
   ============================================================ */
(function () {
  const wrap = document.getElementById("avatar3d");
  const canvas = document.getElementById("avatarCanvas");
  const photo = document.getElementById("avatarPhoto");
  const hint = document.getElementById("avatarHint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const photoOnly = () => {
    if (canvas) canvas.style.display = "none";
    if (photo) photo.style.opacity = "1";
    if (hint) hint.style.display = "none";
  };
  if (!wrap || !canvas || !photo || !window.THREE || reduce) return photoOnly();

  const COUNT = window.innerWidth < 700 ? 5000 : 9000;
  const photoPos = new Float32Array(COUNT * 3);
  const photoCol = new Float32Array(COUNT * 3);
  const cur = new Float32Array(COUNT * 3);
  const curC = new Float32Array(COUNT * 3);
  const desP = new Float32Array(COUNT * 3);
  const desC = new Float32Array(COUNT * 3);

  let targetP = photoPos, targetC = photoCol; // current SQL target (defaults to photo)
  const textCache = {};

  /* ---- sample the portrait into "ink" pixels ---- */
  function sampleImage(img) {
    const w = 150, h = 188;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 200 && g > 196 && b > 184) continue;
        pts.push([px, py, r, g, b]);
      }
    return { pts, w, h };
  }

  /* ---- word-wrap a query so it fits the panel ---- */
  function wrapLines(sql, max) {
    const words = sql.split(" ");
    const lines = []; let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; }
      else line = (line + " " + w).trim();
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ---- render a SQL string to particle targets ---- */
  function buildText(sql) {
    if (textCache[sql]) return textCache[sql];
    const w = 540, h = 460;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    const lines = wrapLines(sql, 17);
    const longest = Math.max(...lines.map((l) => l.length));
    const fs = Math.min(46, Math.floor((w - 40) / (longest * 0.62)));
    const lh = fs * 1.42;
    x.fillStyle = "#fff";
    x.textBaseline = "top";
    x.font = `bold ${fs}px "JetBrains Mono", monospace`;
    let y = (h - lines.length * lh) / 2;
    for (const l of lines) { x.fillText(l, 24, y); y += lh; }
    const d = x.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let py = 0; py < h; py += 2)
      for (let px = 0; px < w; px += 2)
        if (d[(py * w + px) * 4 + 3] > 128) pts.push([px, py]);

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const s = 2.9 / w, cx = w / 2, cy = h / 2;
    for (let k = 0; k < COUNT; k++) {
      const j = k * 3;
      const t = pts.length ? pts[(Math.random() * pts.length) | 0] : [cx, cy];
      pos[j] = (t[0] - cx) * s;
      pos[j + 1] = -(t[1] - cy) * s;
      pos[j + 2] = (Math.random() - 0.5) * 0.12;
      const mix = Math.max(0, Math.min(1, (pos[j] + 1.45) / 2.9));
      col[j] = 0.18 + mix * 0.13;
      col[j + 1] = 0.83 - mix * 0.34;
      col[j + 2] = 1.0;
    }
    return (textCache[sql] = { pos, col });
  }

  function start(img) {
    const P = sampleImage(img);
    if (!P.pts.length) return photoOnly();
    const ps = 2.3 / P.h, pcx = P.w / 2, pcy = P.h / 2;
    for (let k = 0; k < COUNT; k++) {
      const j = k * 3;
      const p = P.pts[(Math.random() * P.pts.length) | 0];
      photoPos[j] = (p[0] - pcx) * ps;
      photoPos[j + 1] = -(p[1] - pcy) * ps;
      const lum = (p[2] + p[3] + p[4]) / 765;
      photoPos[j + 2] = (lum - 0.5) * 0.8 + (Math.random() - 0.5) * 0.05;
      photoCol[j] = Math.min(1, p[2] / 255 * 1.08);
      photoCol[j + 1] = Math.min(1, p[3] / 255 * 1.08);
      photoCol[j + 2] = Math.min(1, p[4] / 255 * 1.08);
      cur[j] = photoPos[j]; cur[j + 1] = photoPos[j + 1]; cur[j + 2] = photoPos[j + 2];
      curC[j] = photoCol[j]; curC[j + 1] = photoCol[j + 1]; curC[j + 2] = photoCol[j + 2];
    }

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
    catch (e) { return photoOnly(); }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 3.25;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(cur, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(curC, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.022, vertexColors: true, transparent: true,
      opacity: 0.96, depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; // cloud is always near origin; avoids bounding-sphere recompute
    scene.add(points);

    let lastW = 0;
    const resize = () => { const s = wrap.clientWidth || 360; lastW = s; renderer.setSize(s, s, false); };
    resize();
    window.addEventListener("resize", resize);

    let mx = 0, my = 0;
    window.addEventListener("mousemove", (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // sections that carry a SQL query
    const zones = [...document.querySelectorAll("[data-sql]")].map((el) => ({ el, sql: el.getAttribute("data-sql") }));

    const ease = (t) => t * t * (3 - 2 * t);
    let t = 0;

    function pickTarget() {
      const mid = window.innerHeight / 2;
      let best = null, bestD = Infinity;
      for (const z of zones) {
        const r = z.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bestD) { bestD = d; best = z; }
      }
      if (best) { const tt = buildText(best.sql); targetP = tt.pos; targetC = tt.col; }
    }

    function tick() {
      // keep canvas resolution in sync when the panel resizes (e.g. docking)
      const cw = wrap.clientWidth;
      if (cw && Math.abs(cw - lastW) > 1) { lastW = cw; renderer.setSize(cw, cw, false); }

      // dissolve: photo at the very top, fully particles after ~0.55 viewport
      const d = ease(Math.min(1, Math.max(0, (window.scrollY - 0.08 * window.innerHeight) / (0.5 * window.innerHeight))));
      pickTarget();

      for (let i = 0; i < COUNT * 3; i++) {
        let dp = photoPos[i] * (1 - d) + targetP[i] * d;
        let dc = photoCol[i] * (1 - d) + targetC[i] * d;
        if (!Number.isFinite(dp)) dp = photoPos[i];
        if (!Number.isFinite(dc)) dc = photoCol[i];
        cur[i] += (dp - cur[i]) * 0.09;
        curC[i] += (dc - curC[i]) * 0.09;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      t += 0.01;
      const lead = 1 - d;
      points.rotation.y = (Math.sin(t) * 0.16 + mx * 0.4) * lead;
      points.rotation.x = (Math.cos(t * 0.7) * 0.05 + my * 0.22) * lead;
      mat.size = 0.022 + d * 0.004;

      photo.style.opacity = String(Math.max(0, 1 - d * 1.6));
      if (hint) hint.style.opacity = String(Math.max(0, 1 - d * 4));

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => start(img);
  img.onerror = photoOnly;
  img.src = "assets/img/profile.jpg";
})();
