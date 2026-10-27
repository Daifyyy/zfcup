-- ════════════════════════════════════════════════════════════════════════════
-- 14 — Intenzita brandingu turnaje
-- ════════════════════════════════════════════════════════════════════════════
--   tournament.brand_style: 'subtle' (Jemná — tmavé lišty, značka v akcentech)
--                           'bold'   (Výrazná — hlavička, hero a TV v tmavém odstínu značky)
-- Idempotentní. Frontend funguje i bez této migrace (uloží jen barvy, styl = Jemná).

ALTER TABLE tournament ADD COLUMN IF NOT EXISTS brand_style TEXT NOT NULL DEFAULT 'subtle';
ALTER TABLE tournament DROP CONSTRAINT IF EXISTS tournament_brand_style_check;
ALTER TABLE tournament ADD CONSTRAINT tournament_brand_style_check CHECK (brand_style IN ('subtle', 'bold'));

-- Ověření: SELECT name, brand_primary, brand_style FROM tournament;
