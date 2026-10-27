-- ════════════════════════════════════════════════════════════════════════════
-- 11 — Role a oprávnění: správce platformy + organizátoři (vlastníci turnajů)
-- ════════════════════════════════════════════════════════════════════════════
-- Dřív: každý přihlášený uživatel směl zapisovat do všech turnajů (USING (true)).
-- Nyní:
--   • Správce platformy (tabulka platform_admins) smí vše.
--   • Organizátor smí zapisovat jen do turnajů, kde tournament.owner_id = jeho účet,
--     a do soutěží, kde competitions.owner_id = jeho účet.
--   • Čtení zůstává veřejné (diváci bez přihlášení).
--   • platform_settings — globální přepínače (vypínač tipovačky); mění jen správce.
-- Tipovačka (anonymní zápisy tipů, PINy) se zde záměrně NEŘEŠÍ — je globálně vypnutá,
-- zabezpečení bude řešeno před jejím znovuzapnutím.
--
-- PŘEDPOKLAD: účet denis.honzejk@gmail.com existuje v Authentication → Users
-- (jinak skript skončí chybou a nic se nezmění — celý běží v jedné transakci).
--
-- Idempotentní — lze spustit opakovaně.
-- Ověření po spuštění (viz konec souboru).

-- ── 1. Správce platformy ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
-- Žádné politiky = z API nikdo nečte ani nezapisuje; role se zjišťuje funkcí is_platform_admin().

DO $$
DECLARE
  admin_id UUID;
  old_id   UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE lower(email) = 'denis.honzejk@gmail.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Účet denis.honzejk@gmail.com neexistuje. Nejdřív ho založte: Authentication → Users → Invite user. Pak skript spusťte znovu.';
  END IF;
  INSERT INTO platform_admins (user_id) VALUES (admin_id) ON CONFLICT DO NOTHING;

  -- Převod vlastnictví: turnaje/soutěže bez vlastníka nebo vlastněné starým účtem zf@zf.com
  SELECT id INTO old_id FROM auth.users WHERE lower(email) = 'zf@zf.com';

  ALTER TABLE tournament ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  UPDATE tournament   SET owner_id = admin_id WHERE owner_id IS NULL OR owner_id = old_id;
  UPDATE competitions SET owner_id = admin_id WHERE owner_id IS NULL OR owner_id = old_id;
END $$;

-- Nové záznamy dostanou vlastníka automaticky (frontend ho posílá i sám)
ALTER TABLE tournament   ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE competitions ALTER COLUMN owner_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_tournament_owner   ON tournament(owner_id);
CREATE INDEX IF NOT EXISTS idx_competitions_owner ON competitions(owner_id);

-- ── 2. Pomocné funkce (SECURITY DEFINER → obejdou RLS jen pro tuto kontrolu) ──
CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_edit_tournament(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM tournament WHERE id = tid AND owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_competition(cid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM competitions WHERE id = cid AND owner_id = auth.uid())
  );
$$;

