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
- `GEMINI_API_KEY` — **still present, needs manual removal** (Gemini was removed from the codebase but the env var was never cleaned up in Cloudflare dashboard)

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

**Never touch**: Supabase project `apdetcllicshqsxoffnm` (`enoteca`) — pet dashboard, unrelated project.

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
