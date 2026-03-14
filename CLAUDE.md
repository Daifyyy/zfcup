# CLAUDE.md — Instrukce pro Claude Code

## Role
Jsi senior full-stack developer. Pracuješ na webové aplikaci pro firemní fotbalový turnaj.
Referenční implementace je v `turnaj_final.html` — zachovej veškerou existující funkcionalitu.

## Technický stack
- **Frontend:** React 18 + Vite 6, TypeScript
- **Styling:** Tailwind CSS 3 (světlé téma, modrá/bílá/černá)
- **Backend:** Supabase (PostgreSQL + RLS + Realtime + Auth)
- **Hosting:** Vercel (nebo Netlify, dle výběru)
- **Fonty:** Bebas Neue (nadpisy), DM Sans (text)
- **supabase-js verze: přesně 2.49.1** (neupgradovat, viz níže)

## Supabase konfigurace
- Přihlašovací údaje jsou v `.env.local` (nikdy je necommituj)
- Použij `@supabase/supabase-js@2.49.1` — **nepovyšuj verzi**, verze 2.99+ má bug: neposílá `apikey` header pro mutace → 400 Bad Request
- `createClient` musí mít explicitní `global.headers.apikey` (viz `src/lib/supabase.ts`)
- anon key = veřejné čtení (RLS SELECT pro všechny)
- Admin přihlášení = Supabase Auth (email + heslo) → JWT → RLS povolí mutace
- RLS musí být nastaveno v Supabase SQL Editoru (viz sekce RLS níže)

## RLS politiky (povinné pro fungování admin zápisů)
```sql
-- Spustit v Supabase SQL Editor pro každou tabulku:
ALTER TABLE <tabulka> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON <tabulka> FOR SELECT USING (true);
CREATE POLICY "admin_write" ON <tabulka> FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Tabulky: matches, goals, groups, tournament, teams, players,
--           bracket_rounds, bracket_slots, announcements
```

## Pravidla kódování
- Komponenty do `src/components/`, stránky (záložky) jsou inline v App.tsx
- Každá entita má vlastní hook v `src/hooks/` (useMatches, useGroups, usePlayers, atd.)
- Realtime subscriptions v hookách + 10s polling jako fallback, cleanup v useEffect return
- Nikdy service_role key ve frontendu
- Chyby vždy ošetři — ukaž uživateli toast, ne console.error
- Všechny `<button>` musí mít `type="button"` — bez toho může dojít k nechtěnému submit

## Důležité chování / known issues opravené
- **`scheduled_time` a `round`**: sloupce jsou TEXT NOT NULL — při UPDATE posílat `''` (prázdný string), **ne `null`**, jinak 400 Bad Request
- **Mazání skupiny**: nejdříve smazat zápasy (`DELETE FROM matches WHERE group_id = X`), pak teprve skupinu — DB cascade nastaví group_id na NULL a následný delete by nenašel nic
- **Řazení skupin v zobrazení**: používat `localeCompare` pro řazení round entries abecedně, ne insertion order (jinak se skupiny při edit přehazují kvůli změně scheduled_time formátu)
- **`played` flag**: auto-nastavit na `true` při ukládání pokud home_score > 0 nebo away_score > 0
- **Trigger `after_match_result` na matches**: volá `evaluate_tips()` při UPDATE. Funkce obsahovala `UPDATE tipsters SET ... ` bez WHERE clause — Supabase to blokuje a hodí "UPDATE requires a WHERE clause" (400), čímž rollbackne i původní UPDATE matches. Fix: přidat `WHERE id IN (SELECT tipster_id FROM tips WHERE match_id = NEW.id)`. Opraveno přímo v DB funkci.

## Styl a UX
- Světlé téma: pozadí `#f8fafc`, karty bílé se shadow, akcent `#2563eb` (modrá)
- Nadpisy: Bebas Neue, text: DM Sans
- Mobilní first — funguje na telefonu i na velkém monitoru
- Admin panel: slide-in zprava (560px), vlastní scroll container — scroll do formuláře přes `ref.current?.scrollIntoView()`
- Toast notifikace pro všechny akce
- Vítěz zápasu: zvýraznit accent barvou + tučné, poražený: muted barva
- Skupiny/sekce: oddělit výraznou hlavičkou s border-left akcentem

