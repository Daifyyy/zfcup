-- ════════════════════════════════════════════════════════════════════════════
-- 20 — Fotka pro sdílecí grafiky
-- ════════════════════════════════════════════════════════════════════════════
--   tournament.share_photo_url: veřejná URL fotky z akce (Storage
--   team-logos/tournaments/{id}/share/photo.{jpg|png|webp}) — pozadí grafik ve stylu Foto.
-- Idempotentní. Frontend funguje i bez této migrace (styl Foto jen s vlastní fotkou z okna sdílení).
-- Čtení a zápis pokrývají stávající politiky tabulky tournament (migrace 11 a 15).

ALTER TABLE tournament ADD COLUMN IF NOT EXISTS share_photo_url TEXT;

-- Ověření: SELECT name, share_photo_url FROM tournament;
