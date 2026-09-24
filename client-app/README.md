# Bhoomi Fitness — Client App

The member-facing installable PWA for Bhoomi Fitness (Kengeri, Bengaluru).
Members log in with email/phone + a one-time code, show a rotating QR at
the front desk for entry, log workouts against the exercise library, and
order from the cafeteria.

Built with React + Vite, plain CSS, and `vite-plugin-pwa` for the
installable app shell (manifest + service worker, offline-caches static
assets only — API calls always hit the network).

## Getting started

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` by default.

## Configuration

The backend API base URL is read from the `VITE_API_URL` environment
variable at build/dev time. It defaults to `http://localhost:8000` (the
FastAPI backend's local dev address) if unset.

To point at a different backend, copy `.env.example` to `.env.local` and
set:

```
VITE_API_URL=https://your-backend-host
```

Never hardcode a production URL in source — always go through this env
var, so the same build can be pointed at different backends per
environment.

## Building for production

```bash
npm run build
```

Output is written to `dist/`. `npm run preview` serves that build locally
for a final sanity check before deploying.

## Deployment

This app is published to GitHub Pages alongside the website and the staff
app, as a `/app/` subpath of one combined Pages site — handled automatically
by `.github/workflows/deploy-pages.yml` at the repo root, not by anything
you run from this folder. Two env vars matter for that build:
`VITE_BASE_PATH` (the Pages subpath, set by the workflow) and `VITE_API_URL`
(the live backend URL, from the `BACKEND_API_URL` repository variable). Full
details in `../docs/DEPLOYMENT.md`.
