-- ═══════════════════════════════════════════════════════════════════════════
-- 18 — Doplnění migrace 17: vypnout VŠECHNY anonymní zápisy tipovačky
-- Spustit v Supabase SQL Editoru (idempotentní).
--
-- Migrace 17 mazala politiky podle názvů z 02_rls.sql. V databázi ale existují politiky
-- s jinými názvy ("anon_insert", "anon_update", role public) → zůstaly. Tato migrace maže
-- podle role, ne podle názvu: u tabulek tipovačky odstraní každou zápisovou politiku
-- (INSERT/UPDATE/DELETE/ALL), která platí pro roli anon nebo public.
-- Politiky organizátora ("owner_write", role authenticated) a čtení zůstávají.
--
-- Před znovuzapnutím tipovačky je nutné bezpečné řešení (hash PINů, zápis přes RPC se zámkem).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('tipsters', 'tips', 'bracket_tips', 'special_tips')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
  LOOP
    RAISE NOTICE 'Mažu politiku "%" (%) na tabulce %', p.policyname, p.cmd, p.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Kontrola: musí vrátit 0 řádků (žádná tabulka nepovoluje zápis anon/public)
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
ORDER BY tablename, policyname;
