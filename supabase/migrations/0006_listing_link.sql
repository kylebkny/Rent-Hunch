-- Optional link to the source/original listing, shown on the reveal as a
-- payoff. For scraped listings the scraper's exr_listing_url is used as a
-- fallback; this column lets an admin set/override it for manual listings.
alter table listings add column if not exists listing_url text;
