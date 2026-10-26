-- =============================================================
-- ZF Cup — 08_partners_branding_media.sql
-- Úrovně partnerů, branding turnaje (white-label barvy), mediální sekce.
-- Čistě aditivní, bezpečné opakované spuštění.
-- Spustit ručně v Supabase SQL Editoru PO 01–07_*.sql.
-- Frontend funguje i bez této migrace (výchozí hodnoty), ale nové
-- volby v adminu se bez ní neuloží.
-- =============================================================

-- -------------------------------------------------------
-- SPONSORS — úroveň partnera
--   title    = generální partner („presented by“; zobrazí se první z nich)
--   main     = hlavní partner (velká loga)
--   partner  = partner
--   supplier = dodavatel
--   media    = mediální partner
-- -------------------------------------------------------
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS tier TEXT;
UPDATE sponsors SET tier = 'partner' WHERE tier IS NULL;
ALTER TABLE sponsors ALTER COLUMN tier SET DEFAULT 'partner';
ALTER TABLE sponsors ALTER COLUMN tier SET NOT NULL;
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_tier_check;
ALTER TABLE sponsors ADD CONSTRAINT sponsors_tier_check
  CHECK (tier IN ('title', 'main', 'partner', 'supplier', 'media'));

-- -------------------------------------------------------
-- TOURNAMENT — branding (hex barvy, NULL = výchozí vzhled platformy)
-- -------------------------------------------------------
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS brand_primary   TEXT;
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS brand_secondary TEXT;
ALTER TABLE tournament DROP CONSTRAINT IF EXISTS tournament_brand_primary_check;
ALTER TABLE tournament ADD CONSTRAINT tournament_brand_primary_check
  CHECK (brand_primary IS NULL OR brand_primary ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE tournament DROP CONSTRAINT IF EXISTS tournament_brand_secondary_check;
ALTER TABLE tournament ADD CONSTRAINT tournament_brand_secondary_check
  CHECK (brand_secondary IS NULL OR brand_secondary ~ '^#[0-9a-fA-F]{6}$');

-- -------------------------------------------------------
-- TOURNAMENT — mediální sekce (veřejná záložka „Média“)
-- -------------------------------------------------------
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS press_enabled       BOOLEAN DEFAULT false;
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS press_contact_name  TEXT DEFAULT '';
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS press_contact_email TEXT DEFAULT '';
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS press_contact_phone TEXT DEFAULT '';
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS press_note          TEXT DEFAULT '';
