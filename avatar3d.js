/* ============================================================
   Particle avatar.
   - Desktop (>=1100px): pinned to the right; starts as the photo,
     morphs into the SQL of the section in view.
   - Mobile/tablet: the canvas snaps over each section's reserved
     square "slot" as you reach it; the pixels scatter and
     reassemble into that section's SQL. In the hero it is the photo.
   Falls back to a static photo without WebGL / reduced motion.
   ============================================================ */
(function () {
  const av = document.getElementById("avatar3d");
  const canvas = document.getElementById("avatarCanvas");
  const photo = document.getElementById("avatarPhoto");
  const hint = document.getElementById("avatarHint");
  const heroAnchor = document.getElementById("heroAnchor");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const photoOnly = () => {
    if (canvas) canvas.style.display = "none";
    if (photo) photo.style.opacity = "1";
    if (hint) hint.style.display = "none";
  };
  if (!av || !canvas || !photo || !heroAnchor || !window.THREE || reduce) return photoOnly();

  const mqDesktop = matchMedia("(min-width: 1100px)");
  const COUNT = window.innerWidth < 700 ? 5200 : 9000;
  const photoPos = new Float32Array(COUNT * 3);
  const photoCol = new Float32Array(COUNT * 3);
  const cur = new Float32Array(COUNT * 3);
  const curC = new Float32Array(COUNT * 3);
  let targetP = photoPos, targetC = photoCol;
  const textCache = {};

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

  function buildText(sql) {
    if (textCache[sql]) return textCache[sql];
    const w = 480, h = 480;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    const lines = wrapLines(sql, 15);
    const longest = Math.max(...lines.map((l) => l.length));
    const fs = Math.max(20, Math.min(46, Math.floor((w - 48) / (longest * 0.62))));
    const lh = fs * 1.5;
    x.fillStyle = "#fff";
    x.textBaseline = "top";
    x.font = `bold ${fs}px "JetBrains Mono", monospace`;
    let y = (h - lines.length * lh) / 2;
    for (const l of lines) { x.fillText(l, 26, y); y += lh; }
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
    points.frustumCulled = false;
    scene.add(points);

    let lastW = 0, lastH = 0;
    function sizeTo(w, h) {
      w = Math.round(w); h = Math.round(h);
      if (w < 2 || h < 2 || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    let mx = 0, my = 0;
    window.addEventListener("mousemove", (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    const heroEl = document.querySelector(".hero");
    const zones = [...document.querySelectorAll("section[data-sql]")]
      .map((el) => ({ el, sql: el.getAttribute("data-sql") }));
    const slots = [...document.querySelectorAll(".sql-slot")]
      .map((el) => ({ el, sql: el.getAttribute("data-sql") }));

    const ease = (t) => t * t * (3 - 2 * t);
    let t = 0, mode = null, anchorEl = null;

    function scatter() {
      for (let i = 0; i < COUNT * 3; i++) cur[i] = (Math.random() - 0.5) * 3.0;
    }

    function desktopTarget() {
      const mid = window.innerHeight / 2;
      let best = null, bd = Infinity;
      for (const z of zones) {
        const r = z.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bd) { bd = d; best = z; }
      }
      if (best) { const tt = buildText(best.sql); targetP = tt.pos; targetC = tt.col; }
    }

    function mobileAnchor() {
      // stay on the hero photo while the hero fills the screen
      if (window.scrollY < (heroEl ? heroEl.offsetHeight : window.innerHeight) * 0.5) {
        return { el: heroAnchor, sql: null };
      }
      const line = window.innerHeight * 0.4;
      let best = null, bd = Infinity;
      for (const s of slots) {
        const r = s.el.getBoundingClientRect();
        const c = (r.top + r.bottom) / 2;
        const d = Math.abs(c - line);
        if (d < bd) { bd = d; best = s; }
      }
      return best || { el: heroAnchor, sql: null };
    }

    function tick() {
      const desktop = mqDesktop.matches;

      if (desktop) {
        if (mode !== "d") { mode = "d"; anchorEl = null; av.style.cssText = ""; }
        const d = ease(Math.min(1, Math.max(0, (window.scrollY - 0.08 * window.innerHeight) / (0.5 * window.innerHeight))));
        desktopTarget();
        sizeTo(av.clientWidth, av.clientWidth);
        for (let i = 0; i < COUNT * 3; i++) {
          let dp = photoPos[i] * (1 - d) + targetP[i] * d;
          let dc = photoCol[i] * (1 - d) + targetC[i] * d;
          if (!Number.isFinite(dp)) dp = photoPos[i];
          if (!Number.isFinite(dc)) dc = photoCol[i];
          cur[i] += (dp - cur[i]) * 0.09;
          curC[i] += (dc - curC[i]) * 0.09;
        }
        const lead = 1 - d;
        points.rotation.y = (Math.sin(t) * 0.16 + mx * 0.4) * lead;
        points.rotation.x = (Math.cos(t * 0.7) * 0.05 + my * 0.22) * lead;
        mat.size = 0.022 + d * 0.004;
        photo.style.opacity = String(Math.max(0, 1 - d * 1.6));
        if (hint) hint.style.opacity = String(Math.max(0, 1 - d * 4));
      } else {
        if (mode !== "m") { mode = "m"; anchorEl = null; }
        const a = mobileAnchor();
        const r = a.el.getBoundingClientRect();
        av.style.position = "fixed";
        av.style.transform = "none";
        av.style.right = "auto";
        av.style.left = r.left + "px";
        av.style.top = r.top + "px";
        av.style.width = r.width + "px";
        av.style.height = r.height + "px";
        sizeTo(r.width, r.height);

        if (a.el !== anchorEl) { anchorEl = a.el; scatter(); }

        if (a.sql == null) { targetP = photoPos; targetC = photoCol; }
        else { const tt = buildText(a.sql); targetP = tt.pos; targetC = tt.col; }
        const isPhoto = a.sql == null;

        for (let i = 0; i < COUNT * 3; i++) {
          let dp = targetP[i], dc = targetC[i];
          if (!Number.isFinite(dp)) dp = 0;
          if (!Number.isFinite(dc)) dc = 0.6;
          cur[i] += (dp - cur[i]) * 0.1;
          curC[i] += (dc - curC[i]) * 0.1;
        }
        const lead = isPhoto ? 1 : 0.18;
        points.rotation.y = Math.sin(t) * 0.12 * lead;
        points.rotation.x = 0;
        mat.size = isPhoto ? 0.022 : 0.02;
        photo.style.opacity = isPhoto ? "1" : "0";
        if (hint) hint.style.opacity = isPhoto ? "1" : "0";
      }

      t += 0.01;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
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
