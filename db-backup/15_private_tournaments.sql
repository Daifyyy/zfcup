-- ═══════════════════════════════════════════════════════════════════════════
-- 15 — Veřejné / soukromé turnaje s přístupovým kódem
-- Spustit v Supabase SQL Editoru (jednorázově, idempotentní).
--
-- Soukromý turnaj (visibility = 'private') a všechna jeho data smí číst jen:
--   • vlastník turnaje a správce platformy (přihlášení),
--   • kdokoli, kdo pošle správný přístupový kód v hlavičce `x-access-code`
--     (aplikace ji přidává ke všem dotazům; víc kódů oddělených čárkou).
-- Realtime: diváci s kódem nedostávají živé události (Realtime hlavičky nezná)
-- → aplikace u nich obnovuje data častěji (polling).
-- Pozn.: soubory ve Storage (loga, fotky) zůstávají dostupné přes přímou URL.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sloupce ──────────────────────────────────────────────────────────────
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS access_code TEXT;

DO $$ BEGIN
  ALTER TABLE tournament ADD CONSTRAINT tournament_visibility_check CHECK (visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_access_code ON tournament(access_code) WHERE access_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournament_visibility ON tournament(visibility);

-- ── 2. Funkce ───────────────────────────────────────────────────────────────
-- Kódy z hlavičky požadavku (PostgREST plní request.headers; mimo API = prázdné)
CREATE OR REPLACE FUNCTION public.request_access_codes() RETURNS TEXT[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    string_to_array(upper(NULLIF(current_setting('request.headers', true)::json->>'x-access-code', '')), ','),
    '{}'::TEXT[]
  );
$$;

-- Smí aktuální požadavek číst data turnaje?
CREATE OR REPLACE FUNCTION public.can_read_tournament(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament t
    WHERE t.id = tid AND (
      t.visibility = 'public'
      OR (t.access_code IS NOT NULL AND t.access_code = ANY (public.request_access_codes()))
      OR (auth.uid() IS NOT NULL AND (t.owner_id = auth.uid() OR public.is_platform_admin()))
    )
  );
$$;

-- Zadání kódu na úvodní stránce → id turnaje (nic jiného neprozradí)
CREATE OR REPLACE FUNCTION public.find_tournament_by_code(code TEXT) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tournament WHERE access_code = upper(trim(code)) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.request_access_codes()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_tournament(UUID)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_tournament_by_code(TEXT)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_access_codes()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_tournament(UUID)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_tournament_by_code(TEXT) TO anon, authenticated;

-- ── 3. RLS čtení ────────────────────────────────────────────────────────────
-- Turnaj: podmínka přímo nad sloupci řádku (funguje i pro INSERT … RETURNING nového turnaje)
DROP POLICY IF EXISTS "public_read" ON tournament;
CREATE POLICY "public_read" ON tournament FOR SELECT USING (
  visibility = 'public'
  OR (access_code IS NOT NULL AND access_code = ANY (public.request_access_codes()))
  OR (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR public.is_platform_admin()))
);

-- Všechny tabulky se sloupcem tournament_id
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'teams', 'players', 'groups', 'matches', 'goals', 'assists', 'cards', 'penalties',
    'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
    'announcements', 'rule_items', 'referees', 'sponsors',
    'tipsters', 'tips', 'bracket_tips', 'special_tips'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "public_read" ON %I', tbl);
      EXECUTE format('CREATE POLICY "public_read" ON %I FOR SELECT USING (public.can_read_tournament(tournament_id))', tbl);
    END IF;
  END LOOP;
END $$;

-- ── 4. Kontrola ─────────────────────────────────────────────────────────────
-- SELECT visibility, count(*) FROM tournament GROUP BY 1;
-- Žádná jiná politika nesmí dál pouštět čtení všem (qual = true) u tabulek turnaje:
-- SELECT tablename, policyname, cmd, roles, qual FROM pg_policies
--   WHERE schemaname = 'public' AND cmd IN ('SELECT', 'ALL') ORDER BY 1, 2;
-- Anonymně (anon key, bez hlavičky) soukromý turnaj ani jeho zápasy nevrátí žádný řádek.
