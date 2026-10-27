# ZF Cup — Záloha DB architektury

Tato složka obsahuje SQL skripty pro kompletní rekonstrukci Supabase PostgreSQL architektury.
**Pouze struktura** (DDL + RLS + triggery) — bez dat.

## Použití (čistý Supabase projekt)

Spouštět v pořadí v **Supabase SQL Editoru**:

1. `01_tables.sql` — Vytvoří všechny tabulky ve správném pořadí (FK závislosti)
2. `02_rls.sql` — Zapne RLS a vytvoří všechny politiky
3. `03_triggers.sql` — Vytvoří PL/pgSQL funkce a triggery pro tipovačku
4. `04_storage.sql` — Instrukce pro Storage bucket (nutno ručně v Dashboardu)
5. `05_migrations.sql` — Pouze pro **upgrade existující** DB (přidá chybějící sloupce)
6. `06_indexes.sql` — Indexy
7. `07_multisport.sql` — Multi-sport (fotbal/hokej), trestné minuty, OT/SO
8. `08_partners_branding_media.sql` — Úrovně partnerů, barvy turnaje (branding), mediální sekce
9. `09_competitions_seasons.sql` — Soutěže s ročníky (competitions, clubs, persons), sezónní režim, datum zápasu
10. `10_realtime_publication.sql` — Tabulky do publikace `supabase_realtime` (bez toho nechodí živé změny)
11. `11_roles_security.sql` — Správce platformy, organizátoři (owner_id), RLS podle vlastníka, platform_settings
12. `12_tournament_indexes.sql` — Indexy `tournament_id` na všech tabulkách + chybějící indexy cizích klíčů
13. `13_clubs_library.sql` — Knihovna klubů organizátora: `clubs`/`persons` s `owner_id`, `clubs.slug` (stránka `/k/{slug}`), soupiska v knihovně (`persons.club_id/number/role`), RLS podle vlastníka, Storage `clubs/{id}/…`
14. `14_brand_style.sql` — Intenzita brandingu `tournament.brand_style` (`subtle`/`bold`)

## Použití (existující DB — upgrade)

Pokud DB již existuje z dřívější verze, spustit jen `05_migrations.sql`.
Všechny příkazy používají `IF NOT EXISTS` / `IF NOT EXISTS` → bezpečné opakované spuštění.

## Tabulky

| Tabulka | Popis |
|---------|-------|
| `tournament` | Globální parametry turnaje |
| `teams` | Týmy |
| `players` | Hráči (FK → teams) |
| `referees` | Rozhodčí |
| `groups` | Skupiny + nastavení |
| `matches` | Zápasy skupin/ligy |
| `goals` | Góly v skupinových zápasech |
| `bracket_rounds` | Kola playoff |
| `bracket_slots` | Zápasy playoff |
| `bracket_goals` | Góly v playoff zápasech |
| `announcements` | Oznámení / média (text/obrázek/video) |
| `tipsters` | Tipéři (jméno + PIN) |
| `tips` | Tipy na skupinové zápasy |
| `bracket_tips` | Tipy na playoff zápasy |
| `special_tips` | Speciální tipy (vítěz turnaje/skupiny/poslední) |

## Supabase Auth

Admin přihlášení probíhá přes Supabase Auth (email + heslo).
Admin účet se vytváří ručně v Supabase Dashboard → Authentication → Users.

## Poznámky

- `@supabase/supabase-js` přesně verze **2.49.1** (neupgradovat)
- `src/lib/supabase.ts` musí mít `global: { headers: { apikey: supabaseAnonKey } }`
- `.env.local` musí mít `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
