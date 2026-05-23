-- =============================================================
-- ZF Cup — 04_storage.sql
-- Supabase Storage: bucket "team-logos" pro týmová loga.
--
-- POZOR: Storage buckety nelze vytvořit přes SQL Editor.
-- Bucket je nutno vytvořit ručně v Supabase Dashboardu.
-- Tento soubor obsahuje RLS politiky pro storage objekty
-- a instrukce pro ruční vytvoření bucketu.
-- =============================================================

-- -------------------------------------------------------
-- KROK 1 — Vytvořit bucket ručně v Supabase Dashboardu:
--
--   Dashboard → Storage → New bucket
--   Name:   team-logos
--   Public: true (zaškrtnout)
--   File size limit: 512000 (500 KB)
--   Allowed MIME types: image/png, image/jpeg, image/webp
-- -------------------------------------------------------

-- -------------------------------------------------------
-- KROK 2 — Storage RLS politiky (spustit v SQL Editoru):
-- -------------------------------------------------------

-- Veřejné čtení (kdokoli může stáhnout logo)
DROP POLICY IF EXISTS "team_logos_public_read" ON storage.objects;
CREATE POLICY "team_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-logos');

-- Admin zápis (upload/přepis logu)
DROP POLICY IF EXISTS "team_logos_admin_insert" ON storage.objects;
CREATE POLICY "team_logos_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_admin_update" ON storage.objects;
CREATE POLICY "team_logos_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_admin_delete" ON storage.objects;
CREATE POLICY "team_logos_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'team-logos');

-- -------------------------------------------------------
-- KONVENCE pro nahrávání log:
--   Path:    {teamId}.png
--   Upsert:  přepíše existující logo
--   Cache-bust v URL: ?v={timestamp}
--
-- Doporučený formát: PNG, max 500 KB, 200×200px
-- -------------------------------------------------------
