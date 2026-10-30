-- ════════════════════════════════════════════════════════════════════════════
-- 21 — Systém modulů a Beta (Vlna 5, bod 5.0)
-- ════════════════════════════════════════════════════════════════════════════
--   platform_settings.modules : stav modulu na platformě, např. {"player_card":"beta"}
--                               hodnoty off | internal | beta | sunset | on; chybí = off
--                               (mění jen správce platformy — stávající politika admin_update)
--   tournament.modules        : zapnutí u turnaje, např. {"player_card":true}
--                               (zapisuje vlastník — stávající politiky tabulky tournament)
--   module_feedback           : zpětná vazba pořadatelů k modulům v Betě
--
-- Frontend funguje i bez této migrace (všechny moduly = off), viz src/lib/modules.ts.
-- Idempotentní — lze spustit opakovaně.

-- ── 1. Sloupce ──────────────────────────────────────────────────────────────
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tournament        ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. Zpětná vazba k modulům ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module        TEXT NOT NULL CHECK (char_length(module) BETWEEN 1 AND 60),
  tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message       TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_feedback_tournament_id_idx ON module_feedback (tournament_id);
CREATE INDEX IF NOT EXISTS module_feedback_created_at_idx ON module_feedback (created_at DESC);

ALTER TABLE module_feedback ENABLE ROW LEVEL SECURITY;
-- Záměrně NENÍ v seznamu migrace 15 (public_read): zpětná vazba není veřejná.
-- Čte ji jen správce platformy a autor; píše pořadatel, který smí turnaj upravovat.
DROP POLICY IF EXISTS "feedback_read"   ON module_feedback;
DROP POLICY IF EXISTS "feedback_insert" ON module_feedback;
DROP POLICY IF EXISTS "feedback_delete" ON module_feedback;
CREATE POLICY "feedback_read" ON module_feedback FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR user_id = auth.uid());
CREATE POLICY "feedback_insert" ON module_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_edit_tournament(tournament_id));
CREATE POLICY "feedback_delete" ON module_feedback FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- ── Ověření ─────────────────────────────────────────────────────────────────
-- SELECT modules FROM platform_settings;                 → {}
-- SELECT name, modules FROM tournament LIMIT 5;          → {}
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'module_feedback';
