# Handover — Family Budget App

For full project overview see [PROJECT.md](PROJECT.md).

---

## Repo & Deployment

- **Repo**: github.com/bbabelashvili/family-budget (branch `main`)
- **Live**: https://budget.psyak.com
- **Deploy**: Cloudflare Pages — auto-deploys on every push to `main`
- **API proxy**: `functions/api/anthropic/[[path]].ts` — Cloudflare Pages Function, injects `ANTHROPIC_API_KEY` server-side
- **Supabase project**: `unqgoopxwjxjenkyxgxr`, schema `budget` ← the only one to touch

---

## Environment

`.env` (local only, gitignored):
```
ANTHROPIC_API_KEY=sk-ant-...
```

Cloudflare Pages env vars (set in dashboard):
- `ANTHROPIC_API_KEY` ✓
- `SUPABASE_SERVICE_KEY` — **must be set** (service-role key from Supabase → Settings → API). Used by the DB proxy; never in the bundle.
- `SESSION_SECRET` — **must be set** (any long random string). Signs the app session tokens.
- `MASTER_PIN` — **must be set** to `240518`. The master PIN, moved out of the JS bundle.
- `GEMINI_API_KEY` — **still present, needs manual removal** (Gemini was removed from the codebase but the env var was never cleaned up in Cloudflare dashboard)

---

## Security: DB access is proxied server-side (no more open anon key)

**Problem that was fixed:** every `budget`-schema table was readable/writable/`TRUNCATE`-able by anyone holding the public anon key (which ships in the JS bundle). RLS was either off or `USING(true)`.

**New architecture:**
- The frontend no longer talks to Supabase directly. `src/lib/supabase.ts` points `supabase-js` at the same-origin proxy `/api/db`, and attaches an `x-app-token` header on every request.
- `functions/api/db/[[path]].ts` — proxies `/api/db/*` → `<supabase>/rest/v1/*`, injecting the **service-role key** server-side. Rejects any request without a valid, unexpired token.
- `functions/api/auth/login.ts` — `GET` returns `{hasPin}`; `POST {pin}` verifies the app-unlock PIN (vs `budget.app_auth.pin_hash`) or the master PIN (env) and returns a 24h HMAC token.
- `functions/api/auth/set-app-pin.ts` — master-gated; sets the shared app-unlock PIN.
- `functions/api/auth/master.ts` — server-side master-PIN check (profile PIN reset).
- `functions/_lib/token.ts` — HMAC token sign/verify; `functions/_lib/supabase.ts` — service-role REST helpers.
- Token = HMAC-signed `{exp}`, stored in `localStorage['budget_db_token']`, gated on `SESSION_SECRET`.
- App-unlock PIN moved from per-device localStorage → shared `budget.app_auth` table (server-verified).

**✅ Cutover COMPLETE (2026-07-11).** Anon access to the `budget` schema has been revoked; the app runs entirely through the proxy. A raw call with the old anon key now returns `42501 permission denied`. Verified end-to-end on the live site (reads + writes 200 via `/api/db`).

**Two gotchas hit during cutover (both fixed — note for future schema work):**
- The `budget` schema had **no grants for `service_role`** (only `anon`). New tables/schemas the proxy must reach need `GRANT ... TO service_role` (default privileges were set for the `budget` schema so future tables are covered).
- The Supabase **`sb_secret_…` key is blocked if the request looks browser-originated**. The proxy must forward **only** PostgREST headers (accept, accept-profile, content-profile, content-type, prefer, range) — never the raw browser headers (Referer/User-Agent/Sec-Fetch/cookies), or Supabase returns "Forbidden use of secret API key in browser".

The app-unlock PIN was reset to a temporary `1234` during verification — change it via Forgot PIN → master `240518`.

---

## Recent Changes (last two sessions)

