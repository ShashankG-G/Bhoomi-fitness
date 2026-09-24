# Bhoomi Fitness — Backend

FastAPI backend for the Bhoomi Fitness gym app system (Kengeri, Bengaluru).
Implements the exact API contract in `../docs/SPEC.md` for the two frontend
PWAs (`client-app`, `master-app`) to build against.

## Stack

- **FastAPI** + **SQLAlchemy 2.0** (works against SQLite locally, Postgres in
  prod via `DATABASE_URL`)
- **python-jose** for member/staff JWT bearer tokens
- **pyotp** for the rotating TOTP entry code (the "QR code")
- **bcrypt** for staff password hashing
- **Jinja2** + **itsdangerous** for the server-rendered, cookie-gated
  `/admin` master panel
- Schema: `Base.metadata.create_all()` on startup (no Alembic). This is a
  deliberate simplicity choice for a single-operator deploy — see "Schema
  changes" below for how to evolve it later.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then edit .env if you want non-default secrets
python -m app.seed               # creates tables + seeds exercises/menu/staff
uvicorn app.main:app --reload    # http://127.0.0.1:8000
```

With no `.env` at all, the app still runs: it defaults to a local SQLite file
(`bhoomi.db`), `BACKEND_ENV=development`, and insecure-but-functional dev
secrets for `JWT_SECRET`/`MASTER_KEY`. Don't rely on those defaults in
production — set real values (see `.env.example`).

Interactive API docs (JSON endpoints only — the admin panel is deliberately
not advertised here): `http://127.0.0.1:8000/docs`

## Environment variables

See `.env.example` for the full commented list. Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URL in prod (Render provides this); defaults to `sqlite:///./bhoomi.db` |
| `JWT_SECRET` | Signs member/staff bearer tokens |
| `MASTER_KEY` | The hidden `/admin` panel's password. Never logged, never in any API response |
| `ADMIN_SESSION_SECRET` | Optional, separate secret for the admin cookie (derived from `JWT_SECRET` if unset) |
| `BACKEND_ENV` | `development` \| `production` — controls whether `dev_code` is returned from OTP requests |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` | Optional — if all five are set, OTP codes are emailed for email identifiers |

## OTP / dev-mode login

Member login is passwordless: `identifier` (email or phone) + a 5-digit code.

- `POST /api/auth/request-code` generates a random 5-digit code, stores only
  an HMAC hash of it (peppered with `JWT_SECRET`), and always logs it to the
  server console via `app/notifications.py:send_code()`.
- In `BACKEND_ENV=development`, the response also includes `"dev_code"` so
  you can log in without any real email/SMS provider. In
  `BACKEND_ENV=production` that field is fully absent from the JSON (not
  just `null`) — verified in the smoke test below.
- If `SMTP_*` env vars are all set, `send_code()` additionally emails the
  code via `smtplib` for email-shaped identifiers. Phone identifiers have no
  SMS provider wired up yet — see the `TODO(shashank)` in
  `app/notifications.py` for where to plug one in (e.g. MSG91, Twilio). Until
  then, phone logins rely on server logs / staff reading it off, per the
  SPEC's "soft launch" note.
- `POST /api/auth/verify-code` checks the code and, on first success for that
  identifier, creates the Member row (signup and login are the same action).

## Rotating QR / gym entry

- Each Member gets a `qr_secret` (via `pyotp.random_base32()`) at creation,
  stored server-side only — never returned in any API response.
- `GET /api/auth/qr-payload` (member bearer) computes a 5-digit TOTP code
  (30s step) and returns `{"payload", "code", "expires_in": 30}`. `payload`
  is a base64-encoded JSON blob (`{"m": member_id, "c": code, "t": issued_at}`)
  meant to be rendered as a QR code client-side.
- `POST /api/entry/verify` (staff bearer) accepts either `{"payload"}` or
  `{"code", "identifier"}`, re-derives the expected TOTP for the current and
  previous 30s windows, and checks it matches.
- **Replay protection**: each Member row tracks `last_entry_window` (the last
  TOTP window successfully used for entry). A repeat of that same window (or
  an older one) is rejected with `reason: "expired"` — this is the chosen
  mapping since the SPEC's reason enum doesn't have a dedicated "replay"
  value; it reads naturally as "that code has already been used/is stale."
- Every attempt (success or failure) is written to `EntryLog`, visible only
  in `/admin/entries`.

## Default staff login

Seeded by `python -m app.seed`:

```
username: frontdesk
password: Bhoomi@Front1
```

**Change this password before going live** — either add a staff-password-change
endpoint before launch, or update the row directly (e.g. via a one-off script
using `app.security.hash_password`). The seed script won't overwrite an
existing `frontdesk` row, so re-running it is safe.

## Master admin panel

`http://127.0.0.1:8000/admin` — a server-rendered (Jinja2), dark-themed panel
gated by `MASTER_KEY` (from your `.env`/environment). It is:

