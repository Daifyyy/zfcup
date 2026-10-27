-- ════════════════════════════════════════════════════════════════════════════
-- 13 — Knihovna klubů a hráčů organizátora
-- ════════════════════════════════════════════════════════════════════════════
-- Dřív: klub (clubs) a osoba (persons) patřily vždy jedné soutěži (competition_id NOT NULL).
-- Nyní: klub a osoba patří ORGANIZÁTOROVI (owner_id) — jeden klub lze použít v libovolném
-- turnaji či soutěži téhož organizátora. competition_id zůstává jako nepovinný údaj
-- (odkud klub vznikl). Veřejná stránka klubu /k/{slug}.
--
--   clubs   + owner_id, slug (globálně unikátní), competition_id nepovinné
--   persons + owner_id, club_id (aktuální klub = soupiska v knihovně), number, role,
--             competition_id nepovinné
--   RLS     zápis: vlastník nebo správce platformy (starší řádky bez vlastníka: vlastník soutěže)
--   Storage cesta clubs/{clubId}/… smí měnit vlastník klubu
--
-- Spouštět PO 09 a 11. Idempotentní — lze spustit opakovaně, celé v jedné transakci.
-- Frontend funguje i bez této migrace (knihovna klubů se skryje).

BEGIN;

-- ── 1. Sloupce ─────────────────────────────────────────────────────────────
ALTER TABLE clubs   ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE clubs   ADD COLUMN IF NOT EXISTS slug     TEXT;
ALTER TABLE clubs   ALTER COLUMN competition_id DROP NOT NULL;

ALTER TABLE persons ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS club_id  UUID REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS number   INT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS role     TEXT;
ALTER TABLE persons ALTER COLUMN competition_id DROP NOT NULL;

-- ── 2. Vlastník podle soutěže (stávající data) ─────────────────────────────
UPDATE clubs c SET owner_id = comp.owner_id
  FROM competitions comp WHERE c.competition_id = comp.id AND c.owner_id IS NULL;
UPDATE persons p SET owner_id = comp.owner_id
  FROM competitions comp WHERE p.competition_id = comp.id AND p.owner_id IS NULL;

ALTER TABLE clubs   ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE persons ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- ── 3. Slug klubu (URL /k/{slug}) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.slugify_cs(s TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT left(trim(BOTH '-' FROM regexp_replace(
    translate(lower(coalesce(s, '')),
      'áäčďéěëíľĺňóöôřŕšťúůüýž',
      'aacdeeeillnooorrstuuuyz'),
    '[^a-z0-9]+', '-', 'g')), 50);
$$;

-- Doplnit chybějící slugy; duplicity dostanou příponu z id
WITH base AS (
  SELECT id, nullif(public.slugify_cs(name), '') AS s FROM clubs WHERE slug IS NULL
), numbered AS (
  SELECT b.id, coalesce(b.s, 'klub') AS s,
         row_number() OVER (PARTITION BY coalesce(b.s, 'klub') ORDER BY b.id) AS rn
    FROM base b
)
UPDATE clubs c SET slug = CASE
    WHEN n.rn = 1 AND NOT EXISTS (SELECT 1 FROM clubs x WHERE x.slug = n.s) THEN n.s
    ELSE n.s || '-' || left(replace(c.id::text, '-', ''), 6)
  END
  FROM numbered n WHERE c.id = n.id;

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_slug_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_slug_check CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
CREATE UNIQUE INDEX IF NOT EXISTS uq_clubs_slug ON clubs(slug) WHERE slug IS NOT NULL;

-- ── 4. Aktuální klub a dres osoby = poslední ročník, ve kterém hrála ───────
UPDATE persons p SET club_id = sub.club_id,
                     number  = coalesce(p.number, sub.number),
                     role    = coalesce(p.role, sub.role)
  FROM (
    SELECT DISTINCT ON (pl.person_id) pl.person_id, t.club_id, pl.number, pl.role
      FROM players pl
      JOIN teams t       ON t.id = pl.team_id
      JOIN tournament tr ON tr.id = pl.tournament_id
     WHERE pl.person_id IS NOT NULL AND t.club_id IS NOT NULL
     ORDER BY pl.person_id, tr.edition DESC NULLS LAST, tr.created_at DESC NULLS LAST
  ) sub
 WHERE p.id = sub.person_id AND p.club_id IS NULL;

-- ── 5. Indexy ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clubs_owner     ON clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_persons_owner   ON persons(owner_id);
CREATE INDEX IF NOT EXISTS idx_persons_club_id ON persons(club_id);

-- ── 6. Oprávnění ───────────────────────────────────────────────────────────
-- Vlastník řádku, správce platformy; řádek bez vlastníka smí upravit vlastník jeho soutěže.
CREATE OR REPLACE FUNCTION public.can_edit_library(owner UUID, cid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin()
    OR owner = auth.uid()
    OR (owner IS NULL AND cid IS NOT NULL AND public.can_edit_competition(cid))
  );
$$;
REVOKE ALL ON FUNCTION public.can_edit_library(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_library(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "owner_write" ON clubs;
CREATE POLICY "owner_write" ON clubs FOR ALL TO authenticated
  USING (public.can_edit_library(owner_id, competition_id))
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "owner_write" ON persons;
CREATE POLICY "owner_write" ON persons FOR ALL TO authenticated
  USING (public.can_edit_library(owner_id, competition_id))
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());

-- Storage: clubs/{clubId}/soubor smí měnit vlastník klubu (ostatní pravidla beze změny)
CREATE OR REPLACE FUNCTION public.can_edit_storage_path(path TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parts TEXT[] := string_to_array(path, '/');
  base  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.is_platform_admin() THEN RETURN true; END IF;

  IF parts[1] = 'tournaments' AND array_length(parts, 1) >= 3 THEN
    RETURN public.can_edit_tournament(public.try_uuid(parts[2]));
  END IF;

  IF parts[1] = 'clubs' AND array_length(parts, 1) >= 3 THEN
    RETURN EXISTS (SELECT 1 FROM clubs c WHERE c.id = public.try_uuid(parts[2])
                   AND public.can_edit_library(c.owner_id, c.competition_id));
  END IF;

  base := split_part(parts[array_length(parts, 1)], '.', 1);
  IF parts[1] = 'sponsors' AND array_length(parts, 1) = 2 THEN
    RETURN EXISTS (SELECT 1 FROM sponsors s WHERE s.id = public.try_uuid(base) AND public.can_edit_tournament(s.tournament_id));
  ELSIF parts[1] = 'players' AND array_length(parts, 1) = 2 THEN
    RETURN EXISTS (SELECT 1 FROM players p WHERE p.id = public.try_uuid(base) AND public.can_edit_tournament(p.tournament_id));
  ELSIF array_length(parts, 1) = 1 THEN
    RETURN EXISTS (SELECT 1 FROM teams t WHERE t.id = public.try_uuid(base) AND public.can_edit_tournament(t.tournament_id));
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.can_edit_storage_path(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_storage_path(TEXT) TO authenticated;

-- ── 7. Realtime (knihovna se v adminu obnoví bez reloadu) ─────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs', 'persons'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Ověření ────────────────────────────────────────────────────────────────
-- SELECT name, slug, (SELECT email FROM auth.users WHERE id = owner_id) AS owner FROM clubs ORDER BY name;
-- SELECT p.name, c.name AS club, p.number FROM persons p LEFT JOIN clubs c ON c.id = p.club_id ORDER BY 2, 1;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('clubs', 'persons');
