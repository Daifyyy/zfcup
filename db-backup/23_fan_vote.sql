-- ════════════════════════════════════════════════════════════════════════════
-- 23 — Hlasování diváků o hráči zápasu (modul `fan_vote`, Vlna 5 bod 5.2)
-- ════════════════════════════════════════════════════════════════════════════
--   fan_votes            : hlasy (z API nikdo nečte ani nezapisuje přímo — žádné politiky)
--   cast_fan_vote(...)   : jediná cesta k hlasu; ověří modul, zápas, hráče, den a limity
--   fan_vote_results(..) : součty hlasů pro turnaj (jen kdo turnaj smí číst — soukromý s kódem)
-- Pravidla: jeden hlas na zařízení a zápas (lze změnit), max. 300 hlasů z jedné IP na zápas
-- (sdílené Wi-Fi v hale), hlasovat jde jen v den zápasu, když už začal nebo skončil.
-- Vypnutí modulu hlasy nemaže (jen se skryjí). Idempotentní.

CREATE TABLE IF NOT EXISTS fan_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL,                       -- matches.id nebo bracket_slots.id
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voter         TEXT NOT NULL CHECK (char_length(voter) BETWEEN 16 AND 64),  -- náhodné id zařízení
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, voter)
);
CREATE INDEX IF NOT EXISTS fan_votes_tournament_id_idx ON fan_votes (tournament_id);
CREATE INDEX IF NOT EXISTS fan_votes_game_ip_idx ON fan_votes (game_id, ip_hash);
ALTER TABLE fan_votes ENABLE ROW LEVEL SECURITY;
-- Záměrně bez politik a mimo seznam migrace 15: přístup jen přes funkce níže.

CREATE OR REPLACE FUNCTION public.cast_fan_vote(p_game UUID, p_player UUID, p_voter TEXT)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tid     UUID;
  v_home    UUID;
  v_away    UUID;
  v_played  BOOLEAN;
  v_score   INT;
  v_time    TEXT;
  v_date    TEXT;
  v_day     TEXT;
  v_team    UUID;
  v_stage   TEXT;
  v_enabled BOOLEAN;
  v_today   DATE := (now() AT TIME ZONE 'Europe/Prague')::date;
  v_ip      TEXT;
BEGIN
  IF p_voter IS NULL OR char_length(p_voter) NOT BETWEEN 16 AND 64 THEN RETURN 'invalid'; END IF;

  SELECT m.tournament_id, m.home_id, m.away_id, m.played, coalesce(m.home_score, 0) + coalesce(m.away_score, 0), m.scheduled_time, m.match_date::text
    INTO v_tid, v_home, v_away, v_played, v_score, v_time, v_date
    FROM matches m WHERE m.id = p_game;
  IF v_tid IS NULL THEN
    SELECT s.tournament_id, s.home_id, s.away_id, s.played, coalesce(s.home_score, 0) + coalesce(s.away_score, 0), s.scheduled_time, s.match_date::text
      INTO v_tid, v_home, v_away, v_played, v_score, v_time, v_date
      FROM bracket_slots s WHERE s.id = p_game;
  END IF;
  IF v_tid IS NULL OR v_home IS NULL OR v_away IS NULL THEN RETURN 'not_found'; END IF;
  IF NOT public.can_read_tournament(v_tid) THEN RETURN 'not_found'; END IF;

  -- Modul: na platformě není vypnutý a pořadatel ho u turnaje zapnul
  SELECT coalesce(ps.modules ->> 'fan_vote', 'off') INTO v_stage FROM platform_settings ps WHERE ps.id;
  SELECT coalesce((t.modules ->> 'fan_vote')::boolean, false), coalesce(nullif(v_date, ''), t.tips_lock_from)
    INTO v_enabled, v_day FROM tournament t WHERE t.id = v_tid;
  IF coalesce(v_stage, 'off') = 'off' OR NOT v_enabled THEN RETURN 'disabled'; END IF;

  -- Jen v den zápasu, a když už začal (podle času nebo skóre) nebo skončil
  IF v_day IS NULL OR v_day <> v_today::text THEN RETURN 'closed'; END IF;
  IF NOT v_played AND v_score = 0 AND (
       v_time IS NULL OR v_time !~ '^\d{1,2}:\d{2}'
       OR split_part(v_time, ':', 1)::int * 60 + left(split_part(v_time, ':', 2), 2)::int
          > extract(hour FROM now() AT TIME ZONE 'Europe/Prague')::int * 60 + extract(minute FROM now() AT TIME ZONE 'Europe/Prague')::int
     ) THEN
    RETURN 'not_started';
  END IF;

  SELECT p.team_id INTO v_team FROM players p WHERE p.id = p_player;
  IF v_team IS NULL OR (v_team <> v_home AND v_team <> v_away) THEN RETURN 'invalid'; END IF;

  -- Strop na IP (proti skriptům); IP se ukládá jen jako otisk
  v_ip := md5(coalesce(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), '') || v_tid::text);
  IF (SELECT count(*) FROM fan_votes f WHERE f.game_id = p_game AND f.ip_hash = v_ip) >= 300
     AND NOT EXISTS (SELECT 1 FROM fan_votes f WHERE f.game_id = p_game AND f.voter = p_voter) THEN
    RETURN 'limit';
  END IF;

  INSERT INTO fan_votes (tournament_id, game_id, player_id, voter, ip_hash)
  VALUES (v_tid, p_game, p_player, p_voter, v_ip)
  ON CONFLICT (game_id, voter) DO UPDATE SET player_id = EXCLUDED.player_id, created_at = now();
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.fan_vote_results(p_tournament UUID)
RETURNS TABLE (game_id UUID, player_id UUID, votes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.game_id, f.player_id, count(*)::int
    FROM fan_votes f
   WHERE f.tournament_id = p_tournament AND public.can_read_tournament(p_tournament)
   GROUP BY f.game_id, f.player_id;
$$;

REVOKE ALL ON FUNCTION public.cast_fan_vote(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fan_vote_results(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_fan_vote(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fan_vote_results(UUID) TO anon, authenticated;

-- Ověření:
-- SELECT public.fan_vote_results('<id turnaje>');
-- SELECT policyname FROM pg_policies WHERE tablename = 'fan_votes';   → žádné řádky
