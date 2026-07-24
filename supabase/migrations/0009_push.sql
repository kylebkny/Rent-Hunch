-- Opt-in web-push reminder subscriptions. One row per browser/device
-- endpoint. Managed only via server routes (service role); RLS on, no
-- client policies.
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
