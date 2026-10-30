-- ════════════════════════════════════════════════════════════════════════════
-- 22 — Hráč zápasu (MVP) a ruční úpravy nejlepší sestavy (Vlna 1, bod 3)
-- ════════════════════════════════════════════════════════════════════════════
--   matches.mvp_player_id, bracket_slots.mvp_player_id : hráč zápasu (smazání hráče → NULL)
--   tournament.best_team : ruční obsazení míst nejlepší sestavy
--                          {"slots": {"0": "<id brankáře>", "2": "<id hráče>"}} — ostatní místa
--                          doplní automatika (src/lib/bestTeam.ts)
-- Čtení a zápis pokrývají stávající politiky tabulek (migrace 11 a 15).
-- Frontend funguje i bez této migrace (volba hráče zápasu a úprava sestavy hlásí chybějící migraci).
-- Idempotentní.

ALTER TABLE matches       ADD COLUMN IF NOT EXISTS mvp_player_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE bracket_slots ADD COLUMN IF NOT EXISTS mvp_player_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE tournament    ADD COLUMN IF NOT EXISTS best_team JSONB;

CREATE INDEX IF NOT EXISTS matches_mvp_player_id_idx       ON matches (mvp_player_id)       WHERE mvp_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bracket_slots_mvp_player_id_idx ON bracket_slots (mvp_player_id) WHERE mvp_player_id IS NOT NULL;

-- Ověření:
-- SELECT count(*) FILTER (WHERE mvp_player_id IS NOT NULL) FROM matches;
-- SELECT name, best_team FROM tournament LIMIT 5;