-- Bezpečný převod textu na UUID (pro cesty ve Storage); neplatný text → NULL
CREATE OR REPLACE FUNCTION public.try_uuid(s TEXT) RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN s ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN s::uuid END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_tournament(UUID)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_competition(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin()        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_tournament(UUID)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_competition(UUID) TO anon, authenticated;

-- ── 3. RLS: turnaj ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_write"   ON tournament;
DROP POLICY IF EXISTS "owner_insert"  ON tournament;
DROP POLICY IF EXISTS "owner_update"  ON tournament;
DROP POLICY IF EXISTS "owner_delete"  ON tournament;

-- Založit turnaj smí každý přihlášený organizátor, ale jen sám pro sebe
-- a jen do vlastní soutěže.
CREATE POLICY "owner_insert" ON tournament FOR INSERT TO authenticated
  WITH CHECK (
    (owner_id = auth.uid() OR public.is_platform_admin())
    AND (competition_id IS NULL OR public.can_edit_competition(competition_id))
  );
CREATE POLICY "owner_update" ON tournament FOR UPDATE TO authenticated
  USING (public.can_edit_tournament(id))
  WITH CHECK (
    (owner_id = auth.uid() OR public.is_platform_admin())
    AND (competition_id IS NULL OR public.can_edit_competition(competition_id))
  );
CREATE POLICY "owner_delete" ON tournament FOR DELETE TO authenticated
  USING (public.can_edit_tournament(id));

-- ── 4. RLS: všechny tabulky s tournament_id ────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'teams', 'players', 'referees', 'announcements', 'rule_items', 'sponsors',
    'groups', 'matches', 'goals', 'assists', 'cards', 'penalties',
    'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
    'tipsters', 'tips', 'bracket_tips', 'special_tips'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'tournament_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS "admin_write" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "owner_write" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "owner_write" ON public.%I FOR ALL TO authenticated
           USING (public.can_edit_tournament(tournament_id))
           WITH CHECK (public.can_edit_tournament(tournament_id))', t);
    ELSE
      RAISE NOTICE 'Tabulka % nemá tournament_id — přeskočena', t;
    END IF;
  END LOOP;
END $$;

-- ── 5. RLS: soutěže, kluby, osoby ──────────────────────────────────────────
DROP POLICY IF EXISTS "admin_write"  ON competitions;
DROP POLICY IF EXISTS "owner_insert" ON competitions;
DROP POLICY IF EXISTS "owner_update" ON competitions;
DROP POLICY IF EXISTS "owner_delete" ON competitions;
CREATE POLICY "owner_insert" ON competitions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY "owner_update" ON competitions FOR UPDATE TO authenticated
  USING (public.can_edit_competition(id))
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY "owner_delete" ON competitions FOR DELETE TO authenticated
  USING (public.can_edit_competition(id));

DROP POLICY IF EXISTS "admin_write" ON clubs;
DROP POLICY IF EXISTS "owner_write" ON clubs;
CREATE POLICY "owner_write" ON clubs FOR ALL TO authenticated
  USING (public.can_edit_competition(competition_id))
  WITH CHECK (public.can_edit_competition(competition_id));

DROP POLICY IF EXISTS "admin_write" ON persons;
DROP POLICY IF EXISTS "owner_write" ON persons;
CREATE POLICY "owner_write" ON persons FOR ALL TO authenticated
  USING (public.can_edit_competition(competition_id))
  WITH CHECK (public.can_edit_competition(competition_id));

-- ── 6. Globální nastavení platformy ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id                    BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),  -- vždy jediný řádek
  tips_globally_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read"  ON platform_settings;
DROP POLICY IF EXISTS "admin_update" ON platform_settings;
CREATE POLICY "public_read"  ON platform_settings FOR SELECT USING (true);
CREATE POLICY "admin_update" ON platform_settings FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND tablename = 'platform_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
  END IF;
END $$;

-- ── 7. Storage (bucket team-logos) ─────────────────────────────────────────
-- Nové cesty: tournaments/{turnajId}/...  (logo turnaje, týmy, partneři, hráči)
-- Starší cesty (stále podporované pro mazání/přepis):
--   {teamId}.png · sponsors/{sponsorId}.{ext} · players/{playerId}.{ext}
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

DROP POLICY IF EXISTS "team_logos_admin_insert" ON storage.objects;
CREATE POLICY "team_logos_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-logos' AND public.can_edit_storage_path(name));

DROP POLICY IF EXISTS "team_logos_admin_update" ON storage.objects;
CREATE POLICY "team_logos_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'team-logos' AND public.can_edit_storage_path(name))
  WITH CHECK (bucket_id = 'team-logos' AND public.can_edit_storage_path(name));

DROP POLICY IF EXISTS "team_logos_admin_delete" ON storage.objects;
CREATE POLICY "team_logos_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'team-logos' AND public.can_edit_storage_path(name));

-- ── Ověření ────────────────────────────────────────────────────────────────
-- SELECT u.email FROM platform_admins p JOIN auth.users u ON u.id = p.user_id;
-- SELECT name, (SELECT email FROM auth.users WHERE id = owner_id) FROM tournament;
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
-- SELECT * FROM platform_settings;