- Not part of the JSON API — no response anywhere else references `/admin`
  or the master key.
- Excluded from the OpenAPI schema (`/docs`, `/openapi.json` never list it).
- Protected by a signed, HttpOnly session cookie (`itsdangerous`,
  12h expiry) set only after `secrets.compare_digest(master_key, MASTER_KEY)`
  succeeds. Every `/admin/*` route except the login page/post redirects to
  `/admin` if that cookie is missing or invalid.

Pages: `/admin/dashboard` (overview stats + recent entries),
`/admin/members` (search/filter), `/admin/entries` (full entry log,
search/filter), `/admin/workouts` (exercise library + recent sessions),
`/admin/cafeteria` (menu + orders, filterable by status).

To log in locally: run the seed script + server as above, then visit
`/admin` and enter whatever you set `MASTER_KEY` to (or the insecure dev
default if you didn't set one — see `app/config.py`).

## Smoke-tested locally

This was built and exercised end-to-end against SQLite before considering it
done: venv created, deps installed, `python -m app.seed` run, `uvicorn`
started, and the following hit with `curl`:

- `GET /api/workouts/library`, `GET /api/cafeteria/menu` (public)
- `POST /api/auth/request-code` → `POST /api/auth/verify-code` → member JWT
- `GET /api/auth/me`, `PATCH /api/auth/me`
- `GET /api/auth/qr-payload` → `POST /api/staff/login` → `POST /api/entry/verify`
  (confirmed `no_membership` before activation, `ok` after, `expired` on a
  replayed payload/code, `not_found` for an unknown identifier)
- `POST /api/staff/members/{id}/activate-membership`, `GET /api/staff/members`
- Full workout session lifecycle: start → log a set → finish → history
- Full cafeteria order lifecycle: create → orders/mine → status → staff queue
  → staff status update
- `/admin` login (wrong key rejected, correct key sets cookie), and all five
  `/admin/*` pages loaded with real seeded data while unauthenticated
  requests correctly redirected to the login page
- Confirmed `dev_code` is present in `BACKEND_ENV=development` and **fully
  absent** (not just `null`) in `BACKEND_ENV=production`

Two bugs were caught and fixed during this pass: a missing `Request` type
annotation on the admin-auth dependency (was causing a 422 instead of a
redirect to `/admin`), and `dev_code` serializing as `null` instead of being
omitted in production (fixed with `response_model_exclude_none=True`).

## Deploying (Render)

Full step-by-step instructions are in `docs/DEPLOYMENT.md`; short version:

- The included `Dockerfile` is what Render builds from (Render's "Docker"
  runtime) — `Procfile` is kept too as a fallback if you ever switch to
  Render's native Python runtime instead.
- Create a Render **Postgres** instance and a Render **Web Service** from
  this repo (root directory `backend`) in the same way; Render exposes the
  Postgres instance's **Internal Connection String** for you to copy into
  the web service's `DATABASE_URL` variable — `psycopg2-binary` is already
  in `requirements.txt`, no code changes needed.
- Set `JWT_SECRET`, `MASTER_KEY`, `BACKEND_ENV=production`, `CORS_ORIGINS`
  (the GitHub Pages origin) as Render environment variables.
- Run `python -m app.seed` once against the prod database, via Render's
  **Shell** tab on the web service, to create tables and seed the exercise
  library, cafeteria menu, and default staff account. **Immediately change
  the default staff password after that.**
- Render's free web services spin down after periods of inactivity and take
  ~30-60s to wake back up on the next request — fine for a soft launch, but
  worth knowing so a "slow first load" isn't mistaken for a bug. Upgrading
  to a paid instance removes this.

### What's intentionally not built here (per SPEC's "out of scope")

- No real payment gateway — cafeteria is pay-at-counter; membership
  activation is recorded by staff, not paid in-app.
- No native app / app-store packaging.
- No real Web Push (VAPID/APNs) — the client-app polls order status instead.
  To upgrade later: add a `pywebpush`-based sender, store subscriptions
  per-member, and push on order status changes instead of (or alongside)
  polling `GET /api/cafeteria/orders/{id}/status`.
- No hand-built "DR server" — Render's managed Postgres already gives you
  automatic backups (and point-in-time recovery on paid plans); that's the
  right tool for this, not a custom secondary server.

## Schema changes

This project uses `Base.metadata.create_all()` rather than Alembic
migrations, by design, for deploy simplicity. If you need to change the
schema after there's real production data in Postgres:

1. For an additive change (new nullable column, new table), you can often
   just add it to `app/models.py` — `create_all()` will create new tables on
   next startup, but **will not** alter existing tables' columns.
2. For a column addition/change on an existing table, either write a small
   one-off `ALTER TABLE` script and run it against prod, or introduce Alembic
   at that point (`alembic init`, generate a migration from the model diff).
3. For local dev/SQLite, it's usually simplest to delete `bhoomi.db` and
   re-run `python -m app.seed`.
