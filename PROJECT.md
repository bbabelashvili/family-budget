# Family Budget App — Project Overview

A personal family budget tracker built as a PWA, deployed at **budget.psyak.com**.

---

## What it is

A private web app for tracking family finances across 4 profiles. Not a SaaS — single household, no auth backend, PIN-protected.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Database | Supabase (project `unqgoopxwjxjenkyxgxr`, `budget` schema) |
| Drag & drop | @dnd-kit |
| Icons | Lucide React |
| Deployment | Cloudflare Pages (auto-deploy on push to `main`) |
| AI | Claude Sonnet 4.6 via Anthropic API (server-side proxy) |
| Repo | github.com/bbabelashvili/family-budget |

---

## Profiles

4 profiles, each with its own color theme and PIN:

| Profile | Name | Color | PIN |
|---|---|---|---|
| `mine` | Bao Yob 🦅 | #D9D9D9 | required |
| `hers` | Bao 🐥 | #AA98A9 | required |
| `shared` | Family 🏠 | #EDE8D0 | none |
| `travels` | Travels ✈️ | #BBB791 | none |

**App-level PIN lock**: On first open, master PIN required to set up a 4-digit app PIN. On subsequent opens, 4-digit PIN required. Master PIN resets forgotten PINs.

---

## Widgets (per profile, drag-to-reorder, expandable on desktop)

### All profiles
- **Monthly Summary** — income vs. expenses breakdown, color-coded (green/red), balance, "Save to savings" button
- **Income** — income sources with tax rate, net calculation, multi-currency
- **Regular Expenses** — recurring bills by category (family/utilities/car/debt/other), monthly/annual frequency, paid toggle (localStorage, resets monthly)
- **Subscriptions** — with billing date tracking, overdue highlight, mark paid advances date
- **Debts** — installment tracking with progress bar, payment count, mark paid decrements counter
- **Savings** — multi-currency savings buckets (UAH/USD/EUR)
- **Goals** — savings goals with progress bars, deposit tracking
- **Unplanned Expenses** — one-off purchases
- **Exchange Rates** — manual USD/EUR rates

### Family profile
- **Family Budget** — monthly budget vs. actual spending
- **Receipts** — AI receipt scanner + manual entry, grouped by vendor/date
- **By Category** — spending breakdown by grocery category

### Travels profile
- **Trip Summary** — trip budget, multi-currency
- **Travel Expenses** — categorized expenses with pie/list view
- **Transport** — flights, trains, buses with route tracking
- **Accommodation** — hotel/Airbnb entries
- **Shopping List** — travel shopping checklist

---

## AI Receipt Scanner

- Model: Claude Sonnet 4.6 (Haiku 4.5 available but poor Ukrainian OCR)
- Sends photo → returns JSON with items, categories, totals
- Ukrainian grocery categories pre-defined (~24 categories)
- **Metro receipts**: prices are без ПДВ (ex-VAT), prompt instructs model to multiply by 1.2
- After scan: review/edit screen grouped by category, save to Supabase
- All API calls go through `/api/anthropic` Cloudflare Pages Function (key never in bundle)

---

## Security

- Anthropic API key: server-side only via Cloudflare Pages Function + Vite dev proxy
- Supabase anon key: hardcoded (intentional — public by design, RLS enforced)
- App PIN: SHA-256 hashed in localStorage, master PIN `240518` for reset
- Profile PINs: SHA-256 hashed in Supabase

---

## Database Tables (Supabase, `budget` schema)

`income`, `regular_expenses`, `subscriptions`, `debts`, `savings`, `goals`, `unplanned_expenses`, `currencies`, `family_config`, `profiles`, `receipt_items`, `receipts`, `travel_config`, `travel_expenses`, `travel_expense_categories`, `travel_transport`, `travel_accommodations`, `travel_shopping`

---

## Mobile UX (iPhone-first)

- PWA: manifest.json, 💰 icon, apple-touch-icon
- Font size: 17px root on touch devices (all rem sizes scale up)
- Delete confirmation: 2-tap (DeleteButton component, 3s auto-cancel)
- Paid confirmation: 2-tap (PaidButton component, 3s auto-cancel)
- Action icons: always visible at 75% opacity on touch (no hover on mobile)
- iOS zoom prevention: `font-size: 16px !important` on all inputs for touch devices
- Drag-to-reorder widgets: works on touch via @dnd-kit TouchSensor

---

## Design

- Per-profile dark widget cards on light profile-colored background
- Widget card colors derived from profile hue (dark tinted)
- CSS custom properties (`--color-card`, `--color-border`) set on Dashboard container
- Progress bars: color-coded by % (`rose-300` <25%, `amber-300` 25-75%, `emerald-300` 75%+)
- Summary rows: income = `emerald-300`, expenses = `rose-300`
- 2-column grid on desktop (`max-w-5xl`, `items-start`), single column on mobile

---

## What's NOT built yet (potential ideas)

- Push notifications for upcoming subscription/debt due dates
- Monthly email/PDF summary report
- Budget forecasting / trend charts
- Recurring expense auto-mark-paid (e.g. auto-mark on the 1st of month)
- Receipt photo storage (currently only extracted data is saved)
- Multi-month history view for regular expenses paid status
- Shared expense splitting between profiles
- Import from bank statements (CSV/PDF)
- Currency auto-update (currently manual)
