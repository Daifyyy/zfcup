-- ═══════════════════════════════════════════════════════════════════════════
-- 16 — Oprava čtení soukromých turnajů (navazuje na 15)
-- Spustit v Supabase SQL Editoru (idempotentní).
--
-- Test po migraci 15 ukázal, že u některých tabulek (tournament, players, goals…)
-- existují v databázi ještě jiné politiky čtení (např. vytvořené v dashboardu,
-- „Enable read access for all users“), které nejsou v db-backup. Politiky se
-- sčítají (OR) → soukromý turnaj byl dál čitelný bez kódu, včetně access_code.
--
-- Migrace u tabulek turnaje:
--   • zapne RLS (kdyby někde bylo vypnuté),
--   • smaže všechny politiky SELECT kromě "public_read",
--   • smaže všechny politiky ALL kromě "owner_write" (ALL zahrnuje i čtení),
--   • vypíše, co smazala, a na konci seznam zbylých politik.
-- Zápisové politiky (INSERT/UPDATE/DELETE) nechává beze změny.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'tournament',
    'teams', 'players', 'groups', 'matches', 'goals', 'assists', 'cards', 'penalties',
    'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
    'announcements', 'rule_items', 'referees', 'sponsors',
    'tipsters', 'tips', 'bracket_tips', 'special_tips'
  ];
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND ((cmd = 'SELECT' AND policyname <> 'public_read')
          OR (cmd = 'ALL' AND policyname <> 'owner_write'))
    LOOP
      RAISE NOTICE 'Mažu politiku "%" (%) na tabulce %', p.policyname, p.cmd, t;
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Kontrola: u každé tabulky má zůstat pro čtení jen "public_read" (+ "owner_write" pro ALL)
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tournament', 'teams', 'players', 'groups', 'matches', 'goals', 'assists', 'cards', 'penalties',
    'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
    'announcements', 'rule_items', 'referees', 'sponsors', 'tipsters', 'tips', 'bracket_tips', 'special_tips')
  AND cmd IN ('SELECT', 'ALL')
ORDER BY tablename, policyname;
