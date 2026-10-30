-- 24b — Oprava migrace 24: vnitřní funkce dosahu partnera nesmí jít volat z API.
-- (Supabase přiděluje novým funkcím EXECUTE pro anon/authenticated; REVOKE FROM PUBLIC nestačí.)
-- Stačí spustit jednou po migraci 24 (24 už obsahuje totéž pro nové instalace). Idempotentní.
REVOKE EXECUTE ON FUNCTION public.partner_reach_on(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_partner_stat(UUID, UUID, TEXT, TEXT, INT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_report(UUID) FROM anon;
-- Ověření: SELECT has_function_privilege('anon', 'public.bump_partner_stat(uuid,uuid,text,text,int)', 'execute');  → false
