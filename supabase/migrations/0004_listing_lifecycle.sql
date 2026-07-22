-- Listing sourcing + vetting lifecycle.
--
-- source:        where the listing came from ('manual' | 'exr').
-- review_status: vetting gate ('draft' | 'ready'). Manual listings are
--                'ready' immediately; scraper listings land as 'draft' until
--                a human vets them. The daily rollover only picks listings
--                that are both status='active' AND review_status='ready'.

alter table listings add column if not exists source text not null default 'manual'
  check (source in ('manual', 'exr'));

alter table listings add column if not exists review_status text not null default 'ready'
  check (review_status in ('draft', 'ready'));

-- Off-market safety: for scraper (exr) listings we only ever ingest units
-- that are already leased/off-market, tracked here so we never feature a
-- live asking price.
alter table listings add column if not exists exr_listing_url text;
alter table listings add column if not exists is_off_market boolean not null default true;

create index if not exists listings_eligible_idx
  on listings (status, review_status);

-- Public bucket for listing photos (re-hosted from uploads / the scraper).
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;
