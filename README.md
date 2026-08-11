# What's the Rent

A daily rent-price-guessing game for NYC rentals (Brooklyn + Manhattan) —
study a listing's clues, make up to four guesses at the monthly rent with
warmer/colder hints, and see how close you got. Companion to [resios.co](https://resios.co) (Kyle
Davis, EXR real estate) but fully isolated: its own Vercel project, its own
Supabase project.

> **Naming:** the product is **What's the Rent** everywhere users see it
> (`SITE_NAME` in `lib/brand.ts`). The repo/package/one component are still
> named `rent-hunch` internally — cosmetic only.

- **Live (prod):** [game.resios.co](https://game.resios.co) — the Vercel
  `renthunch` project (domain attached and working).
- **Admin:** `/admin` (Supabase email/password, allow-listed).
- **Branch:** work has been landing on `claude/rent-hunch-game-build-0iqzeu`.

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
   - Round 1: beds/baths (+ sqft if known) + nearest train — line bullets +
     station + walk time, e.g. ⓁⒼ Lorimer St · 4 min walk
   - Round 2: amenities + nearby places
   - Round 3: no new clue — this is the lock-in round.
   - The listing **photos** reveal progressively alongside (percentage of
     the total per round, not a fixed count — see `lib/photo-reveal.ts`).
   - Once per puzzle, the player can also spend a **hint token**
     (`POST /api/hint`) at any point before locking in, revealing
     `year_built` (NYC PLUTO) plus a Static Maps radius circle around a
     server-side-jittered point — never the real lat/lng, and the same
     jittered reveal every time it's re-fetched. Costs the same score-tier
     hit as finishing one guess round later (see `lib/scoring.ts`'s existing
     multiplier tiers — no separate penalty scale).
4. The final guess (4th, an exact hit, or "lock in") returns the **only**
   response that contains `actual_rent`: score, crowd average, percentile,
   streak, the full guess trail, and a link to the original listing.
5. **Scoring** (`lib/scoring.ts`): `1000 × accuracy(bestGuess) ×
   guessMultiplier`. Accuracy dominates (linear, 0 at ≥50% off); finishing in
   fewer guesses is a small bonus (`1.0 / 0.97 / 0.94 / 0.9`).
6. **Winning** is a separate idea from scoring: `isWin()` is true within
   `WIN_THRESHOLD` (**5%**) of the actual rent. That drives the reveal
   headline and the confetti — not the score.
7. Reveal shows today's **rank**, a prominent leaderboard CTA, and a
   non-spoiling **share card** (branded, building motif, temperature pills —
   not a Wordle grid) plus a countdown to the next puzzle. `/leaderboard`
   highlights the viewer's own row in both lists.

**Freeplay** (`/play`) serves random past/eligible listings for unlimited
casual rounds — no streak, no leaderboard, nothing persisted.

---

## Where things live

| Path | What it is |
|---|---|
| `lib/scoring.ts` | score curve, `MAX_GUESSES`, `WIN_THRESHOLD`/`isWin`, hint bands |
| `lib/listing-options.ts` | neighborhoods, boroughs, bed/bath/amenity options, `formatBaths` |
| `lib/transit.ts` | neighborhood → subway lines (coarse) |
| `lib/subway-lines.ts` | station → lines, authored per route and inverted; disambiguates repeated station names ("86 St") against the neighborhood |
| `lib/neighborhoods.ts` | one-line "vibe" copy per neighborhood |
| `lib/streeteasy.ts` | StreetEasy URL + page parsing (pure, easy to unit-test) |
| `lib/exr/` | EXR scraper, ingest, photo re-host, sync |
| `lib/pluto.ts` / `lib/pluto-core.ts` | NYC PLUTO `year_built` lookup by address/lat-lng (guarded re-export + pure/testable core) |
| `lib/radius-map.ts` | hint-token jitter + Static Maps circle-path math (pure/testable) |
| `lib/guess-slider.ts` | log-scale guess slider math (pure/testable) |
| `lib/photo-reveal.ts` | percentage-per-round photo unlock count (pure/testable) |
| `lib/db-error.ts` | translates Postgres errors into actionable admin messages |
| `lib/supabase/admin.ts` | the **only** place the service-role key is used |
| `components/GameCard.tsx` | clue rounds + guess input + hint token UI |
| `components/RevealScreen.tsx` | end-of-game screen |
| `components/TrainBullets.tsx` | MTA line bullets; guards against "Avenue J" parsing as the J train |
| `components/admin/AdminDashboard.tsx` | the whole admin UI (large) |

---

## Data model (Postgres)

All tables have **RLS enabled with zero client policies** — the anon key
reads/writes nothing directly. Every access goes through server route
handlers using the **service-role key**. `actual_rent` only ever leaves the
server via the final `/api/guess` (and freeplay) response.

| Table | Purpose |
|---|---|
| `listings` | The rentals. Clues + `actual_rent`, `photos[]`, `address/lat/lng`, `year_built` (NYC PLUTO, `lib/pluto.ts`), `source` (manual\|exr), `review_status` (draft\|ready), `is_off_market`, `exr_listing_url`, `listing_url`. |
| `daily_challenges` | One listing per date. `edition` = chronological "#N". |
| `scheduled_challenges` | Queue of `challenge_date → listing_id` the cron consults. |
| `guesses` | Final result per user/challenge (unique). Feeds leaderboard/history/crowd. |
| `game_state` | In-progress `current_round` + `guesses[]` + `hint` (hint-token reveal, once spent) — for resume. |
| `profiles` | `display_name`, `streak_count`, `longest_streak`, `total_score`. |

Migrations live in `supabase/migrations/` (`0001` … `0011`). The
consolidated, idempotent schema is in **`SETUP.md`**. Migrations are applied
by hand in the Supabase SQL editor — **if something won't save, check the
latest migration was actually run** (that was the cause once already:
`0010_half_baths.sql` turns `baths` into `numeric(3,1)`).

---

## API routes

**Player**
- `GET  /api/challenge/today` — today's clues + resume state (no rent).
- `POST /api/guess` — records a guess; returns a hint, or the final result
  (the one place `actual_rent` is exposed).
- `POST /api/hint` — spend the puzzle's one hint token (year_built + a
  radius map around a jittered point); idempotent once spent.
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
- `POST /api/admin/schedule/autofill` — queue ready listings onto empty dates.
- `POST /api/admin/fix-transit` — backfill train lines onto station-only clues.
- `POST /api/admin/backfill-year-built` — backfill `year_built` (NYC PLUTO)
  onto listings that predate the feature, any source.
