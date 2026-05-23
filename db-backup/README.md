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
