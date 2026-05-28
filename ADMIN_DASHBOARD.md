# Admin Dashboard — Architecture & Edit Guide

Reference for anyone (Manus, future Claude, future you) editing `/admin`.

Live URL: <https://dumpster-web-manus.vercel.app/admin>

---

## Stack

| Layer | Tech | File |
|---|---|---|
| UI | React 19 + TypeScript + Recharts | `client/src/pages/Admin.tsx` |
| API | Vercel serverless function | `api/admin-stats.ts` |
| Auth | Supabase JWT (Google OAuth) | inline in `Admin.tsx` |
| Storage | Supabase Postgres | `supabase-activity-log.sql` |
| Event capture | fire-and-forget insert | `client/src/lib/analytics.ts` |

No build step beyond Vite — push to `main` and Vercel auto-deploys in ~60s.

---

## Auth flow

1. User visits `/admin` in any browser.
2. `Admin.tsx` calls `supabase.auth.getSession()`.
3. **No session** → renders `<SignInScreen>` with "Continue with Google" button (no IS_OWNER required; the page is harmless without data).
4. **Session exists** → fires `GET /api/admin-stats` with `Authorization: Bearer <jwt>`.
5. `admin-stats.ts` validates JWT via `getUserFromRequest()`, then checks `userId === process.env.ADMIN_USER_ID`.
6. Non-admin → `403 Forbidden` → page shows "Not authorized" card with Sign out button.
7. Admin → `200` with stats JSON → dashboard renders.

The real authorization boundary is the server-side `ADMIN_USER_ID` env var, set in Vercel.

---

## Data sources

The `/api/admin-stats` endpoint queries four sources in parallel and joins them in JS:

| Source | What it provides |
|---|---|
| `auth.users` (via `supabaseAdmin.auth.admin.listUsers`) | email, created_at, last_sign_in_at |
| `profiles` table | credits balance, subscription_tier |
| `credit_transactions` (last 30d, amount < 0) | AI usage per feature/user |
| `activity_log` (last 30d) | session_start / photo_uploaded / dump_exported |

Everything aggregated in memory — no SQL views.

---

## Response shape (the contract)

Defined identically in both files. **If you change one, change the other.**

```ts
interface AdminStats {
  overview: {
    total_users:        number;
    active_today:       number;
    active_week:        number;
    ai_calls_today:     number;
    credits_spent_today: number;
  };
  feature_usage: { action: string; count: number; credits: number }[];
  dau:           { date: string;   count: number }[]; // 14 days, oldest first
  users:         UserRow[];
}

interface UserRow {
  id:               string;
  email:            string;
  created_at:       string;
  last_sign_in_at:  string | null;
  tier:             string;   // 'free' | 'pro'
  credits:          number;   // current balance
  ai_calls:         number;   // last 30d
  credits_used:     number;   // last 30d
  photos_uploaded:  number;   // last 30d
  exports:          number;   // last 30d
}
```

Mirror locations:
- `api/admin-stats.ts:20-56` — server types
- `client/src/pages/Admin.tsx:25-41` — client types

---

## Adding a new metric

1. **Decide where the data comes from** — existing table or new event?
2. **If new event:** extend `AnalyticsEvent` in `analytics.ts`, then `track("my_event", { ... })` at the right call site. Events land in `activity_log` automatically — no schema change needed (uses generic `event` + `metadata jsonb`).
3. **Add an aggregation** in `api/admin-stats.ts` — read the events, sum/group as needed.
4. **Add the field** to the `AdminStats` interface in both `admin-stats.ts` and `Admin.tsx`.
5. **Render it** in `Admin.tsx`.

---

## Adding a new chart

Recharts is already imported. Common shapes:

```tsx
// Line chart (good for DAU, time series)
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
<ResponsiveContainer width="100%" height={180}>
  <LineChart data={dauLabelled} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
    <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
    <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#333", strokeWidth: 1 }} />
    <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5 }} />
  </LineChart>
</ResponsiveContainer>

// Pie / donut
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
<ResponsiveContainer width="100%" height={220}>
  <PieChart>
    <Pie data={items} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
      {items.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
    </Pie>
    <Tooltip content={<ChartTooltip />} />
  </PieChart>
</ResponsiveContainer>
```

The `<ChartTooltip>` helper in `Admin.tsx:71-79` already styles tooltips to match the dark theme.

---

## Styling conventions

