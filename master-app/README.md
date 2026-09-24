# Bhoomi Fitness — Staff App (master-app)

Installable PWA used by front-desk / cafeteria staff at Bhoomi Fitness
(Kengeri, Bengaluru) on a phone or tablet at the entrance and cafeteria
counter. Covers staff login, QR/manual entry scanning, member lookup and
membership activation, and the cafeteria order queue.

This app is one of four independent workstreams in the monorepo (see
`../docs/SPEC.md` for the full API contract it implements). It does not
import from or depend on any other folder in the repo.

## Requirements

- Node.js 18+ and npm
- The Bhoomi Fitness backend running and reachable (see `VITE_API_URL` below)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts the Vite dev server (default `http://localhost:5174` — deliberately
different from client-app's `5173` so you can run both apps side by side
locally against the same backend). By default the app talks to a backend at
`http://localhost:8000`.

### Configuring the API URL

The backend base URL is read from the `VITE_API_URL` environment variable at
build time, e.g.:

```bash
# .env.local (not committed)
VITE_API_URL=http://localhost:8000
```

Copy `.env.example` to `.env.local` and adjust as needed. If unset, the app
falls back to `http://localhost:8000`.

## Production build

```bash
npm run build
```

Outputs static files to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

## Camera permissions (important)

The entry scanner uses the device camera via `html5-qrcode`. Browsers only
grant camera access on:

- `http://localhost` (fine for local development), or
- a page served over **HTTPS** (required in any deployed/production
  environment).

A plain `http://` deployment (e.g. an internal IP over HTTP) will **not** be
able to request the camera — browsers block `getUserMedia` on insecure
origins outside localhost. If camera access is denied or unavailable for any
reason, the app clearly surfaces that and offers the manual entry fallback
(type the member's phone/email + their 5-digit code) so front desk can keep
working without a working camera.

## Deployment

This README only covers running the app locally. Actual deployment steps
(hosting target, environment variables in that environment, etc.) live in
`../docs/` alongside the rest of the monorepo's deployment guide.
