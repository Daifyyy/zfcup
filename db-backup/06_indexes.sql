-- =============================================================
-- ZF Cup — 06_indexes.sql
-- Indexy na FK sloupcích + RPC funkce pro přepočet bodů tipérů.
-- Bezpečné opakované spuštění: IF NOT EXISTS / CREATE OR REPLACE
-- Spouštět po jednom příkazu pokud SQL Editor timeoutuje.
-- =============================================================

-- -------------------------------------------------------
-- Indexy na FK sloupcích (prevence full table scan)
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tips_tipster_id         ON tips(tipster_id);
CREATE INDEX IF NOT EXISTS idx_tips_match_id           ON tips(match_id);
CREATE INDEX IF NOT EXISTS idx_bracket_tips_tipster_id ON bracket_tips(tipster_id);
CREATE INDEX IF NOT EXISTS idx_bracket_tips_slot_id    ON bracket_tips(slot_id);
CREATE INDEX IF NOT EXISTS idx_special_tips_tipster_id ON special_tips(tipster_id);
CREATE INDEX IF NOT EXISTS idx_goals_match_id          ON goals(match_id);
CREATE INDEX IF NOT EXISTS idx_goals_player_id         ON goals(player_id);
CREATE INDEX IF NOT EXISTS idx_bracket_goals_slot_id   ON bracket_goals(slot_id);
CREATE INDEX IF NOT EXISTS idx_bracket_goals_player_id ON bracket_goals(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_group_id        ON matches(group_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id         ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_bracket_slots_round_id  ON bracket_slots(round_id);

-- -------------------------------------------------------
-- RPC funkce: hromadný přepočet bodů všech tipérů
-- Jeden SQL příkaz místo 4N dotazů z frontendu.
-- Volání: supabase.rpc('recalc_all_tipster_points')
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION recalc_all_tipster_points()
RETURNS void AS $$
  UPDATE tipsters SET total_points = (
    SELECT COALESCE(SUM(t.points_earned), 0)
    FROM tips t WHERE t.tipster_id = tipsters.id
  ) + (
    SELECT COALESCE(SUM(bt.points_earned), 0)
    FROM bracket_tips bt WHERE bt.tipster_id = tipsters.id
  ) + (
    SELECT COALESCE(SUM(st.points_earned), 0)
    FROM special_tips st WHERE st.tipster_id = tipsters.id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Oprávnění pro volání přes anon klíč (frontend)
GRANT EXECUTE ON FUNCTION recalc_all_tipster_points() TO anon;
GRANT EXECUTE ON FUNCTION recalc_all_tipster_points() TO authenticated;
