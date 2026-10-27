-- ════════════════════════════════════════════════════════════════════════════
-- 10 — Realtime: zařadit tabulky do publikace supabase_realtime
-- ════════════════════════════════════════════════════════════════════════════
-- Proč: frontend odebírá změny přes postgres_changes (src/lib/realtimeManager.ts),
-- ale bez zařazení tabulek do publikace DB žádné události neposílá → živé výsledky
-- se divákům obnoví až pollingem (120 s). Zjištěno při E2E testu 2026-10-27.
--
-- Diagnostika (spustit před i po):
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;
--
-- Idempotentní — lze spustit opakovaně; tabulky, které neexistují, přeskočí.
-- Realtime respektuje RLS (SELECT politiky public_read), nic dalšího není potřeba.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'tournament', 'competitions', 'teams', 'players', 'groups', 'matches',
    'goals', 'assists', 'cards', 'penalties',
    'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
    'announcements', 'rule_items', 'sponsors', 'referees',
    'tipsters', 'tips', 'bracket_tips', 'special_tips'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Přidáno do realtime: %', t;
    END IF;
  END LOOP;
END $$;