- All inline styles, no Tailwind on this page (it's its own world).
- Single accent color: `const ACCENT = "#f5c518"` (top of file).
- Card pattern: `background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 18-22`.
- Body: `background: "#0a0a0a"`.
- Muted text: `#666`. Subtle text: `#888`. Primary: `#fff`.
- Tabular numerals via system stack — no font import needed.

---

## Adding sort / filter / search to the user table

The user table renders at the bottom of `Admin.tsx`. To make it interactive:

```tsx
const [sortKey, setSortKey] = useState<keyof UserRow>("last_sign_in_at");
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
const [search, setSearch]   = useState("");
const [tier, setTier]       = useState<"all" | "free" | "pro">("all");

const filtered = users
  .filter(u => tier === "all" || u.tier === tier)
  .filter(u => search === "" || u.email.toLowerCase().includes(search.toLowerCase()))
  .sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
```

Render `filtered` instead of `users`. Make column headers buttons that call `setSortKey(...)` / toggle `sortDir`.

---

## Adding date range selector

The API currently hardcodes `30 days` in `api/admin-stats.ts:78-80`. To make it configurable:

1. Accept a `?days=` query param in `admin-stats.ts`:
   ```ts
   const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
   const since = new Date(Date.now() - days * 86_400_000).toISOString();
   ```
2. Replace the hardcoded `thirtyDaysAgo` with `since`.
3. In `Admin.tsx`, add `const [days, setDays] = useState(30)` and pass it to `fetchStats` via `?days=${days}`.
4. Add a `<select>` or button group in the header bound to `setDays`.

---

## Drill-down (per-user detail)

Today the user table is a flat list. To add detail-on-click:

1. Make rows clickable → set `selectedUser: UserRow | null`.
2. Render a side panel or modal when `selectedUser` is set.
3. For per-user history, either:
   - **Cheap:** show what we already have (credits used, AI calls, photos, exports — already on the row).
   - **Real:** add a `GET /api/admin-user/:id` endpoint that returns that user's last 50 events from `activity_log` + `credit_transactions` with timestamps.

---

## Env vars

Set in Vercel project `dumpster-web-manus`:

| Var | What it does |
|---|---|
| `ADMIN_USER_ID` | Supabase user UUID that's allowed to read `/api/admin-stats`. **Required** — without it the API returns 503. |
| `SUPABASE_SERVICE_ROLE_KEY` | Used by `supabaseAdmin` to bypass RLS for admin reads |
| `SUPABASE_URL` | Standard Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Client-side auth — also used by `creditGate.ts` for JWT verification |

To find your `ADMIN_USER_ID`: Supabase Dashboard → Authentication → Users → copy the UUID column for the admin row.

---

## Privacy / safety notes

- `activity_log` has RLS — users can only insert their own rows. Service role (server) bypasses RLS for admin reads.
- The admin dashboard never exposes raw photo data — only counts and metadata.
- Owner accounts (`IS_OWNER` localStorage flag) are excluded from analytics in `track()` so demo activity stays out of the data.
- No PII beyond email is shown. Supabase auth.users.email is the only personal field surfaced.

---

## Quick test checklist

After any change:

1. `npx tsc --noEmit` from project root — no TS errors.
2. Push to `main`. Wait ~60s for Vercel.
3. Open `/admin` in an incognito window → sign-in card should appear.
4. Sign in as admin → dashboard loads with all sections.
5. Sign in as a non-admin Supabase user → "Not authorized" card.
6. Click Sign out → returns to sign-in card.

---

## Open enhancements (ranked, from 2026-05-27 ideation)

Pulled from a SwiftUI dashboard spec — translated to web-stack-relevant features.

**Quick wins:**
- [ ] DAU bar → line chart (better trend readability)
- [ ] Sortable user-table columns
- [ ] Email search + tier filter

**Medium:**
- [ ] Date range selector (7 / 14 / 30 / 90 days)
- [ ] "vs last period" delta on stat cards
- [ ] User detail drill-down

**Lower priority:**
- [ ] Pagination (only matters past ~50 users)
- [ ] Export CSV button
- [ ] Caption-style distribution pie (needs new event tracking — `caption_added` with style metadata)
- [ ] Retention cohort heatmap

---

## File map

```
dumpster-web/
├── ADMIN_DASHBOARD.md              ← you are here
├── api/
│   └── admin-stats.ts              ← serverless aggregation endpoint
├── client/src/
│   ├── pages/Admin.tsx             ← the entire page (UI + auth)
│   └── lib/analytics.ts            ← track() helper
├── server/
│   ├── creditGate.ts               ← getUserFromRequest() — reused for auth
│   └── supabaseAdmin.ts            ← service-role client
└── supabase-activity-log.sql       ← table + RLS (already applied)
```
