-- Multi-guess: players make up to 4 guesses (one per clue round), with
-- higher/lower + warmer/colder hints between them. In-progress guesses live
-- in game_state so a player can resume mid-round; the single canonical
-- result still lands in `guesses` when they finish.
alter table game_state add column if not exists guesses jsonb not null default '[]'::jsonb;
