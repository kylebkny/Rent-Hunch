# What's the Rent

A daily rent-price-guessing game for Brooklyn rentals — study a listing's
clues, make up to four guesses at the monthly rent with warmer/colder hints,
and see how close you got. Companion to [resios.co](https://resios.co) (Kyle
Davis, EXR real estate) but fully isolated: its own Vercel project, its own
Supabase project.

> **Naming:** the product is **What's the Rent** everywhere users see it
> (`SITE_NAME` in `lib/brand.ts`). The repo/package/one component are still
> named `rent-hunch` internally — cosmetic only.

- **Live (prod):** the Vercel `renthunch` project → intended public home
  `game.resios.co` (attach in Vercel → Domains).
- **Admin:** `/admin` (Supabase email/password, allow-listed).

---

## Stack

- **Next.js** (App Router, TypeScript) + **Tailwind v4**
- **Supabase** — Postgres + Auth (anonymous sessions for players)
- **Vercel** — hosting + Cron
- **Google Maps** (optional) — admin address autocomplete + nearest-train

---

## How the game works

1. On first visit the client calls `supabase.auth.signInAnonymously()` — no
   login wall; the anonymous session persists so you resume and can't replay.
2. `GET /api/challenge/today` returns today's listing **clues** (never the
   rent) plus any in-progress guesses.
3. The player makes up to **4 guesses** (one per clue round). Each guess →
   `POST /api/guess`, which returns a **hint** (too high/low + warmer/colder,
   🟩/🟨/🟥) *without* the rent. A new clue unlocks each round:
   - Round 0: neighborhood (+ a "vibe" descriptor for non-locals)
   - Round 1: beds/baths (+ sqft if known)
   - Round 2: amenities
   - Round 3: nearest train (rendered as MTA line bullets) + nearby places
   - The listing **photos** reveal progressively alongside.
4. The final guess (4th, an exact hit, or "lock in") returns the **only**
   response that contains `actual_rent`: score, crowd average, percentile,
   streak, the full guess trail, and a link to the original listing.
5. **Scoring** (`lib/scoring.ts`): `1000 × accuracy(bestGuess) ×
   guessMultiplier`. Accuracy dominates (linear, 0 at ≥50% off); finishing in
   fewer guesses is a small bonus (`1.0 / 0.97 / 0.94 / 0.9`).
6. Reveal shows a non-spoiling **share card** (branded, building motif,
   temperature pills — not a Wordle grid) and a countdown to the next puzzle.

**Freeplay** (`/play`) serves random past/eligible listings for unlimited
casual rounds — no streak, no leaderboard, nothing persisted.

---

## Data model (Postgres)

All tables have **RLS enabled with zero client policies** — the anon key
reads/writes nothing directly. Every access goes through server route
handlers using the **service-role key**. `actual_rent` only ever leaves the
server via the final `/api/guess` (and freeplay) response.

| Table | Purpose |
|---|---|
| `listings` | The rentals. Clues + `actual_rent`, `photos[]`, `address/lat/lng`, `source` (manual\|exr), `review_status` (draft\|ready), `is_off_market`, `exr_listing_url`, `listing_url`. |
| `daily_challenges` | One listing per date. `edition` = chronological "#N". |
| `scheduled_challenges` | Queue of `challenge_date → listing_id` the cron consults. |
| `guesses` | Final result per user/challenge (unique). Feeds leaderboard/history/crowd. |
| `game_state` | In-progress `current_round` + `guesses[]` (for resume). |
| `profiles` | `display_name`, `streak_count`, `longest_streak`, `total_score`. |

Migrations live in `supabase/migrations/`. The consolidated, idempotent
schema is in **`SETUP.md`**.

---

## API routes

**Player**
- `GET  /api/challenge/today` — today's clues + resume state (no rent).
- `POST /api/guess` — records a guess; returns a hint, or the final result
  (the one place `actual_rent` is exposed).
