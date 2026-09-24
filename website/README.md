# Bhoomi Fitness — Website

The public marketing site for Bhoomi Fitness (Kengeri, Bengaluru). Plain
HTML/CSS/JS, no build step, no dependencies to install — it's just static
files, ready for GitHub Pages. The only external calls are two CDN
`<script>` tags (GSAP + ScrollTrigger, loaded with `defer`) and Google
Fonts; everything else is self-contained in this folder.

See `/docs/SPEC.md` at the repo root for the brand and repo-wide
conventions this site follows. (Deployment instructions for GitHub Pages
are covered separately in the docs, not here — this README is local
preview only.)

## Preview locally

Any static file server works. From this `website/` folder, pick one:

```bash
# Option 1 — no install required (Node.js)
npx serve .

# Option 2 — Python 3 (already on most machines)
python3 -m http.server 8000

# Option 3 — just open it directly
# Double-click index.html, or open it from your browser with File > Open.
# (Everything works this way too, since there's no build step and no
# routing — the Google Maps iframe and CDN scripts still need an internet
# connection either way.)
```

Then visit the printed URL (typically `http://localhost:3000` for
`serve` or `http://localhost:8000` for Python's server).

## Folder structure

```
website/
  index.html       all page content/markup
  css/style.css     all styles
  js/main.js        nav toggle, scroll header, membership form, GSAP reveals
  README.md         this file
```

## Notes for whoever picks this up next

- The **Membership** section's email form intentionally posts nowhere
  yet — see the HTML comment directly above `<form id="membership-form">`
  in `index.html` for where a real backend endpoint should be wired in.
- The **Member Login** / **Staff App** links are placeholders (`href="#"`)
  with `TODO(deploy)` comments in `index.html` — swap them for the live
  `client-app` / `master-app` URLs once those are deployed.
- Animations (fades/parallax via GSAP ScrollTrigger) are progressive
  enhancement: if the CDN scripts fail to load, or the visitor has
  "reduce motion" turned on, the page still renders fully and correctly
  with everything visible — see the `.js-anim` note in `css/style.css`.
- All facility photos are placeholder images from picsum.photos, clearly
  labelled as illustrative — swap for real photography when available.