- `POST /api/admin/import-streeteasy` — prefill the form from a StreetEasy link.

**Cron** (Bearer `CRON_SECRET`, configured in `vercel.json`)
- `GET /api/cron/new-challenge` — daily rollover (uses the schedule queue,
  else auto-picks the oldest featurable listing).
- `GET /api/cron/sync-exr` — EXR sync (Mon + Thu).

---

## Admin (`/admin`)

- **Schedule** panel: warns if today is unset, lists upcoming days, shows a
  **days-of-runway** badge, queues a listing to a future date, and
  **Auto-fill 14 days** drops ready listings onto the next empty dates.
- **New/Edit listing**: selects for beds/baths/borough (half baths supported),
  amenity chips, multi-photo upload, optional Google address autocomplete
  (autofills neighborhood/borough/nearest-train + stores lat/lng), listing link.
- **Import from StreetEasy** (`lib/streeteasy.ts` + `/api/admin/import-streeteasy`).
  Three independent layers, so a failure in one doesn't sink the import:
  1. **URL slug** — `/building/<addr>-<borough>/<unit>` yields address, unit
     and borough with no network at all. (`/rental/<id>` URLs yield nothing.)
  2. **Page read** — best-effort `fetch`, then JSON-LD → `og:` meta → visible
     text for rent/beds/baths/sqft/amenities/photos. Each attempt records
     status/bytes/verdict, surfaced in the admin under *"What the fetch got
     back"*. If it's blocked, paste the page instead — **plain text works**
     (⌘A/⌘C on the listing); page source additionally gets photos.
  3. **Geocode** — the address is resolved client-side for exact
     neighborhood, nearest train + walk time, and lat/lng.
  Imported photos are de-duplicated by Zillow photo id (the CDN serves one
  photo at many sizes) and re-hosted into our Storage bucket.
