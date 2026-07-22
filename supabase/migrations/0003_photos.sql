-- Listing photos, revealed progressively during play. Stored as an ordered
-- array of image URLs (Supabase Storage public URLs, or external URLs for
-- the hybrid case). Empty array => the game falls back to the SVG facade.

alter table listings add column if not exists photos jsonb not null default '[]'::jsonb;
