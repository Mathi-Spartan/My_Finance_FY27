# Kanakku

Personal finance tracker. Every rupee accounted for. Next.js + Supabase, installable as a PWA — no App Store or Play Store account needed.

Currency is INR throughout, formatted Indian-style (₹1,24,300, lakh and crore in compact views).

---

## What it does

**Home** — Safe to spend today, the one number that matters. Underneath it, a bar for every day of the month showing what you actually spent, with today marked and heavy days in red. Then a runway line: at this pace, cash lasts to a date. Below that, account balances and every entry grouped by day.

**Add entry** — Numpad, direction toggle (in / out / move between accounts), and a merchant field. Type a merchant you've used before and the category and account fill themselves. Before you commit, it tells you what the entry leaves you and how much of that category's budget is gone. Slide to file.

**Insights** — Every category measured against your own three-month average, not a generic benchmark. Burn rate per day versus the month before. Biggest leaks by merchant.

**Upcoming** — Anything charged three months running at a steady amount gets detected and offered for tracking. Next 14 days of commitments on a timeline. Things you're paying for but stopped using.

**Settings** — Income and savings target (these drive safe-to-spend), account opening balances, per-category budgets, CSV import and export, and a 4-digit PIN lock.

---

## Setup

### 1. Supabase

Create a project, then in the SQL editor run `supabase/schema.sql` once. That creates every table, turns on row level security so only you can read your own rows, and sets up a trigger that gives a new user starter accounts (HDFC Savings, UPI / GPay, Credit Card, Cash) and thirteen categories.

Then in **Authentication → Providers**, make sure Email is on. Turn **off** "Enable email signups" after you've created your own account, so nobody else can register.

Under **Authentication → URL Configuration**, add your Vercel domain to Site URL and Redirect URLs.

Grab from **Project Settings → API**:
- Project URL
- `anon` public key

### 2. Environment

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Locally that goes in `.env.local`. On Vercel, add both under Project → Settings → Environment Variables.

### 3. Deploy

```bash
npm install
npm run dev      # local
```

On Vercel: import the repo, add the two env vars, deploy. Nothing else to configure.

### 4. Install on your phone

**iPhone / iPad** — open the site in Safari, tap Share, then Add to Home Screen. It opens fullscreen with no address bar.

**Android** — Chrome shows an install prompt, or use the menu → Install app.

The service worker caches the app shell, so it opens instantly and survives a dropped connection.

---

## First run

1. Sign in with your email. Check your inbox for the link.
2. Go to Settings → Money. Put in your monthly income and what you want to keep each month. These two numbers drive safe-to-spend — without them the app guesses from your balances.
3. Set the opening balance for each account to what it actually holds today.
4. Settings → Budgets, set monthly caps per category. Zero means untracked.
5. Optionally import history: Settings → App → Import bank CSV.

**Import history if you can.** Category drift compares this month against your own three-month average, and subscription detection needs three months of charges to spot a pattern. With no history the app works but stays quiet for its first quarter. Export from HDFC / your bank as CSV — it looks for columns named `date`, `merchant` (or `description` / `narration`), `amount`, and optionally `direction`, `category`, `account`, `context`.

---

## How safe-to-spend is calculated

```
basis        = stated monthly income, else income received this month, else cash on hand
dueLater     = tracked commitments whose day of month hasn't passed yet
savingsOwed  = savings target − (income this month − spent this month), floored at zero
pool         = min(basis − spent − dueLater − savingsOwed, cash − dueLater)
perDay       = pool ÷ days left in the month
```

The `min` matters: it never offers you money that isn't in an account. It goes negative when you're genuinely over, and the screen says so rather than showing zero.

---

## Structure

```
app/            layout, single page (the shell is client-side)
components/     App, HomeView, InsightsView, UpcomingView, SettingsView,
                AddSheet, Login, Lock, Icons
lib/finance.js  all money maths — safe-to-spend, runway, drift,
                recurring detection, dormant spend, CSV
lib/store.js    Supabase data loading and mutations
lib/supabase.js browser client
supabase/       schema.sql
public/         manifest, service worker, icons
```

Business and personal are separate ledgers sharing the same accounts — the toggle on Home switches which entries count toward the month's numbers.
