# Score A-Math — Tournament Score & Pairing System

Next.js (App Router) + Prisma/PostgreSQL + Auth.js (Credentials for dev, Google OAuth wired
up for real use). See `tournament_score_pairing_uxui_spec_v2.md` (in the parent folder) for
the full product spec this implements. Phases 1–3 are functionally implemented; deployment
is the only thing intentionally left undone.

Visual design: minimal white UI — frosted/translucent white cards (`.surface` in
`globals.css`) over a soft light-gray background, no dark mode. Shared primitives live in
`src/components/ui/` (`Card`, `Button`/`LinkButton`, `Badge`, `EmptyState`, `PageHeader`,
`NavLink`/`TabLink` for active-state nav, `ConfirmSubmitButton` for destructive actions, and
a cookie-driven `Toast`/`FlashToastHost` pair) — reuse these instead of one-off Tailwind
classes when adding pages.

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
   `DATABASE_URL` at that. This local DB is ephemeral dev-only — production should point
   `DATABASE_URL` at Neon (or another managed Postgres), per the spec's deployment plan.

   Also: on this local dev server, `prisma migrate dev` can fail with a shadow-database
   error (`P3006`/`P3005`) even against a clean database — it's a quirk of this ephemeral
   server's copy-on-write internals, not the schema. Workaround used so far: `prisma db push`
   to sync the schema, hand-write the migration `.sql`, then
   `prisma migrate resolve --applied <name>` to mark it applied. On a real Postgres/Neon,
   `prisma migrate dev` should work normally.

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

3. Run the dev server:

   ```bash
   npm run dev
   ```

   - Public site: http://localhost:3000
   - Admin: http://localhost:3000/login
   - Account (Google login / player link): http://localhost:3000/account

   Google sign-in needs real `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` values in `.env` (see the
   comment there for how to create them) — without them, use the credentials (dev) login on
   the same page.

## What's implemented

**Phase 1 — Tournament core**
- Full Prisma schema for the domain (Users/Roles, Global vs Tournament Player IDs,
  Tournament settings, per-Round Maximum Score, Matches, Match Submissions,
  Tables, Link Requests) — see `prisma/schema.prisma` for the spec citations inline.
- Auth: Credentials login (mock, for dev) via Auth.js, JWT session with `role`.
  `src/proxy.ts` does an optimistic redirect for `/admin/*`; the real enforcement is in
  `src/lib/dal.ts` (`requireAdmin`, `requireTournamentAccess`, `assertTournamentAccess`,
  `assertAdmin`) and is checked again in every Server Action / page, per spec §5.
- Admin: Dashboard (role-aware), Create Tournament (all toggles from spec §7/§8/§11),
  Tournament Players (add/withdraw/reactivate/remove), Staff Assignment (Admin-only),
  Global Players list.
- Pairing: Random / Swiss / King of the Hill / Round Robin (`src/lib/pairing/`, unit-tested
  via `npm run test:pairing`), Preview with a Swap control in place of drag & drop (spec
  §10), Confirm/Cancel, First/Second assignment (spec §11). Diff is bounded by Maximum Score
  alone (per-game, spec §8) — there is no separate cumulative-diff cap.

**Phase 2 — Match flow**
- Table QR flow (`/table/[qrToken]`, spec §12): scans resolve Tournament → current
  (CONFIRMED) Round → Table → Match with no login required.
- Score submission (spec §13): each side independently reports the FULL result (their score
  and their opponent's); matching submissions auto-confirm, a mismatch flips the Match to
  Score Conflict.
- Admin/Staff match editing (`/admin/tournaments/[id]/rounds/[roundId]`, spec §14): resolves
  conflicts and can correct any match's recorded result, tagged with who edited it.
- A Round auto-completes once every Match is CONFIRMED or a Bye — this is also what keeps
  "current round" unambiguous for the QR lookup and gates starting the next round's pairing.
- Public Scoreboard/Rounds/Current-Pairing pages reflect confirmed results live.

**Phase 3 — Account, Admin management & polish**
- Google OAuth via Auth.js (`src/auth.ts`): first-time Google sign-in auto-provisions a
  `USER`; Admin/Staff resolve their role from an existing `User` row matched by email
  (added ahead of time via Admin Management / Staff Assignment) — spec §4/§5.
- Account linking (spec §4): `/account` lets a logged-in user search Global Players and
  send a `LinkRequest`; `/admin/account-requests` is where an Admin approves/rejects it.
  Nothing links automatically — approval is always required.
- `/account/history`: Tournament + Match history for the linked Global Player, pulled from
  confirmed Matches only (same rule as the scoreboard).
- `/admin/admins`: add an Admin by Gmail, or remove one (blocked from removing yourself or
  dropping below one remaining Admin).
- Real QR code images (`qrcode` package, `src/components/ui/QrCode.tsx`) encoding the
  absolute `/table/[qrToken]` URL — configurable via `NEXT_PUBLIC_APP_URL`.
- UX polish: a shared `Toast` (cookie-based flash messages set from Server Actions),
  `ConfirmSubmitButton` confirmation dialogs on destructive actions (Withdraw, Remove,
  Revoke, Cancel Pairing, Remove Admin), `EmptyState` everywhere a list can legitimately be
  empty, and the full visual redesign described above.

**Intentionally still open**: Player Import (CSV) and deployment (not asked for yet).
Drag-and-drop pairing (still a Swap dropdown) and a couple of settings-editing flows
(Tournament settings after creation) are read-only/simplified — noted inline on those pages.

## Notes for whoever picks this up next

- Prisma 7 uses the new `prisma-client` generator (output at `src/generated/prisma`,
  gitignored) with an explicit driver adapter (`@prisma/adapter-pg`) — see
  `src/lib/prisma.ts`. Don't switch back to the old `@prisma/client` import pattern.
- This is Next.js 16: Middleware was renamed to **Proxy** (`src/proxy.ts`, not
  `middleware.ts`). Cache Components are NOT enabled in `next.config.ts`, so rendering
  follows the pre-16 dynamic-by-default model — no `"use cache"`/`<Suspense>` ceremony
  required for the data fetching here.
