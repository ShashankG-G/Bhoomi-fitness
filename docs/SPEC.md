# Bhoomi Fitness — Build Spec

This file is the single source of truth for everyone building a piece of this
project. Read it fully before writing code. All four workstreams (website,
backend, client-app, master-app) must agree with this contract exactly.

## Brand

- Name: **Bhoomi Fitness**
- Location: Kengeri, Bengaluru, Karnataka, India
- Tone: premium, confident, cinematic — think the title-sequence energy of
  *Suits* (Harvey Specter) and *The Mentalist* (Patrick Jane): sharp dark
  backgrounds, slow confident reveals, crisp typography, restrained gold/brass
  or steel-blue accent on near-black, subtle parallax and scroll-triggered
  motion rather than gimmicky effects. Never cheesy/neon "gym bro" style.
- Currency: INR (₹)

## Repo layout (this monorepo)

```
bhoomi-fitness/
  website/        static marketing site   \
  client-app/      React+Vite PWA, members  } one combined GitHub Pages site
  master-app/      React+Vite PWA, staff    / (website at /, apps at /app/, /staff/)
  backend/         FastAPI app -> Render (GitHub Pages can't run a server/DB)
  docs/            this spec + deployment guide
```

> Updated after the initial build: the three frontends were consolidated
> onto one GitHub Pages deployment (see
> `.github/workflows/deploy-pages.yml`) instead of separate Vercel/Netlify
> projects, and the backend moved from Railway to Render — both purely
> hosting-choice changes, the API contract below is unaffected.

Each app is self-contained with its own package.json / requirements.txt so it
can be deployed independently. Do not add cross-imports between them.

## Environment variables (backend)

- `DATABASE_URL` — Postgres URL in prod (Render provides this), falls back to
  local `sqlite:///./bhoomi.db` in dev if unset.
- `JWT_SECRET` — secret for signing member/staff bearer tokens.
- `MASTER_KEY` — the hidden admin master key. Compared via hash, never logged,
  never exposed to any member/staff-facing endpoint or response.
- `BACKEND_ENV` — `development` | `production`. In development, OTP responses
  include `dev_code` so you can test without a real email/SMS provider wired
  up. In production this field must never be present in the response.
- `CORS_ORIGINS` — comma separated list of allowed frontend origins.
- `SMTP_*` (optional) — if set, real emails are sent for OTP codes instead of
  just being logged; if unset, codes are printed to server logs (fine for a
  soft launch where staff hands out the phone-based flow instead).

## Auth model

Two separate identities, two separate token types:

1. **Member** — the gym-goer, using the client-app. Logs in with
   email-or-phone + a 5-digit one-time code (no password). This *is* signup
   too — first successful verify creates the Member row. Matches the
   flowchart's combined "Login, Signup" box.
2. **Staff** — gym front-desk/trainers, using the master-app. Logs in with a
   username + password that Shashank (or the hidden admin panel) provisions
   for them. Staff tokens are scoped `role=staff` and can never read the
   master-key-only admin data.

There is also a third, invisible tier:

3. **Master admin** — Shashank only. Not reachable from either app's UI.
   `/admin` on the backend is a server-rendered (Jinja2) panel that asks for
   the `MASTER_KEY` as a password, sets an HttpOnly cookie, and shows
   everything: every member, every entry log, every workout session, every
   cafeteria order and implied revenue, and lets Shashank grant/revoke
   memberships. Members and staff have no way to discover this exists — it's
   not linked from any public page or app screen.

## Membership gating (matches the flowchart)

The public website has **no self-serve subscription purchase** — subscriptions
are "Coming Soon" per Shashank's instruction. So in the app: a member can sign
up (email/phone + code) freely, but `has_active_membership` starts `false`.
Only staff (front desk, cash or marked-online) or the master admin panel can
flip it to `true` with a `valid_until` date, mirroring the "Reach out to Gym
Staff → Cash/Online → Gym App unlocked" branch in the drawing. The client-app
must show a friendly "see the front desk to activate your membership" screen
when `has_active_membership` is false, instead of the workout dashboard.

## Rotating QR / entry flow

- On login, the client-app polls `GET /api/auth/qr-payload` (Bearer token)
  every ~25 seconds.
- Server computes a TOTP code (using `pyotp`, 30s step) from a per-member
  secret (`qr_secret`, generated once at signup, never shown in UI, never
  sent anywhere except embedded inside the signed payload).
- Response: `{ "payload": "<opaque base64 string>", "code": "12345",
  "expires_in": 30 }`. `payload` is what's encoded into the QR image
  (client-app renders it with `qrcode.react` or similar). `code` is the
  human-readable 5-digit fallback shown under the QR for a staff member to
  type in manually if a camera isn't handy.