### Receipt Scanner overhaul
- Removed Gemini entirely — Anthropic only (`claude-sonnet-4-6` default, `claude-haiku-4-5` available)
- **VAT logic**: the "Note" field in the scan modal is now the vendor name. If it contains "Metro" / "Метро", every item is multiplied ×1.2. All other vendors use printed prices as-is.
- **Gallery upload**: removed `capture="environment"` so iOS shows Photo Library option
- **File input**: created dynamically on `document.body` (not in DOM) to fix iOS action sheet positioning and focus-jump-on-dismiss
- **Scan modal buttons**: split into "Camera" (opens camera directly, no system sheet) and "Gallery"
- **Modal stays open** until a file is actually selected — cancelling the system picker returns you to the scan modal

### Mobile UX fixes
- All modals now centered on mobile (changed `items-end` → `items-center` in `Modal.tsx`)
- Horizontal scroll eliminated (body `overflow-x: hidden`, `min-w-0` on flex selects, `margin-block` not `margin` on tap targets)
- iOS input zoom prevented (`font-size: 16px !important` on touch devices)
- Widget resize button hidden on mobile (`hidden sm:block`)
- Action icons visible at 75% opacity on touch (no hover on mobile)

### Security
- App PIN first-launch bug fixed: requires master PIN (`240518`) before allowing new PIN setup
- Anthropic key is server-side only; never in JS bundle

### UI
- Progress bars: `rose-300` <25%, `amber-300` 25–75%, `emerald-300` 75%+
- Summary rows: income = `emerald-300`, expenses = `rose-300` (no +/− prefix, color-coded)
- Per-profile background colors sync to `document.body` for iOS bounce scroll
- Delete confirmation: 2-tap (`DeleteButton` component, 3s auto-cancel)

---

## Known Issues / Pending

| Issue | Status |
|---|---|
| "Upload failed" on first scan attempt | Transient — Cloudflare Function cold start. Retry always works. Not a code bug. |
| One-time SSL error on budget.psyak.com | Transient cert renewal. Not a code bug. |
| Haiku 4.5 still in model dropdown | User kept it for now; poor Ukrainian OCR |
| `GEMINI_API_KEY` in Cloudflare env | Harmless but stale — remove manually in Cloudflare dashboard |

---

## Key Files

| File | What it does |
|---|---|
| `src/components/dashboard/ReceiptScannerWidget.tsx` | AI receipt scanner — prompt logic, file picker, preview/edit |
| `src/components/AppLockScreen.tsx` | App PIN lock, master PIN gate |
| `src/components/dashboard/Dashboard.tsx` | Widget layout, per-profile theming, drag-to-reorder |
| `src/components/ui/Modal.tsx` | Shared modal (centered, `max-h-[90vh]`, scroll) |
| `src/components/ui/DeleteButton.tsx` | 2-tap delete confirmation |
| `src/components/ui/PaidButton.tsx` | 2-tap paid confirmation |
| `src/index.css` | Mobile font size, tap targets, group-hover visibility, profile CSS vars |
| `functions/api/anthropic/[[path]].ts` | Cloudflare Pages Function — Anthropic API proxy |

---

## Supabase Tables (`budget` schema)

`income`, `regular_expenses`, `subscriptions`, `debts`, `savings`, `goals`, `unplanned_expenses`, `currencies`, `family_config`, `profiles`, `receipt_items`, `receipts`, `travel_config`, `travel_expenses`, `travel_expense_categories`, `travel_transport`, `travel_accommodations`, `travel_shopping`

**Never touch**: Supabase project `apdetcllicshqsxoffnm` (`enoteca`) — separate **wine-collection** app, fully isolated.

**Note**: the **pet dashboard** lives in *this* budget project's `public` schema (tables: `households`, `household_members`, `pets`, `weight_logs`, `medications`, `medication_logs`, `vet_visits`, `vet_visit_documents`, `barf_configs`, `barf_categories`, `barf_items`) — unrelated to the budget app. The budget app only uses the `budget` schema; never touch `public`.

---

## Ideas Not Yet Built

- Push notifications for upcoming subscription/debt due dates
- Monthly email/PDF summary
- Budget forecasting / trend charts
- Recurring expense auto-mark-paid
- Receipt photo storage (only extracted data saved now)
- Multi-month history for regular expenses
- Shared expense splitting between profiles
- Bank statement import (CSV/PDF)
- Currency auto-update
