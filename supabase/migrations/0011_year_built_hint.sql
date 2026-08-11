-- year_built: NYC PLUTO enrichment (lib/pluto.ts), independent of listing
-- source (manual/EXR/StreetEasy) — nullable since PLUTO coverage/matching
-- isn't guaranteed for every address.
alter table listings add column if not exists year_built int;

-- hint: the single per-puzzle hint token's spent state, bundled with its
-- reveal payload so a resumed session shows the same jittered map instead
-- of generating (and thus potentially leaking, via repeated regeneration)
-- a fresh one. Null = token unspent. Lives alongside current_round/guesses
-- so it survives exactly the same way the rest of in-progress state does.
alter table game_state add column if not exists hint jsonb;