- **Listings** list: source/status filter, search, EXR sync + photo backfill
  + "Add train lines" buttons, per-row actions.
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
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional; enables admin address autofill + nearest-train |

The Maps key needs **Maps JavaScript API** and **Places API**. *Geocoding API*
is a separate product and often isn't enabled — `geocodeAddress()` falls back
to a Places lookup when it's missing, so the import still works.

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
EXR sync `0 8 * * 1,4` (Mon + Thu).

---

## Known issues (as of the last session)

The game loop, admin CRUD, scheduling and the EXR pipeline are working in
production. **The admin listing-import flow is still glitchy** and is the
place to pick up. Reported and unresolved:

- **Neighborhood sometimes doesn't land in the form after a StreetEasy
  import.** The server reported filling it and the input *is* bound to
  `form.neighborhood`, so this couldn't be reproduced by inspection. The
  import summary was changed to name the values it filled ("neighborhood
  “Williamsburg”") specifically so the next report can distinguish "the
  server sent nothing" from "the field didn't update" — **get that message
  text first**, it decides which half to look at.
- General "still a little glitchy" feedback on the import flow that hasn't
  been pinned to a specific reproducible step yet.

Fixed but worth knowing, because they're the shape of bug this area produces:

- Duplicate photos on import — Zillow serves one photo at many sizes under
  different URLs; deduped on photo id now.
- The address had no form field at all, only a "📍" line, which read as
  "didn't fill in".
- Map pin/walk-time silently missing because the Geocoding API isn't enabled
  (Places fallback added).
- Manual saves failing with no explanation — the routes swallowed the
  Postgres error. `lib/db-error.ts` now translates it.

### Debugging this area

1. The admin surfaces real errors now — read the on-screen message before
   theorizing; it carries the Postgres error and the fetch verdicts.
2. `console.error` lines in the listing routes show up in Vercel runtime logs.
3. `lib/streeteasy.ts` is pure and dependency-free — the fastest loop is a
   throwaway `npx tsx` script feeding it fixture HTML/text, not a deploy.

## Still open / not built

- Analytics view (perceived vs. actual rent) — planned, not built.
- Design tokens are a **placeholder** direction (resios.co has no formal
  brand system yet).
- Most EXR listings sit as `draft` + on-market, so the featurable pool (and
  the runway badge) stays small until they lease or are manually approved.

---

## Gotchas

Things that cost real time on this codebase:

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** and the export is
  `proxy`, not `middleware`. Using the old name fails the build.
- **Pages that touch the DB need `export const dynamic = "force-dynamic"`**,
  or prerendering fails with "supabaseUrl is required".
- The Supabase env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (integration-
  managed and locked in Vercel), *not* `..._ANON_KEY`.
- **Lint is strict**: `react-hooks/set-state-in-effect` and
  `react-hooks/purity` will fail the build. Put `Math.random()`/`Date.now()`
  in a lazy `useState` initializer, never in render.
- `baths` is **`numeric(3,1)`** (migration 0010), so it can come back as
  `"1.0"` — normalize with `Number()` before comparing to a select option.
- `@googlemaps/js-api-loader` v2 uses the functional `setOptions()` /
  `importLibrary()` API; the `Loader` class is deprecated.
- **Never** reference `SUPABASE_SERVICE_ROLE_KEY` from a `"use client"` file.
- The Supabase project for this game is `dujfvhlqlslqqxfihaxa`. The ref
  `eddarevdrkpzurzmebub` is a **different, unrelated production project** —
  never point anything here at it.
- Some sandboxes block outbound `streeteasy.com` / `exrplatform.com`, so the
  scrapers can't be exercised locally there; test the parsers against fixture
  text instead and verify the network path in a deploy.
