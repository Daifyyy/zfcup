-- =============================================================
-- ZF Cup — 03_triggers.sql
-- PL/pgSQL funkce a triggery pro automatické vyhodnocení tipů.
-- Spustit PO 01_tables.sql + 02_rls.sql.
-- =============================================================

-- -------------------------------------------------------
-- FUNKCE: evaluate_tips()
-- Trigger: AFTER UPDATE ON matches
-- Účel: Vyhodnotí tipy tipérů pro daný zápas + přepočítá
--       celkové body všech dotčených tipérů.
--
-- KRITICKÉ: UPDATE tipsters MUSÍ mít WHERE id IN (...).
-- Bez WHERE Supabase hodí "UPDATE requires a WHERE clause"
-- a rollbackne i původní UPDATE matches.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_tips()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.played = true THEN
    -- Vyhodnoť tipy na tento zápas
    UPDATE tips SET
      points_earned = CASE
        WHEN predicted_home = NEW.home_score AND predicted_away = NEW.away_score THEN 3
        WHEN SIGN(predicted_home - predicted_away) = SIGN(NEW.home_score - NEW.away_score) THEN 1
        ELSE 0
      END,
      evaluated = true
    WHERE match_id = NEW.id;

    -- Přepočítej celkové body tipérů kteří tipovali tento zápas
    UPDATE tipsters SET
      total_points = (
        SELECT COALESCE(SUM(t.points_earned), 0)
        FROM tips t
        WHERE t.tipster_id = tipsters.id
      ) + (
        SELECT COALESCE(SUM(bt.points_earned), 0)
        FROM bracket_tips bt
        WHERE bt.tipster_id = tipsters.id
      ) + (
        SELECT COALESCE(SUM(st.points_earned), 0)
        FROM special_tips st
        WHERE st.tipster_id = tipsters.id
      )
    WHERE id IN (
      SELECT tipster_id FROM tips WHERE match_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Smazat trigger pokud existuje (pro bezpečné opakované spuštění)
DROP TRIGGER IF EXISTS after_match_result ON matches;

CREATE TRIGGER after_match_result
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION evaluate_tips();


-- -------------------------------------------------------
-- FUNKCE: evaluate_bracket_tips()
-- Trigger: AFTER UPDATE ON bracket_slots
-- Účel: Vyhodnotí playoff tipy + přepočítá body.
--       Bodové schéma: přesný výsledek = 5b, správný vítěz = 2b.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_bracket_tips()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.played = true THEN
    -- Vyhodnoť playoff tipy pro tento slot
    UPDATE bracket_tips SET
      points_earned = CASE
        WHEN predicted_home = NEW.home_score AND predicted_away = NEW.away_score THEN 5
        WHEN SIGN(predicted_home - predicted_away) = SIGN(NEW.home_score - NEW.away_score) THEN 2
        ELSE 0
      END,
      evaluated = true
    WHERE slot_id = NEW.id;

    -- Přepočítej celkové body tipérů kteří tipovali tento slot
    UPDATE tipsters SET
      total_points = (
        SELECT COALESCE(SUM(t.points_earned), 0)
        FROM tips t
        WHERE t.tipster_id = tipsters.id
      ) + (
        SELECT COALESCE(SUM(bt.points_earned), 0)
        FROM bracket_tips bt
        WHERE bt.tipster_id = tipsters.id
      ) + (
        SELECT COALESCE(SUM(st.points_earned), 0)
        FROM special_tips st
        WHERE st.tipster_id = tipsters.id
      )
    WHERE id IN (
      SELECT tipster_id FROM bracket_tips WHERE slot_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Smazat trigger pokud existuje
DROP TRIGGER IF EXISTS after_bracket_slot_result ON bracket_slots;

CREATE TRIGGER after_bracket_slot_result
AFTER UPDATE ON bracket_slots
FOR EACH ROW
EXECUTE FUNCTION evaluate_bracket_tips();


-- -------------------------------------------------------
-- BODOVÉ SCHÉMA (pro referenci)
-- -------------------------------------------------------
-- Skupinové zápasy (tips):
--   Přesný výsledek            → 3 body
--   Správný vítěz / remíza     → 1 bod
--   Špatný tip                 → 0 bodů
--
-- Playoff zápasy (bracket_tips):
--   Přesný výsledek            → 5 bodů
--   Správný vítěz              → 2 body
--   Špatný tip                 → 0 bodů
--
-- Speciální tipy (special_tips) — vyhodnocuje aplikace, ne trigger:
--   Vítěz turnaje              → 10 bodů
--   Vítěz skupiny              → 5 bodů
--   Poslední skupiny           → 3 body
-- -------------------------------------------------------
