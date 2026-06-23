# Georgios Miltos — Online CV

A modern, single-page CV / portfolio website. Dark theme with neon gradients,
glassmorphism cards, scroll animations and an animated particle-network background.

🔗 **Live:** https://miltos9.github.io/online_cv/

## Stack
- Plain **HTML / CSS / JavaScript** — no build step, no framework
- [GSAP](https://gsap.com) (loaded via CDN, optional motion)
- [Lucide](https://lucide.dev) icons (CDN)
- Google Fonts: Sora · Inter · JetBrains Mono
- AI-generated hero graphic

## Structure
```
index.html        # all content + markup
styles.css        # design system (dark + neon gradient)
script.js         # reveals, skill bars, particle network, nav
assets/img/       # profile + hero images
.github/workflows/deploy.yml  # auto-deploy to GitHub Pages
```

## Edit the content
All text lives directly in `index.html` — search for the relevant section
(`#about`, `#experience`, `#skills`, `#certs`, `#contact`) and edit inline.

## Run locally
No tooling needed — just open `index.html`, or serve it:
```bash
python -m http.server 8000   # then visit http://localhost:8000
```

## Deploy
Pushing to `master` (or `main`) triggers the GitHub Actions workflow, which
publishes the site to GitHub Pages.
**One-time setup:** in the repo → *Settings → Pages → Build and deployment →
Source*, select **GitHub Actions**.
