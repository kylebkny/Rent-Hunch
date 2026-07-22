# Rent Hunch

A daily rent-price-guessing game for Brooklyn rentals. Companion to
[resios.co](https://resios.co) but fully isolated: separate Vercel project,
separate Supabase project.

## Stack

- Next.js (App Router) + Tailwind v4
- Supabase (Postgres + Auth, anonymous sessions)
- Vercel Cron for the daily challenge rollover

## Local development

```bash
cp .env.local.example .env.local   # fill in Supabase + cron secret values
npm install
npm run dev
```

## Database

Schema + RLS lives in `supabase/migrations/0001_init.sql`. Every table has
RLS enabled with **no client-facing policies** — the anon key can't read or
write any game table directly. All access goes through server route
handlers (`app/api/**`) using the service-role key
(`lib/supabase/admin.ts`, server-only).

## Cron

`vercel.json` schedules `GET /api/cron/new-challenge` daily. The route
checks `Authorization: Bearer $CRON_SECRET` — set `CRON_SECRET` as a Vercel
project env var so Vercel's own cron invocations are authorized.