- The master-app scans the QR (camera, e.g. `html5-qrcode` or
  `@zxing/browser`) and POSTs the decoded `payload` (or a manually typed
  `code` + `identifier`) to `POST /api/entry/verify`. Backend re-derives the
  TOTP for that member and window, checks it matches and hasn't already been
  used for entry in this window (replay protection), checks
  `has_active_membership`, and returns an allow/deny decision plus the
  member's name/photo for the staff screen to display. Every attempt is
  logged to `EntryLog` (visible only in the master admin panel).

## Full API contract (backend implements this exactly; frontends call it exactly)

Base path: `/api`. All bodies/responses JSON. Bearer auth via
`Authorization: Bearer <token>` unless noted.

### Member auth
- `POST /api/auth/request-code` — body `{ "identifier": "email-or-phone" }` →
  `{ "message": "code sent", "dev_code": "12345" }` (dev_code only when
  `BACKEND_ENV=development`)
- `POST /api/auth/verify-code` — body `{ "identifier": "...", "code":
  "12345" }` → `{ "access_token": "...", "token_type": "bearer", "member": {
  "id", "name", "identifier", "has_active_membership" } }`
- `GET /api/auth/me` (member bearer) → member profile
- `PATCH /api/auth/me` (member bearer) — body `{ "name": "..." }` (member sets
  their display name once, since signup has no name field)
- `GET /api/auth/qr-payload` (member bearer) → `{ "payload", "code",
  "expires_in" }`

### Entry
- `POST /api/entry/verify` (staff bearer) — body `{ "payload": "..." }` OR `{
  "code": "12345", "identifier": "..." }` → `{ "allow": bool, "member": {
  "name", "has_active_membership" } | null, "reason": "ok" | "expired" |
  "no_membership" | "invalid" | "not_found" }`

### Workouts (member bearer unless noted)
- `GET /api/workouts/library` (public, no auth) → `[{ "id", "name",
  "muscle_group", "instructions", "animation_url", "default_sets",
  "default_reps" }]`
- `POST /api/workouts/sessions` → `{ "session_id" }`
- `POST /api/workouts/sessions/{id}/sets` — body `{ "exercise_id",
  "set_number", "reps", "weight_kg", "calories_est" }`
- `POST /api/workouts/sessions/{id}/finish` — body `{ "duration_seconds",
  "total_calories" }`
- `GET /api/workouts/history?months=2` → sessions grouped by date with sets

### Cafeteria (member bearer unless noted)
- `GET /api/cafeteria/menu` (public, no auth) → `[{ "id", "name",
  "description", "price_inr", "category", "image_url", "available" }]`
- `POST /api/cafeteria/orders` — body `{ "items": [{ "menu_item_id", "qty" }],
  "notes" }` → `{ "order_id", "status": "placed", "total_inr" }`
- `GET /api/cafeteria/orders/mine` → list with status
- `GET /api/cafeteria/orders/{id}/status` (polled every ~5s while an order is
  open) → `{ "status": "placed" | "preparing" | "ready" | "completed" }`

### Staff (staff bearer)
- `POST /api/staff/login` — body `{ "username", "password" }` → `{
  "access_token", "token_type": "bearer" }`
- `GET /api/staff/members?query=` — search by phone/email/name
- `POST /api/staff/members/{id}/activate-membership` — body `{ "plan",
  "valid_until", "payment_method": "cash"|"online" }`
- `GET /api/staff/cafeteria/orders?status=placed`
- `PATCH /api/staff/cafeteria/orders/{id}` — body `{ "status":
  "preparing"|"ready"|"completed" }`

### Master admin (cookie session, not part of the JSON API — server-rendered)
- `GET /admin` — login form (posts the master key)
- `GET /admin/dashboard` — overview: members online now (last N entries),
  today's revenue estimate, counts
- `GET /admin/members`, `/admin/entries`, `/admin/workouts`,
  `/admin/cafeteria` — full tables with basic filters
- All under `/admin/*`, guarded by the master-key cookie, CSS dark/minimal,
  no link to it anywhere else in the system.

## Design language for the two PWAs (client-app, master-app)

Simpler and more utilitarian than the marketing site — these are tools people
use daily, not a cinematic experience. Dark theme matching the brand (near
black background, brass/steel accent), big tap targets (used at a gym, often
one-handed / sweaty fingers), installable (manifest.json + service worker),
mobile-first layout. Keep animation minimal here: transitions, not spectacle.

## What is explicitly out of scope for this build (call out, don't build)

- Real payment gateway integration (cafeteria is pay-at-counter for v1;
  membership activation is recorded by staff, not paid in-app)
- Native iOS/Android apps / app-store submission
- Real push notifications requiring VAPID/APNs setup (client-app polls order
  status instead; note in deploy docs how to upgrade to real Web Push later)
- A literal secondary "DR server" — call this out in the deployment guide as
  something Render/managed Postgres already gives you (automatic backups,
  redundancy) rather than something to hand-build