## Architektura záložek
### Veřejné záložky (BottomNav + Header)
- `overview` — Dashboard: dlaždice (Informace=počet oznámení, Týmy, Zápasy, Tabulka, Střelci=počet střelců, Play-off), QR kód, oznámení
- `teams` — Týmy + soupisky hráčů
- `results` — Výsledky skupinových zápasů (řazené abecedně dle skupiny), zvýraznění vítěze
- `standings` — Tabulky skupin (tiebreaker A/B + H2H)
- `scorers` — Střelci (agregováno z goals tabulky)
- `bracket` — Play-off jako flat list záp asů oddělených koly (ne pavouk), finále zlatě
- `info` — Info o turnaji + oznámení

### Admin záložky (AdminPanel slide-in)
- `info` — Metadata turnaje
- `announcements` — CRUD oznámení
- `teams` — Týmy + soupisky
- `groups` — Skupiny + generování zápasů (circle-method)
- `matches` — Zápasy + inline GoalEditor (±1 góly per hráč)
- `scorers` — Read-only přehled střelců
- `bracket` — Generování/editace playoff
- `settings` — Nastavení

## Vercel deployment — kritické upozornění

### Vite env vars jsou baked at BUILD TIME
`VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` se vkládají do JS bundle **při buildu** (`npm run build`), **ne za runtime**. Nastavení proměnných v Vercel dashboardu NEOVLIVNÍ aktuálně nasazený bundle.

**Postup při změně kódu nebo env vars:**
1. Commitni všechny změny kódu (`supabase.ts`, `package.json`, atd.)
2. Pushni do gitu → Vercel automaticky spustí nový build
3. Pokud ne, klikni "Redeploy" v Vercel dashboardu
4. Ověř, že env vars jsou nastaveny pro správný scope (Production/Preview/Development)

### Kombinace chyb „No API key" + kód 21000
Pokud vidíš zároveň:
- `{"message":"No API key found in request"}` — chybí `apikey` header
- `{code:"21000", message:"UPDATE requires a WHERE clause"}` — PostgREST vrátí tuto chybu, pokud request nemá autentizaci (bez JWT/apikey PostgREST ignoruje WHERE parametry z URL)

**Obě chyby mají JEDEN kořen: chybí apikey.** Oprava apikey (redeploy s `supabase.ts` explicitním headerem + správnými env vars) vyřeší obě najednou.

**Checklist při debug:**
- [ ] `package.json` má `"@supabase/supabase-js": "2.49.1"` (bez `^`)
- [ ] `src/lib/supabase.ts` má `global: { headers: { apikey: supabaseAnonKey } }`
- [ ] Tyto změny jsou commitnuty a pushnuty do gitu
- [ ] Vercel env vars jsou nastaveny (Settings → Environment Variables → Production)
- [ ] Vercel má provedený nový build PO nastavení env vars

## TV Scoreboard (Tabule) — architektura
3 sloupce, `overflow: hidden` všude (žádný scroll), fluid fonty přes `clamp()`:
- **Levý (27%)**: skupinové tabulky + top-5 střelců dole (`marginTop: auto`)
- **Prostřední (46%)**: skupinové zápasy abecedně dle kola, VS i skóre stejná velikost fontu (`S.score`), kompaktní karty
- **Pravý (27%)**: flat list playoff kol oddělených nadpisy; detekce finále (`/finále/i` bez "3") → zlatá + 🏆, o 3. místo (`/3/i` nebo `/třet/i` nebo `/bronze/i`) → bronzová + 🥉
- Props: `tournament, teams, players, groups, matches, goals, bracketRounds, bracketSlots, onExit`

## Nové funkce (zbývá implementovat)
1. Los skupin (draw/random assignment of teams to groups)
