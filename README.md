# Bhoomi Fitness — full app system

Kengeri, Bengaluru. This repo contains everything for the gym: the public
marketing website, the backend API, the member app, and the staff app.

```
bhoomi-fitness/
  website/        Marketing site (static HTML/CSS/JS)          \
  client-app/      Member PWA (QR entry, workouts, cafeteria)    } one combined
  master-app/      Staff PWA (scanner, membership, queue)       / GitHub Pages site
  backend/         FastAPI API + hidden master-admin panel -> Render
  docs/SPEC.md     The API contract / architecture spec everything was built against
```

The website, client-app, and master-app all publish to **one GitHub Pages
site** from this same repo — no Vercel/Netlify account needed. Deployed, they
live at:

- `https://<your-username>.github.io/bhoomi-fitness/` — website
- `https://<your-username>.github.io/bhoomi-fitness/app/` — member app
- `https://<your-username>.github.io/bhoomi-fitness/staff/` — staff app

Only the backend needs a separate host, since GitHub Pages can't run a
server or a database — it deploys to Render (free tier). Start with
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for exact, copy-paste steps.

Each subfolder also has its own README with local dev instructions
(`npm install && npm run dev`, or the Python venv steps for the backend).

## What's real vs. what's a placeholder right now

Everything **works end-to-end today** against a local test run: signup,
login, rotating QR entry, membership activation, workout logging, cafeteria
ordering, staff order queue, and the hidden admin panel were all exercised
live during the build (see docs/DEPLOYMENT.md for how to do the same). Two
things are intentionally left as swap-in points rather than fully built,
because they need real-world accounts/credentials only you can create:

1. **OTP delivery** — codes are logged to the server console (and shown
   directly in the app in dev mode) instead of being emailed/texted. Wiring
   real email is a few minutes with any SMTP provider (see DEPLOYMENT.md);
   real SMS needs a provider like Twilio/MSG91 wired into
   `backend/app/notifications.py` (clearly marked with a TODO).
2. **Cafeteria payment** — orders are placed and paid at the counter for now
   (per your call in the interview). Wiring a real gateway (Razorpay is the
   natural choice in India) is a scoped follow-up, not a rebuild.

Exercise demo images/GIFs and facility photos on the website are placeholder
URLs, clearly marked in the code — swap them for real gym photos/media
whenever you have them.
