-- Geocoded location for listings (from Google Maps in the admin). Stored for
-- data consistency and future map/distance features on the front end. The
-- address is internal only — never sent as a game clue (it would give the
-- answer away); it's revealed only via the post-game listing link.
alter table listings add column if not exists address text;
alter table listings add column if not exists lat double precision;
alter table listings add column if not exists lng double precision;
