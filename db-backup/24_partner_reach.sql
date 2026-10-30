-- ════════════════════════════════════════════════════════════════════════════
-- 24 — Měřený dosah partnera (modul `partner_reach`, Vlna 5 bod 5.4 + Vlna 2 bod 9)
-- ════════════════════════════════════════════════════════════════════════════
--   partner_links   : QR akce partnera (krátký kód → cílový odkaz + výzva). Čtení jako ostatní
--                     data turnaje (kód potřebuje TV a web), zápis vlastník turnaje.
--   partner_stats   : jen součty po hodinách (skeny podle zdroje, zobrazení spotu, minuty TV,
--                     návštěvy webu). Žádné záznamy o lidech, žádné IP. Bez přímého přístupu.
--   resolve_partner_link(code, source, count) : přesměrování /r/{kód} (Cloudflare / Vercel)
--   track_reach(tournament, kind, sponsor, amount) : TV a web přičtou součet (s limity)
--   partner_report(tournament) : součty pro report (jen kdo turnaj smí upravovat)
-- Vytištěné QR fungují vždy (i po vypnutí modulu) — počítá se jen při zapnutém modulu.
-- Idempotentní.

CREATE TABLE IF NOT EXISTS partner_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  sponsor_id    UUID REFERENCES sponsors(id) ON DELETE SET NULL,   -- smazaný partner: QR dál vede na cíl
  code          TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]{6,12}$'),
  target_url    TEXT NOT NULL CHECK (target_url ~* '^https?://' AND char_length(target_url) <= 500),
  cta           TEXT CHECK (char_length(cta) <= 120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, sponsor_id)
);
CREATE INDEX IF NOT EXISTS partner_links_tournament_id_idx ON partner_links (tournament_id);
ALTER TABLE partner_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON partner_links;
DROP POLICY IF EXISTS "owner_write" ON partner_links;
CREATE POLICY "public_read" ON partner_links FOR SELECT USING (public.can_read_tournament(tournament_id));
CREATE POLICY "owner_write" ON partner_links FOR ALL TO authenticated
  USING (public.can_edit_tournament(tournament_id)) WITH CHECK (public.can_edit_tournament(tournament_id));

CREATE TABLE IF NOT EXISTS partner_stats (
  tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  sponsor_id    UUID,                    -- NULL = celý turnaj (návštěvy webu, minuty TV)
  kind          TEXT NOT NULL CHECK (kind IN ('scan', 'tv_spot', 'tv_minutes', 'visit')),
  source        TEXT NOT NULL DEFAULT '' CHECK (char_length(source) <= 12),
  hour          TIMESTAMPTZ NOT NULL,    -- začátek hodiny
  amount        INT NOT NULL DEFAULT 0
);
-- jeden řádek na turnaj × partnera × druh × zdroj × hodinu (NULL partner jako '')
CREATE UNIQUE INDEX IF NOT EXISTS partner_stats_key ON partner_stats
  (tournament_id, (coalesce(sponsor_id::text, '')), kind, source, hour);
ALTER TABLE partner_stats ENABLE ROW LEVEL SECURITY;
-- Záměrně bez politik a mimo seznam migrace 15: přístup jen přes funkce níže.

-- Modul zapnutý (platforma ne „off“ a turnaj ho má zapnutý)
CREATE OR REPLACE FUNCTION public.partner_reach_on(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT ps.modules ->> 'partner_reach' FROM platform_settings ps WHERE ps.id), 'off') <> 'off'
     AND coalesce((SELECT (t.modules ->> 'partner_reach')::boolean FROM tournament t WHERE t.id = tid), false);
$$;

CREATE OR REPLACE FUNCTION public.bump_partner_stat(tid UUID, sid UUID, k TEXT, src TEXT, n INT) RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO partner_stats (tournament_id, sponsor_id, kind, source, hour, amount)
  VALUES (tid, sid, k, coalesce(src, ''), date_trunc('hour', now()), n)
  ON CONFLICT (tournament_id, (coalesce(sponsor_id::text, '')), kind, source, hour)
  DO UPDATE SET amount = partner_stats.amount + EXCLUDED.amount;
$$;

-- Přesměrování: vrátí cílovou adresu (nebo NULL). p_count = false pro roboty náhledů odkazů.
CREATE OR REPLACE FUNCTION public.resolve_partner_link(p_code TEXT, p_source TEXT, p_count BOOLEAN DEFAULT true)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l partner_links%ROWTYPE;
  src TEXT := CASE WHEN p_source IN ('tv', 'social', 'print', 'web') THEN p_source ELSE 'other' END;
BEGIN
  SELECT * INTO l FROM partner_links WHERE code = lower(p_code);
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_count AND public.partner_reach_on(l.tournament_id) THEN
    PERFORM public.bump_partner_stat(l.tournament_id, l.sponsor_id, 'scan', src, 1);
  END IF;
  RETURN l.target_url;
END $$;

-- TV a web: zobrazení spotu (1), minuty běhu TV (max 5 na volání), návštěva (1)
CREATE OR REPLACE FUNCTION public.track_reach(p_tournament UUID, p_kind TEXT, p_sponsor UUID DEFAULT NULL, p_amount INT DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_kind NOT IN ('tv_spot', 'tv_minutes', 'visit') THEN RETURN; END IF;
  IF NOT public.can_read_tournament(p_tournament) OR NOT public.partner_reach_on(p_tournament) THEN RETURN; END IF;
  IF p_kind = 'tv_spot' AND (p_sponsor IS NULL OR NOT EXISTS (SELECT 1 FROM sponsors s WHERE s.id = p_sponsor AND s.tournament_id = p_tournament)) THEN RETURN; END IF;
  PERFORM public.bump_partner_stat(p_tournament, CASE WHEN p_kind = 'tv_spot' THEN p_sponsor END, p_kind, '',
    CASE WHEN p_kind = 'tv_minutes' THEN least(greatest(coalesce(p_amount, 0), 0), 5) ELSE 1 END);
END $$;

CREATE OR REPLACE FUNCTION public.partner_report(p_tournament UUID)
RETURNS TABLE (sponsor_id UUID, kind TEXT, source TEXT, hour TIMESTAMPTZ, amount INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.sponsor_id, s.kind, s.source, s.hour, s.amount
    FROM partner_stats s
   WHERE s.tournament_id = p_tournament AND public.can_edit_tournament(p_tournament)
   ORDER BY s.hour;
$$;

REVOKE ALL ON FUNCTION public.partner_reach_on(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_partner_stat(UUID, UUID, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_partner_link(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_reach(UUID, TEXT, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_report(UUID) FROM PUBLIC;
-- Supabase dává novým funkcím oprávnění pro anon/authenticated i mimo PUBLIC → odebrat výslovně.
-- Vnitřní pomocné funkce nesmí jít volat z API (jinak by šlo libovolně navyšovat statistiky).
REVOKE EXECUTE ON FUNCTION public.partner_reach_on(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_partner_stat(UUID, UUID, TEXT, TEXT, INT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_report(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_partner_link(TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_reach(UUID, TEXT, UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_report(UUID) TO authenticated;

-- Realtime (QR na TV se objeví bez obnovení stránky)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'partner_links') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_links;
  END IF;
END $$;

-- Ověření:
-- SELECT public.resolve_partner_link('neexistuje', 'tv', false);   → NULL
-- SELECT policyname FROM pg_policies WHERE tablename = 'partner_stats';   → žádné řádky
-- SELECT has_function_privilege('anon', 'public.bump_partner_stat(uuid,uuid,text,text,int)', 'execute');   → false
