-- ═══════════════════════════════════════════════════════════════════════════
-- 17 — Dočasně vypnout anonymní zápisy tipovačky (audit 2026-10)
-- Spustit v Supabase SQL Editoru (idempotentní).
--
-- Tipovačka je globálně vypnutá (platform_settings.tips_globally_enabled), ale politiky
-- z 02_rls.sql dál dovolují komukoli bez přihlášení vkládat tipéry a tipy do LIBOVOLNÉHO
-- turnaje a měnit cizí tipy (USING (true)). To je cesta pro spam a plnění databáze.
--
-- Dokud nebude hotové zabezpečení tipovačky (hash PINů, zápis přes RPC se zámkem — viz plán),
-- anonymní zápisy rušíme. Organizátor (owner_write) i čtení zůstávají beze změny.
-- Před znovuzapnutím tipovačky nahradit bezpečným řešením — NE vracet tyto politiky.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "anon_insert_tipsters"     ON tipsters;
DROP POLICY IF EXISTS "anon_insert_tips"         ON tips;
DROP POLICY IF EXISTS "anon_update_tips"         ON tips;
DROP POLICY IF EXISTS "anon_insert_bracket_tips" ON bracket_tips;
DROP POLICY IF EXISTS "anon_update_bracket_tips" ON bracket_tips;
DROP POLICY IF EXISTS "anon_insert_special_tips" ON special_tips;
DROP POLICY IF EXISTS "anon_update_special_tips" ON special_tips;

-- Kontrola: anon nesmí mít u žádné tabulky zápisovou politiku
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
ORDER BY tablename, policyname;
