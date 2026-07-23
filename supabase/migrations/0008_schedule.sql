-- Schedule queue: pre-assign a listing to a future date. The daily rollover
-- cron consults this before auto-picking, so editions stay chronological
-- (today's daily_challenges row is still created on its actual day). One
-- listing per date.
create table if not exists scheduled_challenges (
  challenge_date date primary key,
  listing_id uuid not null references listings(id),
  created_at timestamptz not null default now()
);

alter table scheduled_challenges enable row level security;
-- No client policies: managed only via server routes with the service role.
