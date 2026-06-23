/* ============================================================
   3D particle portrait that morphs into an SQL query on scroll.
   - Portrait pixels -> 3D point cloud (depth from luminance)
   - Scrolling the hero lerps every particle toward SQL-code points
   - Rotates with mouse / idle while a portrait; faces front as code
   Falls back to a static photo if WebGL / Three.js unavailable
   or the user prefers reduced motion.
   ============================================================ */
(function () {
  const wrap = document.getElementById("avatar3d");
  const canvas = document.getElementById("avatarCanvas");
  const fallback = wrap && wrap.querySelector(".avatar-fallback");
  const hint = document.getElementById("avatarHint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const showFallback = () => {
    if (canvas) canvas.style.display = "none";
    if (fallback) fallback.style.display = "block";
    if (hint) hint.style.display = "none";
  };

  if (!wrap || !canvas || !window.THREE || reduce) return showFallback();

  const COUNT = window.innerWidth < 700 ? 5500 : 9000;
  const portrait = new Float32Array(COUNT * 3);
  const textPos = new Float32Array(COUNT * 3);
  const colA = new Float32Array(COUNT * 3); // portrait colours
  const colB = new Float32Array(COUNT * 3); // code colours
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);

  /* ---- sample the portrait into "ink" pixels ---- */
  function sampleImage(img) {
    const w = 150, h = 188;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 200 && g > 196 && b > 184) continue; // drop light background
        pts.push([px, py, r, g, b]);
      }
    }
    return { pts, w, h };
  }

  /* ---- render SQL to an offscreen canvas, sample lit pixels ---- */
  function sampleText() {
    const w = 520, h = 460;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.textBaseline = "top";
    x.font = 'bold 46px "JetBrains Mono", monospace';
    const lines = [
      "SELECT skills",
      "FROM   me",
      "WHERE  role =",
      " 'Data Engineer';",
    ];
    const lh = 64;
    let y = (h - lines.length * lh) / 2; // vertically centred
    for (const l of lines) { x.fillText(l, 26, y); y += lh; }
    const d = x.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let py = 0; py < h; py += 2) {
      for (let px = 0; px < w; px += 2) {
        if (d[(py * w + px) * 4 + 3] > 128) pts.push([px, py]);
      }
    }
    return { pts, w, h };
  }

  function build(img) {
    const P = sampleImage(img);
    const T = sampleText();
    if (!P.pts.length || !T.pts.length) return showFallback();

    const ps = 2.3 / P.h;          // uniform portrait scale (keeps aspect)
    const pcx = P.w / 2, pcy = P.h / 2;
    const ts = 2.9 / T.w;          // text scale (fills width)
    const tcx = T.w / 2, tcy = T.h / 2;

    for (let k = 0; k < COUNT; k++) {
      const j = k * 3;
      // portrait target
      const p = P.pts[(Math.random() * P.pts.length) | 0];
      portrait[j] = (p[0] - pcx) * ps;
      portrait[j + 1] = -(p[1] - pcy) * ps;
      const lum = (p[2] + p[3] + p[4]) / 765;
      portrait[j + 2] = (lum - 0.5) * 0.8 + (Math.random() - 0.5) * 0.05;
      colA[j] = Math.min(1, p[2] / 255 * 1.08);
      colA[j + 1] = Math.min(1, p[3] / 255 * 1.08);
      colA[j + 2] = Math.min(1, p[4] / 255 * 1.08);

      // text target
      const t = T.pts[(Math.random() * T.pts.length) | 0];
      textPos[j] = (t[0] - tcx) * ts;
      textPos[j + 1] = -(t[1] - tcy) * ts;
      textPos[j + 2] = (Math.random() - 0.5) * 0.12;
      const mix = Math.max(0, Math.min(1, (textPos[j] + 1.45) / 2.9));
      colB[j] = 0.18 + mix * 0.13;   // cyan -> blue gradient
      colB[j + 1] = 0.83 - mix * 0.34;
      colB[j + 2] = 1.0;

      // start as portrait
      pos[j] = portrait[j]; pos[j + 1] = portrait[j + 1]; pos[j + 2] = portrait[j + 2];
      col[j] = colA[j]; col[j + 1] = colA[j + 1]; col[j + 2] = colA[j + 2];
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) { return showFallback(); }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 3.25;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.02, vertexColors: true, transparent: true,
      opacity: 0.95, depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    function resize() {
      const s = wrap.clientWidth;
      renderer.setSize(s, s, false);
    }
    resize();
    window.addEventListener("resize", resize);

    // pointer parallax
    let mx = 0, my = 0;
    window.addEventListener("mousemove", (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    const ease = (t) => t * t * (3 - 2 * t); // smoothstep
    let t = 0;

    function tick() {
      const raw = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.62)));
      const p = ease(raw); // 0 = portrait, 1 = SQL

      for (let i = 0; i < COUNT * 3; i++) {
        pos[i] = portrait[i] + (textPos[i] - portrait[i]) * p;
        col[i] = colA[i] + (colB[i] - colA[i]) * p;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      t += 0.01;
      const lead = 1 - p; // settle to face-front as it becomes code
      // gentle 3D sway so the bust stays forward-facing (no full spin)
      points.rotation.y = (Math.sin(t) * 0.16 + mx * 0.4) * lead;
      points.rotation.x = (Math.cos(t * 0.7) * 0.05 + my * 0.22) * lead;
      mat.size = 0.023 + p * 0.004;

      if (hint) hint.style.opacity = String(Math.max(0, 1 - raw * 3));

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    if (fallback) fallback.style.display = "none";
    tick();
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => build(img);
  img.onerror = showFallback;
  img.src = "assets/img/profile.jpg";
})();
