# Exam Platform — Setup & Deployment Guide

## What this is

A multi-exam platform where an admin creates exams with configurable parts,
sections, question counts, and timings. Candidates log in with OTP (email),
complete a one-time profile, and take exams. Scores only appear once all
parts of an exam are completed. Questions and answers are locked at the
database level — no bypass via direct API calls.

---

## 1. Create a Supabase project

1. Go to supabase.com → New project. Pick any name and region.
2. Wait ~2 minutes for provisioning.
3. **SQL Editor → New query** — paste and run the full contents of
   `supabase/schema.sql`. You should see "Success. No rows returned."

---

## 2. Configure email OTP

Supabase's default sender can only send **2 emails per hour** — not usable
for real candidates. Before going live:

1. **Authentication → Providers → Email** — verify Email is enabled.
2. **Authentication → Email Templates → Magic Link** — edit the body to
   show `{{ .Token }}` instead of (or alongside) the magic link URL, so
   candidates get a typed code rather than a click-through link.
3. **Project Settings → Auth → SMTP Settings** — set up a real SMTP
   provider. Recommended free options:
   - **Resend** (resend.com) — 3,000 emails/month free, 1-click Supabase integration
   - **Mailtrap** — 150/hour free, also 1-click Supabase integration
   - **SendGrid** — 100/day free, any SMTP credentials work
4. **Authentication → Rate Limits** — raise the "Emails per hour" limit
   (default 30 after custom SMTP) to something above your expected peak
   concurrent logins (e.g. 200 for 100 candidates logging in within an hour).

> **Demo mode note:** The current code uses a fixed OTP `123123` and shows
> it on screen. To switch to real email OTP, change the `sendOtp` and
> `verifyOtp` functions in `src/App.jsx` (comments mark the exact lines).

---

## 3. Get your Supabase keys

**Project Settings → API:**
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon / public key** — the long JWT string

---

## 4. Run locally

```bash
unzip exam-platform.zip
cd exam-platform
npm install
cp .env.example .env
# Edit .env — paste Project URL and anon key
npm run dev
```

Open the printed URL. Log in, complete your profile, then promote yourself
to admin in the SQL Editor:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

Refresh — the **Admin** button appears on your dashboard.

---

## 5. Create your first exam (admin flow)

1. Click **Admin → New exam**
2. Fill in title, description, instructions
3. Set status to **Draft** while configuring, **Active** when ready for candidates
4. Configure parts — click **Add part** for each part, then for each part:
   - Set the label (e.g. "Part 1")
   - Add sections (label, question count, duration in seconds)
   - Duration tip: 3000 = 50 minutes, 1800 = 30 minutes, 60 = 1 minute (for testing)
5. Save
6. Click **Questions** for the exam — upload questions per section:
   - **Manual**: click "Add question", fill in text and options
   - **CSV import**: click "CSV template" to download the format, fill it in, re-upload
7. Set exam status to **Active** when questions are loaded

---

## 6. Deploy to GitHub + GitHub Pages

### Step 1 — Create a GitHub repo

1. github.com → New repository (name it anything, e.g. `exam-platform`)
2. Push your code:
```bash
git init
git add .
git commit -m "Initial platform"
git remote add origin https://github.com/YOUR_USERNAME/exam-platform.git
git push -u origin main
```

### Step 2 — Add secrets to GitHub

**Repository → Settings → Secrets and variables → Actions → New repository secret**

Add these three:
- `VITE_SUPABASE_URL` — your Project URL
- `VITE_SUPABASE_ANON_KEY` — your anon key
- `VITE_BASE_PATH` — set to `/exam-platform/` (your repo name with slashes)

### Step 3 — Enable GitHub Pages

**Repository → Settings → Pages:**
- Source: **GitHub Actions**
- Save

### Step 4 — Push to deploy

Every push to `main` now triggers the workflow in `.github/workflows/deploy.yml`,
which builds and deploys to:
```
https://YOUR_USERNAME.github.io/exam-platform/
```

---

## 7. Deploy to Vercel (simpler, recommended)

Vercel auto-deploys from GitHub with no config beyond env vars:

1. vercel.com → New Project → Import your GitHub repo
2. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (Do NOT set `VITE_BASE_PATH` — leave it blank for Vercel)
3. Deploy — you get a live URL immediately
4. Every push to `main` redeploys automatically

**Vercel requires the Pro plan ($20/month per seat) for commercial use.**
Hobby plan is free but restricted to personal/non-commercial projects.

---

## 8. Before real candidates use it

| Item | What to change |
|------|----------------|
| Fixed OTP `123123` | Update `sendOtp`/`verifyOtp` in `src/App.jsx` to use real Supabase Auth |
| Placeholder colleges | Replace `COLLEGES` array in `src/data/constants.js` with the real list |
| Test duration control | Remove or hide the "Section duration (testing only)" card in `CandidateDashboard.jsx` |
| Custom SMTP | Set up a real provider (step 2 above) |
| Admin auth | The admin panel has no separate password — it's gated by `is_admin` in the DB |

---

## 9. Costs

| Service | Plan | Monthly |
|---------|------|---------|
| Supabase | Pro (recommended for production — no auto-pause) | $25/month |
| Vercel | Pro (required for commercial use) | $20/month per seat |
| Resend / Mailtrap | Free tier | $0 for ≤3,000–4,000 OTP emails/month |
| **Total** | | ~$45/month |

For 1,000 candidates over 3 days: the database load is very light (tens
of requests/second peak). The Pro plan is sized for much larger workloads.
The main scaling concern is email delivery rate — see step 2 above.

---

## 10. Adding future exams

No code changes needed. Log in as admin → **New exam** → configure structure
and upload questions. The platform handles everything else.