- `PATCH /api/state` — persists the current clue round.
- `PATCH /api/profile` — set the leaderboard display name (anonymous OK).
- `GET  /api/freeplay/random`, `POST /api/freeplay/guess` — stateless freeplay.

**Admin** (all guarded by `isAdmin()` — email in `ADMIN_EMAILS`)
- `GET/POST/PATCH/DELETE /api/admin/listings[/:id]` — CRUD + status.
- `POST /api/admin/upload` — photo upload to Supabase Storage.
- `POST /api/admin/challenge` — set/replace today's challenge.
- `GET/POST/DELETE /api/admin/schedule` — the future-date queue.
- `POST /api/admin/sync-exr` — run the EXR scrape on demand.
- `POST /api/admin/enrich-exr` — backfill photos for photo-less EXR listings.

**Cron** (Bearer `CRON_SECRET`, configured in `vercel.json`)
- `GET /api/cron/new-challenge` — daily rollover (uses the schedule queue,
  else auto-picks the oldest featurable listing).
- `GET /api/cron/sync-exr` — weekly EXR sync.

---

## Admin (`/admin`)

- **Schedule** panel: warns if today is unset, lists upcoming days, and queues
  a featurable listing to a future date.
- **New/Edit listing**: selects for beds/baths/borough, amenity chips,
  multi-photo upload, optional Google address autocomplete (autofills
  neighborhood/borough/nearest-train + stores lat/lng), listing link.
- **Listings** list: source/status filter, search, EXR sync + photo backfill
  buttons, per-row actions.
- **Featurability:** a listing must be `review_status = ready` **and**
  `is_off_market = true` to be featured. The **"Approve for game"** button
  sets both at once (with a confirm — approving an on-market EXR listing
  publishes its live asking rent).

---

## EXR scraper

Ported from the Leasing-OS scraper (`lib/exr/scraper.ts`). Paginates
`exrplatform.com/listings/rentals`, follows building pages, and enriches each
detail page for the **full `/ads_images/` photo gallery**, beds/baths/rent,
neighborhood/borough, and address.

- Ingest (`lib/exr/ingest.ts`) writes new listings as `source='exr'`,
  `review_status='draft'`, `is_off_market=false`.
- **Off-market safety by absence:** a scraped listing only becomes featurable
  once it *disappears* from the site (i.e. leased) — the sync flips
  `is_off_market=true` then. So the scraper builds a *future* buffer; a live
  asking price is never auto-published. (An admin can override via "Approve
  for game.")
- **Incremental:** capped detail-page fetches per run (fits the serverless
  time limit); already-photographed listings are skipped so runs stay fast.
  Photos backfill over repeated syncs / the "Backfill photos" button.

---

## Environment variables

See `.env.local.example`.

| Key | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only**; the only key that touches game tables |
| `ADMIN_EMAILS` | comma-separated admin allowlist for `/admin` |
| `CRON_SECRET` | Bearer secret for cron routes |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional; enables admin address autofill |

**Security invariant:** `SUPABASE_SERVICE_ROLE_KEY` is referenced only in
`lib/supabase/admin.ts` (guarded by `import "server-only"`) and never reaches
a `"use client"` component.

---

## Deploy & setup

Full one-time setup (SQL, Supabase auth toggles, Vercel env, first listing)
is in **`SETUP.md`**. In short: run the schema, enable **anonymous
sign-ins**, create an admin Supabase user, set the env vars, redeploy, then
seed/approve a listing and "Set as today".

Cron schedule (`vercel.json`): daily rollover `0 4 * * *` (≈midnight ET),
weekly EXR sync `0 8 * * 1`.

---

## Still open / config-side

- Attach **game.resios.co** in Vercel → Domains (CNAME `game` →
  `cname.vercel-dns.com`).
- **Google Maps** key + HTTP-referrer restrictions for the renthunch domains.
- Design tokens are a **placeholder** direction (resios.co has no formal
  brand system yet).
- Analytics view (perceived vs. actual rent) — planned, not built.
