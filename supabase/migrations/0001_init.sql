-- Rent Hunch schema. RLS is enabled on every table with ZERO client-facing
-- policies: the anon key gets nothing back from any of these tables. All
-- reads/writes go through server route handlers using the service-role key.

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  neighborhood text not null,
  city text not null default 'Brooklyn',
  beds int not null,
  baths int not null,
  sqft int not null,
  amenities jsonb not null default '[]'::jsonb,
  transit text not null,
  actual_rent int not null,
  status text not null default 'active' check (status in ('active', 'used')),
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

create index if not exists listings_status_idx on listings(status);
create index if not exists daily_challenges_date_idx on daily_challenges(challenge_date);
create index if not exists guesses_challenge_idx on guesses(challenge_id);
create index if not exists profiles_total_score_idx on profiles(total_score desc);

alter table listings enable row level security;
alter table daily_challenges enable row level security;
alter table guesses enable row level security;
alter table game_state enable row level security;
alter table profiles enable row level security;

-- Intentionally no policies: RLS is on, nothing is granted to anon/authenticated.
-- All access goes through server route handlers using the service-role key,
-- which bypasses RLS.
