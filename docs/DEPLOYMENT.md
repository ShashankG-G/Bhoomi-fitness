# Deploying Bhoomi Fitness — step by step

This gets everything live using **GitHub Pages** for the three frontends
(website, member app, staff app) and **Render** for the backend — no
Vercel/Netlify/Railway accounts needed. GitHub Pages is static-only, so it
genuinely cannot run the Python backend or hold a database; Render is the
one piece of infrastructure that has to live outside GitHub. Budget about
30-45 minutes the first time.

Accounts you'll need: GitHub (you already have this) and Render
(render.com — free tier covers a single gym's traffic fine).

---

## 0. One-time local tools

You'll need `git` and a terminal. Node.js 18+ and Python 3.11+ are only
needed if you want to run things locally first (recommended once) — see
each folder's own README.

---

## 1. Push this repo to GitHub

```bash
cd bhoomi-fitness
git init
git add .
git commit -m "Initial Bhoomi Fitness app system"
```

Create a new **empty** repository on GitHub (no README/license — you
already have one). Go to github.com/new, name it e.g. `bhoomi-fitness`
(the name matters a little — GitHub Pages URLs are based on it, see step 3),
then:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/bhoomi-fitness.git
git push -u origin main
```

---

## 2. Deploy the backend (Render)

1. Go to render.com → **New +** → **Web Service** → connect your GitHub
   account → pick the `bhoomi-fitness` repo.
2. Set **Root Directory** to `backend`. Render will detect the `Dockerfile`
   automatically — leave **Runtime** as **Docker**.
3. Pick the **Free** instance type to start.
4. **Add a database**: separately, **New +** → **PostgreSQL** → give it a
   name → **Free** plan → **Create Database**. Once it's up, copy its
   **Internal Connection String** (Render's dashboard shows this on the
   database's page — use the *internal* one since your web service and
   database live in the same Render account/region, it's faster and doesn't
   count against external bandwidth).
5. Back on the **backend** web service → **Environment**, add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Postgres **Internal Connection String** you just copied |
   | `JWT_SECRET` | a long random string — generate with `openssl rand -hex 32` |
   | `MASTER_KEY` | a **different** long random string — this is your hidden admin password, save it in a password manager, you won't see it again in any UI |
   | `BACKEND_ENV` | `production` |
   | `CORS_ORIGINS` | leave as `http://localhost:5173,http://localhost:5174` for now — you'll update this in step 4 |

6. **Create Web Service**. First deploy takes a few minutes. Render gives
   you a public URL like `https://bhoomi-fitness.onrender.com` — copy it,
   you need it for steps 3 and 4.

7. **Seed the database** (workout library, cafeteria menu, default staff
   login) — one-time. On the web service page, open the **Shell** tab and
   run:

   ```bash
   python -m app.seed
   ```

   This prints a default staff login — **write it down**, then change the
   password before real staff start using it (see the go-live checklist).

8. Sanity check: visit `https://<your-render-url>/api/workouts/library` in a
   browser — you should get back a JSON list of 20 exercises. If not, check
   **Logs** on the Render service first.

**About the free tier**: Render's free web services sleep after ~15 minutes
of no traffic and take 30-60 seconds to wake up on the next request. That's
fine for a soft launch — the first person to open the app after a quiet
spell just sees a slow load, not an error. If that's a problem once you have
real members, Render's cheapest paid tier (~$7/mo) removes the sleep.

---

## 3. Point the repository variable at your backend

Before the frontends can talk to the backend, tell GitHub Actions the
backend's URL:

1. On GitHub: your repo → **Settings → Secrets and variables → Actions →
   Variables** tab → **New repository variable**.
2. Name: `BACKEND_API_URL`. Value: your Render URL from step 2.6, e.g.
   `https://bhoomi-fitness.onrender.com` (no trailing slash).

This is a plain *variable*, not a secret — it ends up embedded in public
client-side JavaScript either way, so there's nothing to hide.

---

## 4. Turn on GitHub Pages

1. Repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. A workflow is already included at
   `.github/workflows/deploy-pages.yml` — it builds all three frontends
   (website, client-app, master-app) and publishes them together as one
   site: website at the root, member app at `/app/`, staff app at `/staff/`.
   It triggers automatically on every push to `main` that touches any of
   those folders.
4. Trigger the first run: go to the **Actions** tab → **Deploy to GitHub
   Pages** → **Run workflow** → **Run workflow** (or just push any small
   change). Watch it go green.
5. Once it finishes, your site is live at:

   - `https://<your-username>.github.io/bhoomi-fitness/` — website
   - `https://<your-username>.github.io/bhoomi-fitness/app/` — member app
   - `https://<your-username>.github.io/bhoomi-fitness/staff/` — staff app

   (If you named the repo something other than `bhoomi-fitness`, the
   workflow adapts automatically — it uses the repo's actual name.)

**Camera access note (staff app)**: QR scanning needs the camera, which
browsers only allow over HTTPS or `localhost`. GitHub Pages serves
everything over HTTPS, so this just works once deployed.

---

## 5. Connect the pieces: update CORS

Now that your GitHub Pages site exists, go back to Render → your backend
service → **Environment**, and update:

```
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,https://<your-username>.github.io
```

Notice this is **one origin** for all three frontends — website, member
app, and staff app are all served from `https://<your-username>.github.io`
(just different paths), so CORS only needs to allow that single origin, not
three. Save it; Render redeploys automatically.

---

## 6. Go-live checklist

- [ ] Change the default staff password (`frontdesk` / the one printed by
      `python -m app.seed`) — for now, easiest via Render's Postgres data
      tab, or ask me to add a proper "change password" endpoint.
- [ ] Confirm `MASTER_KEY` and `JWT_SECRET` on Render are the long random
      values you generated, not placeholder text.
- [ ] Visit `https://<your-render-url>/admin`, log in with your
      `MASTER_KEY`, confirm you can see members/entries/workouts/cafeteria
      data. This URL isn't linked from either app — bookmark it privately.
- [ ] Walk the real flow once end to end: sign up as a test member on the
      member app → get the OTP from Render's **Logs** tab (real email isn't
      wired up yet, see below) → log in → get QR → staff app scans it →
      confirm "no active membership" shows → activate membership from the
      staff app's Lookup tab → scan again → confirm entry is allowed.
- [ ] Place a cafeteria order as the test member, mark it ready from the
      staff app, confirm the member's screen updates.
- [ ] Decide on real OTP delivery (below) before onboarding real members.

### Turning on real OTP email delivery

Add these to the backend's Render environment variables and it redeploys
automatically — no code changes needed:

```
SMTP_HOST=smtp.<your-provider>.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@yourdomain.in
```

Any transactional email provider works (Resend, Postmark, Brevo, or a Gmail
app-password for very low volume to start). Phone-number logins still fall
back to server logs until an SMS provider (Twilio, MSG91, etc.) is wired
into `backend/app/notifications.py` — the TODO there marks exactly where.

---

## Updating the site later

Any push to `main` that touches `website/`, `client-app/`, or `master-app/`
re-runs the Pages workflow automatically and republishes. Any push that
touches `backend/` triggers a new Render deploy automatically too (Render
watches the repo the same way). Nothing needs to be re-triggered by hand
day to day.

---

## What I'd deliberately leave as-is for a v1 launch, and why

- **Cafeteria stays pay-at-counter.** Wiring Razorpay is maybe a day of
  focused work, but it requires completing Razorpay's business KYC (PAN,
  bank account, possibly GST) first — that's paperwork only you can do.
  Once that account exists, say the word and I'll wire the integration in.
- **No native iOS/Android app store listing.** Both apps are installable
  PWAs — on Android, Chrome prompts "Add to Home Screen" automatically; on
  iPhone, Safari → Share → "Add to Home Screen" does the same. They then
  behave like installed apps (own icon, full-screen, offline app shell). If
  you later want App Store/Play Store presence specifically for
  discoverability, that's a separate scoped project (React Native rebuild +
  developer accounts + store review), not an extension of these PWAs.
- **No separate "DR server."** Your original sketch had a disaster-recovery
  virtual server IT activates if the main one goes down. Render's managed
  Postgres already takes automatic backups, and Render handles service
  failover itself — a hand-rolled DR server would be strictly worse
  reliability for a single-location gym than what the managed platform
  already gives you for free. Worth revisiting if you run multiple
  locations or this becomes mission-critical infrastructure.
