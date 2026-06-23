/* ===== Icons ===== */
if (window.lucide) lucide.createIcons();

/* ===== Year ===== */
document.getElementById("year").textContent = new Date().getFullYear();

/* ===== Nav: scrolled state, mobile menu, active link ===== */
const nav = document.getElementById("nav");
const navLinks = document.getElementById("navLinks");
const burger = document.getElementById("burger");

const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

burger.addEventListener("click", () => navLinks.classList.toggle("open"));
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => navLinks.classList.remove("open"))
);

/* Active link on scroll */
const sections = [...document.querySelectorAll("section[id]")];
const linkFor = (id) => navLinks.querySelector(`a[href="#${id}"]`);
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      const link = linkFor(e.target.id);
      if (link && e.isIntersecting) {
        navLinks.querySelectorAll("a").forEach((a) => a.classList.remove("active"));
        link.classList.add("active");
      }
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
sections.forEach((s) => spy.observe(s));

/* ===== Reveal on scroll ===== */
const reveals = document.querySelectorAll("[data-reveal]");
const revObs = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("in"), (i % 4) * 90);
        obs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
reveals.forEach((el) => revObs.observe(el));

/* ===== Animate skill bars when in view ===== */
const skillObs = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const fill = e.target.querySelector(".bar i");
        fill.style.width = e.target.dataset.level + "%";
        obs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.4 }
);
document.querySelectorAll(".skill").forEach((s) => skillObs.observe(s));

/* ===== Subtle parallax on hero visual ===== */
const visual = document.querySelector(".hero__visual");
if (visual && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.addEventListener("scroll", () => {
    const y = Math.min(window.scrollY, 600);
    visual.style.transform = `translateY(${y * 0.08}px)`;
  }, { passive: true });
}

/* ===== Particle network background ===== */
(function network() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("net");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, pts, raf;
  const COUNT = window.innerWidth < 700 ? 28 : 60;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 130) {
          ctx.strokeStyle = `rgba(120,160,255,${(1 - dist / 130) * 0.25})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    for (const p of pts) {
      ctx.fillStyle = "rgba(150,180,255,0.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", () => { cancelAnimationFrame(raf); resize(); draw(); });
})();
