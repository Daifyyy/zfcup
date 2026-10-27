-- ════════════════════════════════════════════════════════════════════════════
-- 12 — Indexy podle turnaje (tournament_id) a chybějící indexy cizích klíčů
-- ════════════════════════════════════════════════════════════════════════════
-- Proč: každý turnaj načítá ~19 tabulek filtrem `tournament_id = …`, ale žádná
-- tabulka index na tournament_id nemá → s rostoucím počtem turnajů by každé
-- otevření turnaje procházelo celé tabulky. Dnes je dat málo (rozdíl neměřitelný),
-- indexy jsou příprava na provoz s mnoha turnaji.
-- Navíc indexy cizích klíčů u asistencí a karet (06 je pokrylo jen u gólů) —
-- zrychlí mazání zápasů/hráčů (kaskády) a dotazy podle zápasu.
--
-- Idempotentní (IF NOT EXISTS), tabulky, které neexistují, přeskočí.
-- Na malé DB běží v řádu sekund; zámky tabulek jsou krátké.
--
-- Ověření po spuštění:
--   SELECT tablename, indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND indexname LIKE 'idx_%_tournament%' ORDER BY 1;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'teams', 'players', 'groups', 'matches', 'referees',
    'goals', 'assists', 'cards', 'penalties',
    'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
    'announcements', 'rule_items', 'sponsors',
    'tipsters', 'tips', 'bracket_tips', 'special_tips'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'tournament_id'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tournament_id)', 'idx_' || t || '_tournament_id', t);
    ELSE
      RAISE NOTICE 'Přeskočeno (tabulka nebo sloupec chybí): %', t;
    END IF;
  END LOOP;
END $$;

-- Tipy se čtou podle tipéra v rámci turnaje
CREATE INDEX IF NOT EXISTS idx_tips_tipster_tournament         ON tips (tipster_id, tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_tips_tipster_tournament ON bracket_tips (tipster_id, tournament_id);

-- Cizí klíče asistencí a karet (u gólů a trestů už existují v 06 / 07)
CREATE INDEX IF NOT EXISTS idx_assists_match_id          ON assists (match_id);
CREATE INDEX IF NOT EXISTS idx_assists_player_id         ON assists (player_id);
CREATE INDEX IF NOT EXISTS idx_bracket_assists_slot_id   ON bracket_assists (slot_id);
CREATE INDEX IF NOT EXISTS idx_bracket_assists_player_id ON bracket_assists (player_id);
CREATE INDEX IF NOT EXISTS idx_cards_match_id            ON cards (match_id);
CREATE INDEX IF NOT EXISTS idx_cards_player_id           ON cards (player_id);
CREATE INDEX IF NOT EXISTS idx_bracket_cards_slot_id     ON bracket_cards (slot_id);
CREATE INDEX IF NOT EXISTS idx_bracket_cards_player_id   ON bracket_cards (player_id);
CREATE INDEX IF NOT EXISTS idx_matches_referee_id        ON matches (referee_id);
CREATE INDEX IF NOT EXISTS idx_bracket_slots_referee_id  ON bracket_slots (referee_id);
