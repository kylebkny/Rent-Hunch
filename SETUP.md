# What's the Rent — one-time setup

Do these once to take the app from "builds fine" to "live and playable."
Order matters a little: SQL + Supabase toggles first, then Vercel env, then
redeploy, then seed a listing.

---

## 1. Supabase — run the schema (SQL Editor → New query → Run)

Idempotent; safe to run even if you've run earlier migrations.

```sql
-- Tables (base shape) --------------------------------------------------
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  neighborhood text not null,
  city text not null default 'Brooklyn',
  beds int not null,
  baths numeric(3,1) not null,
  sqft int,
  amenities jsonb not null default '[]'::jsonb,
  transit text not null,
  actual_rent int not null,
  status text not null default 'active' check (status in ('active','used')),
  created_at timestamptz not null default now()
);

create table if not exists daily_challenges (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id),
  challenge_date date not null unique,
  edition int generated always as identity,
  created_at timestamptz not null default now()
);

create table if not exists guesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  challenge_id uuid not null references daily_challenges(id),
  round int not null,
  guess_amount int not null,
  score int not null,
  locked_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create table if not exists game_state (
  user_id uuid not null references auth.users(id),
  challenge_id uuid not null references daily_challenges(id),
  current_round int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  streak_count int not null default 0,
  longest_streak int not null default 0,
  total_score int not null default 0,
  created_at timestamptz not null default now()
);

-- Later columns (safe if already present) ------------------------------
alter table listings alter column sqft drop not null;
alter table listings add column if not exists nearby text;
alter table listings add column if not exists photos jsonb not null default '[]'::jsonb;
alter table listings add column if not exists source text not null default 'manual' check (source in ('manual','exr'));
alter table listings add column if not exists review_status text not null default 'ready' check (review_status in ('draft','ready'));
alter table listings add column if not exists exr_listing_url text;
alter table listings add column if not exists is_off_market boolean not null default true;
alter table game_state add column if not exists guesses jsonb not null default '[]'::jsonb;
alter table listings add column if not exists listing_url text;
alter table listings add column if not exists address text;
alter table listings add column if not exists lat double precision;
alter table listings add column if not exists lng double precision;

-- Indexes --------------------------------------------------------------
create index if not exists listings_status_idx on listings(status);
create index if not exists listings_eligible_idx on listings(status, review_status);
create index if not exists daily_challenges_date_idx on daily_challenges(challenge_date);
create index if not exists guesses_challenge_idx on guesses(challenge_id);
create index if not exists profiles_total_score_idx on profiles(total_score desc);

-- RLS: enabled, zero client policies (all access via the service role) --
alter table listings enable row level security;
alter table daily_challenges enable row level security;
alter table guesses enable row level security;
alter table game_state enable row level security;
alter table profiles enable row level security;

-- Storage bucket for listing photos ------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-photos','listing-photos', true)
on conflict (id) do nothing;
```

## 2. Supabase — Authentication

- **Anonymous sign-ins:** Authentication → Sign In / Providers → **Anonymous** → enable. (Without this the game shows "Couldn't start a session.")
- **Your admin login:** Authentication → Users → **Add user** → email + password (mark email confirmed). Use the same email you'll put in `ADMIN_EMAILS`.

## 3. Vercel — Environment Variables (Project → renthunch → Settings)

The Supabase integration already provides `SUPABASE_SERVICE_ROLE_KEY` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Add/verify these:

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dujfvhlqlslqqxfihaxa.supabase.co` | |
| `ADMIN_EMAILS` | your admin email | comma-separated for multiple |
| `CRON_SECRET` | a long random string | **no leading/trailing spaces** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | *(optional)* Maps key | enables admin address autofill; see below |

Apply to Production, Preview, and Development.

**Optional — Google Maps admin autofill:** create a Google Cloud project,
enable **Maps JavaScript API** and **Places API**, make a browser API key
restricted by HTTP referrer (your Vercel domains), and set it as
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Then the admin form gets an address search
that auto-fills neighborhood, borough, and nearest train (with walk time) and
stores lat/lng. Without the key, admin entry stays fully manual.

## 4. Redeploy

Env-var changes only take effect on a new deploy: Deployments → latest → Redeploy.

## 5. Seed the first listing & go live

1. Visit `/admin/login`, sign in with the Supabase user from step 2.
2. Add a listing (neighborhood, beds/baths, rent, train, a few photos), Save.
3. On that listing click **Set as today**.
4. Open the main site — play it.

## 6. To-do (manual, when ready)

- Attach the domain **game.resios.co** to the renthunch Vercel project
  (Settings → Domains). Not automated.
- The weekly EXR sync backfills a *future* buffer of off-market listings;
  your manual entries carry the game until that matures.
