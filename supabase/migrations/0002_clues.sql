-- Clue-set correction: rentals rarely have square footage, so sqft can no
-- longer be a required core clue. Add "places it's near" (nearby) as a new
-- clue field, which the broker always has on hand.

alter table listings alter column sqft drop not null;
alter table listings add column if not exists nearby text;
