-- ═══════════════════════════════════════════════════════════════════════════
-- 19 — Soutěž dědí viditelnost ze svých ročníků
-- Spustit v Supabase SQL Editoru (idempotentní). Vyžaduje migraci 15.
--
-- Soutěž (competitions) je čitelná, když:
--   • ji smí upravovat přihlášený uživatel (vlastník / správce platformy), nebo
--   • má aspoň jeden ročník, který aktuální požadavek smí číst
--     (veřejný ročník, vlastní, nebo odemčený přístupovým kódem — can_read_tournament).
-- Soutěž jen se soukromými ročníky (nebo bez ročníků) je tedy pro ostatní skrytá.
-- Kluby zůstávají veřejné — jejich stránka ukazuje jen turnaje, které RLS pustí.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_read_competition(cid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_edit_competition(cid)
      OR EXISTS (SELECT 1 FROM tournament t WHERE t.competition_id = cid AND public.can_read_tournament(t.id));
$$;
REVOKE ALL ON FUNCTION public.can_read_competition(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_competition(UUID) TO anon, authenticated;

-- Všechny dosavadní politiky čtení soutěží pryč (i ty, které v živé DB vznikly mimo db-backup)
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'competitions'
      AND (cmd = 'SELECT' OR (cmd = 'ALL' AND policyname <> 'owner_write'))
  LOOP
    RAISE NOTICE 'Mažu politiku "%" na tabulce competitions', p.policyname;
    EXECUTE format('DROP POLICY %I ON public.competitions', p.policyname);
  END LOOP;
END $$;

-- Vlastník přímo podle sloupce řádku (funguje i pro INSERT … RETURNING nové soutěže,
-- kde funkce s dotazem do tabulky nový řádek ještě nevidí)
CREATE POLICY "public_read" ON competitions FOR SELECT USING (
  (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR public.is_platform_admin()))
  OR EXISTS (SELECT 1 FROM tournament t WHERE t.competition_id = competitions.id AND public.can_read_tournament(t.id))
);

-- Kontrola: politiky soutěží (čtení jen "public_read")
SELECT policyname, cmd, roles, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'competitions' ORDER BY cmd, policyname;
