# Score A-Math — Tournament Score & Pairing System

Next.js (App Router) + Prisma/PostgreSQL + Auth.js (Credentials for dev, Google OAuth for
real use). See `tournament_score_pairing_uxui_spec_v2.md` (in the parent folder) for the full
product spec this implements. Phases 1–4 below are functionally implemented and **deployed to
production** on Vercel + Prisma Postgres.

Visual design: minimal white UI — frosted/translucent white cards (`.surface` in
`globals.css`) over a soft light-gray background with a subtle small-dot texture, no dark
mode. Shared primitives live in `src/components/ui/` (`Card`, `Button`/`LinkButton`, `Badge`,
`EmptyState`, `PageHeader`, `NavLink`/`TabLink` for active-state nav, `ConfirmSubmitButton`
for destructive actions, `Pagination`/`PageSizeSelect` for tables, and a cookie-driven
`Toast`/`FlashToastHost` pair) — reuse these instead of one-off Tailwind classes when adding
pages. Badge colors are semantic and consistent app-wide: upcoming/preview = yellow,
ongoing/confirmed = green, completed = gray, ADMIN = red, STAFF = blue (`info` variant).

## Getting Started

1. Start a local Postgres dev database (Prisma's own local server — no Docker needed):

   ```bash
   npx prisma dev -d
   ```

   This prints a connection string pointed at a `template1` database — **don't use that
   database directly** (`DATABASE_URL` in `.env` already points at a separate `score_amath`
   database instead). Writing schema into `template1` itself poisons every future database
   this local server creates, since `CREATE DATABASE` clones its template by default; we hit
   exactly this once already. If you ever regenerate the local server, create a dedicated
   database first (`psql`/`pg` client: `CREATE DATABASE score_amath;`) and point
   `DATABASE_URL` at that.

   Also: on this local dev server, `prisma migrate dev` can fail with a shadow-database
   error (`P3006`/`P3005`) even against a clean database — it's a quirk of this ephemeral
   server's copy-on-write internals, not the schema. Workaround used so far: `prisma db push`
   to sync the schema, hand-write the migration `.sql`, then
   `prisma migrate resolve --applied <name>` to mark it applied. On a real Postgres/Prisma
   Postgres, `prisma migrate dev` should work normally.

2. Apply migrations and seed sample data (see the shadow-database note above — on this
   local dev server `prisma db push` + `prisma migrate resolve --applied <name>` may be
   needed instead of a plain `prisma migrate dev`):

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

   Seed creates:
   - Admin login: `yossaphol3502@gmail.com` / `admin1234`
   - Staff login: `staff.dev@example.com` / `staff1234`
   - One sample "Sample Open Tournament" with 8 players and 4 tables.

   Seed only ever touches the local dev database (`DATABASE_URL` from `.env`) — it is never
   run automatically against production. Bootstrapping the first production Admin is a
   one-off, separate step (see **Deployment** below).

3. Run the dev server:

   ```bash
   npm run dev
   ```

   - Public site: http://localhost:3000
   - Admin: http://localhost:3000/login
   - Account (Google login / player link): http://localhost:3000/account

   Google sign-in needs real `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` values in `.env` (see the
   comment there for how to create them) — without them, use the credentials (dev) login on
   the same page. The credentials provider is excluded entirely when `NODE_ENV=production`.

## Deployment

- **Hosting**: Vercel (`vercel --prod` to deploy; `vercel.json` pins the function region to
  `sin1` — this must stay in the same region as the database, see below).
- **Database**: Prisma Postgres, region `ap-southeast-1`, connected via the pooled
  `pooled.db.prisma.io` connection string. `DATABASE_URL` on Vercel points here;
  `.env.production.local` (gitignored) has the same value for one-off scripts.
- **Why the region pin matters**: Vercel's default function region (`iad1`, US East) and the
  database region (`ap-southeast-1`, Singapore) being different was the root cause of a real
  production slowness issue — every DB round trip crossed the Pacific. `vercel.json`'s
  `"regions": ["sin1"]` keeps functions next to the database.
- **No branch previews**: `DATABASE_URL` exists only in the Production environment, so a
  Preview build fails at `prisma migrate deploy` ("datasource.url property is required").
  `vercel.json`'s `git.deploymentEnabled` therefore only lets `main` auto-deploy — pushing
  any other branch to GitHub doesn't trigger a (failing) preview build.
- **First Admin on a fresh production database**: the seed script never runs against
  production, so there's a bootstrap step. `prisma/promote-admin.ts` upserts a `User` row to
  `role: "ADMIN"` by email — run once with the production `DATABASE_URL`:
  ```bash
  DATABASE_URL="<prod connection string>" npx tsx prisma/promote-admin.ts <email>
  ```
- **Other one-off ops scripts** (all read the same way, with a prod `DATABASE_URL`):
  `prisma/check-db-usage.ts` (storage used vs. the Prisma Postgres Free tier's 500 MB limit —
  also shown as a live box on the Admin Dashboard) and `prisma/check-broken-staff.ts` (finds
  any `TournamentStaff` assignment whose `User.role` never got promoted — see the staff-role
  bug note below).
- **Known dependency tradeoff**: Player Import's `.xlsx` support uses the `xlsx` (SheetJS)
  npm package, which has two long-standing high-severity advisories (prototype pollution,
  ReDoS) with no fix published to npm. Accepted because the import endpoint is
  Admin/Staff-only (`assertTournamentAccess`-gated, not public); revisit if that ever
  changes.

## What's implemented

**Phase 1 — Tournament core**
- Full Prisma schema for the domain (Users/Roles, Global vs Tournament Player IDs,
  Tournament settings, per-Round Maximum Score, Matches, Match Submissions,
  Tables, Link Requests) — see `prisma/schema.prisma` for the spec citations inline.
- Auth: Credentials login (mock, for dev) via Auth.js, JWT session with `role`.
  `src/proxy.ts` does an optimistic redirect for `/admin/*`; the real enforcement is in
  `src/lib/dal.ts` (`requireAdmin`, `requireTournamentAccess`, `assertTournamentAccess`,
  `assertAdmin`) and is checked again in every Server Action / page, per spec §5.
- Admin: Dashboard (role-aware, includes a live Database Storage usage box for Admins),
  Create Tournament (all toggles from spec §7/§8/§11), Tournament Players
  (add/withdraw/reactivate/remove, **plus bulk import from .csv/.xlsx/.json** — see Phase 4),
  Staff Assignment (Admin-only), Global Players management (see Phase 4).
- Pairing: Random / Swiss / King of the Hill / Round Robin (`src/lib/pairing/`, unit-tested
  via `npm run test:pairing`), Preview with a Swap control in place of drag & drop (spec
  §10), Confirm/Cancel, First/Second assignment (spec §11).
- **Maximum Score / Diff (spec §8)**: caps the game's *spread* (winning margin), not each
  player's raw score — e.g. 442 vs 851 with Maximum Score 350 clamps the diff to ∓350, rather
  than capping each score to 350 first (which would wrongly compute a 0 diff for that exact
  case). Shared by the Scoreboard, pairing Standings, and the per-Round table via
  `src/lib/match/diff.ts` so all three can never drift out of sync with each other again.
  Own/opponent score totals shown to players are always the *raw* entered score; only
  cumulative Diff uses the capped value.

**Phase 2 — Match flow**
- Table QR flow (`/table/[qrToken]`, spec §12): scans resolve Tournament → current
  (CONFIRMED) Round → Table → Match with no login required. The score-entry UI is a single
  simplified "who won + winner's score + loser's score" form (instead of two side-by-side
  self/opponent forms) — one slot at a time for PENDING/SUBMITTED, both slots shown together
  only when resolving a CONFLICT.
- Score submission (spec §13): each side independently reports the FULL result; matching
  submissions auto-confirm, a mismatch flips the Match to Score Conflict. The whole
  upsert-compare-decide sequence runs inside a transaction that takes a `SELECT ... FOR
  UPDATE` lock on the Match row, so two devices submitting within milliseconds of each other
  (e.g. both resubmitting right after a Conflict) can never race each other into the wrong
  status. A stale device resubmitting *after* the match is already confirmed is handled as a
  normal outcome (a flash message + the page just shows the current result) rather than
  throwing — previously this crashed the whole page with no error boundary anywhere to catch
  it (`This page couldn't load`); both a route-specific and an app-wide `error.tsx` now exist
  as a safety net regardless.
- Admin/Staff match editing (`/admin/tournaments/[id]/rounds/[roundId]`, spec §14): resolves
  conflicts and can correct any match's recorded result, tagged with who edited it. The same
  page also shows a per-Round score table (one row per player: opponent, W/T/L, own/opponent
  score, Diff) scoped to just that Round, separate from the Tournament-wide Scoreboard.
- A Round auto-completes once every Match is CONFIRMED or a Bye — this is also what keeps
  "current round" unambiguous for the QR lookup and gates starting the next round's pairing.
- Public Scoreboard/Rounds/Current-Pairing/Players pages reflect confirmed results live; the
  Players page shows sequential standing rank (not the fixed Tournament Player No) with the
  player's `(#N)` shown after their name; the Round page shows each match's Diff with a note
  when it was actually capped by that Round's Maximum Score.

**Phase 3 — Account, Admin management & polish**
- Google OAuth via Auth.js (`src/auth.ts`): first-time Google sign-in auto-provisions a
  `USER`; Admin/Staff resolve their role from an existing `User` row matched by email
  (added ahead of time via Admin Management / Staff Assignment) — spec §4/§5.
- Account linking (spec §4): `/account` lets a logged-in user search Global Players and
  send a `LinkRequest`; `/admin/account-requests` is where an Admin approves/rejects it.
  Nothing links automatically — approval is always required. Once linked, the user can also
  rename their own Player (name/nickname) directly from `/account`.
- `/account` shows Tournament + Match history for the linked Global Player directly on the
  page (pulled from confirmed Matches only, same rule as the scoreboard) — including a rank
  badge once a Tournament is COMPLETED. The shared header's user button is a dropdown
  (avatar + name) with "ไปหน้า Admin" (Admin/Staff only), "แก้ไขข้อมูล/ผูกบัญชี Google", and
  Logout, instead of separate buttons cluttering the page. `/account/history` now redirects
  to `/account` for old links.
- `/admin/admins`: add an Admin by Gmail, or remove one (blocked from removing yourself or
  dropping below one remaining Admin).
- Real QR code images (`qrcode` package, `src/components/ui/QrCode.tsx`) encoding the
  absolute `/table/[qrToken]` URL — configurable via `NEXT_PUBLIC_APP_URL`.
- UX polish: a shared `Toast` (cookie-based flash messages set from Server Actions),
  `ConfirmSubmitButton` confirmation dialogs on destructive actions (Withdraw, Remove,
  Revoke, Cancel Pairing, Remove Admin, Delete Player), `EmptyState` everywhere a list can
  legitimately be empty, and the full visual redesign described above.

**Phase 4 — Global Player management & bulk tooling**
- `/admin/players` (Global Players): rename any player inline, unlink a player's Google
  account without deleting it (they can relink later), delete a linked account outright
  (guarded — only ever a plain `USER` with no Staff history or created Tournaments; never
  touches Admin/Staff accounts), and delete the Player record itself. Deleting a Player who
  has tournament/match history is a deliberate, explicitly-confirmed override: it removes
  every Match they were ever in on *both* sides, which also removes that game from whichever
  opponent they played (a Match record can't be "half" deleted) — the confirm dialog says so
  before it happens.
- Server-rendered pagination (`Pagination`/`PageSizeSelect` in `src/components/ui/`) on the
  Global Players table — row count is a dropdown (10/20/50/100) or a free-typed custom
  number, both reflected in the URL (`?page=&pageSize=`).
- Bulk Player Import (`src/lib/players/import.ts`, wired into
  `/admin/tournaments/[id]/players`): upload `.csv`, `.xlsx`, or `.json` with `name` /
  `nickname` / `globalPlayerId` columns (case-insensitive header matching, a couple of Thai
  aliases). Every row is checked against existing Global Players first — by ID if given,
  otherwise by exact case-insensitive name match — and reused rather than duplicated; a row
  already in the target Tournament is skipped. Bad rows are recorded and skipped individually
  rather than failing the whole import.

**Bugs found and fixed this phase** (worth knowing about if something looks off elsewhere):
- `assignStaff` used to only set `role: "STAFF"` when *creating* a brand-new `User` row — if
  the email had ever signed in before (auto-provisioned as plain `USER`), the
  `TournamentStaff` assignment was created fine but the role was never promoted, silently
  locking that person out of `/admin` with no error shown anywhere. Fixed to promote an
  existing `USER` too (never downgrading an existing `ADMIN`). `prisma/check-broken-staff.ts`
  finds any assignment still stuck this way.

## Intentionally still open

Drag-and-drop pairing (still a Swap dropdown) and full Tournament-settings editing after
creation (currently read-only except Status) are simplified/read-only — noted inline on
those pages.

## Notes for whoever picks this up next

- Prisma 7 uses the new `prisma-client` generator (output at `src/generated/prisma`,
  gitignored) with an explicit driver adapter (`@prisma/adapter-pg`) — see
  `src/lib/prisma.ts`. Don't switch back to the old `@prisma/client` import pattern.
- This is Next.js 16: Middleware was renamed to **Proxy** (`src/proxy.ts`, not
  `middleware.ts`). Cache Components are NOT enabled in `next.config.ts`, so rendering
  follows the pre-16 dynamic-by-default model — no `"use cache"`/`<Suspense>` ceremony
  required for the data fetching here.
- No `server-only` package is actually installed in `node_modules` (Next.js aliases it
  internally) — a plain `tsx` script importing a file that has `import "server-only"` at the
  top will fail to resolve it. Testing library code standalone (outside `next dev`/`next
  build`) needs a throwaway local stub package at `node_modules/server-only` first.
