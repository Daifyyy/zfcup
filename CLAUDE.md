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
--           bracket_rounds, bracket_slots, announcements, bracket_goals
```

## DB Schema — důležité tabulky
- `matches`: group_id (nullable FK), round (TEXT NOT NULL), home_id, away_id, home_score, away_score (INTEGER), played (BOOL), scheduled_time (TEXT NOT NULL)
- `goals`: player_id, match_id, count — UNIQUE(player_id, match_id), FK na matches
- `players`: id, team_id, name, number (nullable), role (TEXT nullable: `'captain' | 'goalkeeper' | 'both'`)
- `bracket_goals`: id, slot_id (FK → bracket_slots), player_id (FK → players), count, UNIQUE(slot_id, player_id)
  - Samostatná tabulka od `goals` — `goals` má FK na `matches`, playoff sloty nejsou v `matches`
- `tipsters`: id, name (TEXT UNIQUE), pin (CHAR(4)), total_points (INTEGER DEFAULT 0)
- `tips`: id, tipster_id (FK → tipsters), match_id (FK → matches), predicted_home, predicted_away (INTEGER), points_earned (INTEGER DEFAULT 0), evaluated (BOOL DEFAULT false) — UNIQUE(tipster_id, match_id)
- `bracket_tips`: id, tipster_id (FK → tipsters), slot_id (FK → bracket_slots), predicted_home, predicted_away (INTEGER), points_earned (INTEGER DEFAULT 0), evaluated (BOOL DEFAULT false) — UNIQUE(tipster_id, slot_id)
- `special_tips`: id, tipster_id (FK → tipsters), tip_type (TEXT), predicted_team_id (UUID FK → teams), points_earned (INTEGER DEFAULT 0), evaluated (BOOL DEFAULT false) — UNIQUE(tipster_id, tip_type)
- `tournament`: obsahuje `tips_enabled BOOLEAN` — řídí viditelnost záložky Tipy

## Pravidla kódování
- Komponenty do `src/components/`, stránky (záložky) jsou inline v App.tsx
- Každá entita má vlastní hook v `src/hooks/` (useMatches, useGroups, usePlayers, atd.)
- Realtime subscriptions v hookách + 10s polling jako fallback, cleanup v useEffect return
- `refetch()` z hooků exponovat přes `useRef` pattern — umožňuje okamžitý refresh po save (viz useMatches, useGoals, useBracketGoals)
- Nikdy service_role key ve frontendu
- Chyby vždy ošetři — ukaž uživateli toast, ne console.error
- Všechny `<button>` musí mít `type="button"` — bez toho může dojít k nechtěnému submit
- **Nikdy nepoužívat `disabled` atribut na tlačítkách v admin formulářích** — Android ignoruje touch eventy na disabled elementech; místo toho proveď kontrolu uvnitř onClick a zobraz toast

## Důležité chování / known issues opravené
- **`scheduled_time` a `round`**: sloupce jsou TEXT NOT NULL — při UPDATE posílat `''` (prázdný string), **ne `null`**, jinak 400 Bad Request
- **Mazání skupiny**: nejdříve smazat zápasy (`DELETE FROM matches WHERE group_id = X`), pak teprve skupinu — DB cascade nastaví group_id na NULL a následný delete by nenašel nic
- **Řazení skupin v zobrazení**: používat `localeCompare` pro řazení round entries abecedně, ne insertion order (jinak se skupiny při edit přehazují kvůli změně scheduled_time formátu)
- **`played` flag**: auto-nastavit na `true` při ukládání pokud home_score > 0 nebo away_score > 0
- **Trigger `after_match_result` na matches**: volá `evaluate_tips()` při UPDATE. Viz sekci Tipovačka pro správnou verzi funkce. Časté chyby: chybějící WHERE clause na UPDATE tipsters, nebo podmínka `AND evaluated = false` která blokuje re-evaluaci při změně výsledku.
- **Android touch na disabled tlačítkách**: tlačítka s `disabled` atributem na Androidu nespustí onClick handler. Řešení: odstranit `disabled`, kontrolu provést uvnitř handleru + toast.
- **Android zoom inputů**: `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }` — prohlížeč nezoomuje když font-size ≥ 16px
- **Tipy — NEvymazávat `dirty` po save**: `setDirty(new Set())` po `saveAll()` způsobuje, že při příchodu realtime odpovědi z DB `useEffect` přepíše inputy před aktualizací `myTips` → zápas vizuálně zmizí. `dirty` se čistí pouze na unmount (přepnutí záložky), nikdy manuálně po save.
- **Tipy — loading stav**: `useTips` a `useBracketTips` vrací `loading: boolean` — při remountu komponenty (přepnutí záložky a návrat) zobrazit spinner místo prázdných inputů, aby uživatel věděl že data se načítají.

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
- `teams` — Týmy + soupisky; hráči seřazeni abecedně; zobrazení: Jméno | RoleBadge (C/B/CB) | ⚽N (jen pokud > 0)
- `results` — Zápasy skupinových zápasů (řazené abecedně dle skupiny), zvýraznění vítěze; mobilní layout: týmy vlevo + skóre vpravo (CSS grid/flex s !important override na ≤500px)
  - **Poznámka**: záložka se jmenuje `results` (key), ale label v BottomNav i Header je **"Zápasy"** (sjednoceno s dlaždičkou na Přehledu)
- `standings` — Tabulky skupin; **používá tiebreaker B (h2h_first)**: body → vzájemný zápas → gólový rozdíl → vstřelené góly
- `scorers` — Střelci (agregováno z goals + bracket_goals)
- `bracket` — Play-off jako flat list zápasů oddělených koly (ne pavouk), finále zlatě
- `info` — Info o turnaji + oznámení
- `tips` — Tipovačka; viditelná jen pokud `tournament.tips_enabled === true`

### Admin záložky (AdminPanel slide-in)
Pořadí záložek: **Info → Informace → Týmy → Skupiny → Střelci → Zápasy → Play-off → Tipovačka → Nastavení**

Záložky aktivně používané při turnaji (**Zápasy, Play-off, Tipovačka**) jsou vizuálně zvýrazněny: světle zelené pozadí + tmavě zelený text + zelená spodní čára (`ACTION_TABS` konstanta v AdminPanel.tsx).

- `info` — Metadata turnaje
- `announcements` — CRUD oznámení
- `teams` — Týmy + soupisky; hráči mají pole role (Kapitán/Brankář/Kapitán+Brankář/žádná); dres# odebrán z UI
- `groups` — Skupiny + generování zápasů (circle-method)
- `scorers` — Read-only přehled střelců
- `matches` — **Sjednocený inline editor**: tlačítko "✎ Upravit" rozbalí panel přímo pod zápasem se skóre (±stepery) + soupiskou obou týmů (±góly per hráč) + "💾 Uložit vše" (ukládá skóre i góly najednou). Horní formulář slouží pouze pro přidání nového zápasu.
- `bracket` — 2-krokový flow: Step 1 = vygenerovat strukturu (vždy dostupné), Step 2 = nasadit týmy (jen pokud jsou všechny skupinové zápasy odehrané); SlotEditor má ±stepery skóre + BracketGoalEditor per hráč; záložka přejmenována z "Pavouk" na "Play-off"
- `tips` — Tipovačka admin: pořadí sekcí: 1) Vyhodnocení speciálních tipů (skupiny auto, turnajový vítěz ručně), 2) Přepočet bodů, 3) Nebezpečná zóna, 4) Tipéři
- `settings` — Nastavení (včetně toggle `tips_enabled`)

## Bracket (Play-off) — architektura
- **Krok 1** (`generateStructure`): vytvoří `bracket_rounds` + prázdné `bracket_slots` podle počtu týmů
- **Krok 2** (`seedTeams`): doplní týmy z tabulky skupin do prvního kola; podmínka: všechny skupinové zápasy musí být odehrané; **tlačítko bez `disabled`** — check uvnitř onClick
- **SlotEditor**: ±stepery pro home/away score + toggle "⚽ Góly" → zobrazí `BracketGoalEditor`
- **BracketGoalEditor**: upsert/delete do `bracket_goals` (slot_id, player_id, count); po save volá `refetchBracketGoals()`
- **bracket_goals SQL** (spustit jednou v Supabase):
```sql
CREATE TABLE bracket_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES bracket_slots(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(slot_id, player_id)
);
ALTER TABLE bracket_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON bracket_goals FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## Tipovačka — architektura

### Přehled
Skrytý modul pro tipování výsledků. Viditelnost řídí `tournament.tips_enabled`. Tipéři se autentizují jménem + 4místným PINem (ne Supabase Auth — jsou anonymní uživatelé). Session se ukládá do `localStorage` klíč `zfcup_tipster_id`.

### Bodové schéma
| Kategorie | Přesný výsledek | Správný vítěz/remíza |
|-----------|----------------|----------------------|
| Skupiny   | 3 b.           | 1 b.                 |
| Playoff   | 5 b.           | 2 b.                 |
| Finále    | 8 b.           | 3 b.                 |

Speciální tipy:
- Vítěz turnaje: **10 b.**
- Vítěz skupiny X: **5 b.**
- Poslední skupiny X: **3 b.**

### DB tabulky (SQL pro vytvoření)
```sql
-- Tipéři
CREATE TABLE tipsters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin CHAR(4) NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT tipsters_name_unique UNIQUE (name)
);

-- Skupinové tipy
CREATE TABLE tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id UUID REFERENCES tipsters(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home INTEGER NOT NULL,
  predicted_away INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  evaluated BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(tipster_id, match_id)
);

-- Playoff tipy (bracket_slots nejsou v matches → samostatná tabulka)
CREATE TABLE bracket_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id UUID REFERENCES tipsters(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES bracket_slots(id) ON DELETE CASCADE,
  predicted_home INTEGER NOT NULL,
  predicted_away INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  evaluated BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(tipster_id, slot_id)
);

-- Speciální tipy
CREATE TABLE special_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id UUID REFERENCES tipsters(id) ON DELETE CASCADE,
  tip_type TEXT NOT NULL,        -- 'tournament_winner' | 'group_winner:{id}' | 'group_last:{id}'
  predicted_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  points_earned INTEGER NOT NULL DEFAULT 0,
  evaluated BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(tipster_id, tip_type)
);
```

### RLS pro tipovačku (anon uživatelé musí moci zapisovat)
```sql
-- tipsters
ALTER TABLE tipsters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON tipsters FOR SELECT USING (true);
CREATE POLICY "anon_insert_tipsters" ON tipsters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_write" ON tipsters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tips
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON tips FOR SELECT USING (true);
CREATE POLICY "anon_insert_tips" ON tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tips" ON tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON tips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bracket_tips
ALTER TABLE bracket_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON bracket_tips FOR SELECT USING (true);
CREATE POLICY "anon_insert_bracket_tips" ON bracket_tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_bracket_tips" ON bracket_tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON bracket_tips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- special_tips
ALTER TABLE special_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON special_tips FOR SELECT USING (true);
CREATE POLICY "anon_insert_special_tips" ON special_tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_special_tips" ON special_tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON special_tips FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Vyhodnocení tipů — kdo co spouští
| Typ | Kdy | Kdo spouští |
|-----|-----|-------------|
| Skupiny (`tips`) | Automaticky | DB trigger `after_match_result` → `evaluate_tips()` při UPDATE matches |
| Playoff (`bracket_tips`) | Automaticky | DB trigger `after_bracket_slot_result` při UPDATE bracket_slots |
| Speciální skupinové (`group_winner`, `group_last`) | **Automaticky při načtení TipsAdminTab** | `useEffect` v TipsAdminTab — detekuje dokončené skupiny přes `calcGroupStandings`, vyhodnotí bez kliknutí |
| Speciální — vítěz turnaje (`tournament_winner`) | Ručně | Admin v záložce Tipovačka → výběr týmu + tlačítko Vyhodnotit |

**Trigger `evaluate_tips()` — kritické požadavky:**
- Musí mít `WHERE id IN (SELECT tipster_id FROM tips WHERE match_id = NEW.id)` na UPDATE tipsters — bez toho Supabase hodí "UPDATE requires a WHERE clause" a rollbackne i původní UPDATE matches.
- **Nesmí obsahovat** `AND evaluated = false` ani `AND OLD.played = false` — jinak se body nepřepočítají při změně výsledku již odehraného zápasu.
- Podmínka spuštění: `IF NEW.played = true` (ne `OLD.played = false`) — trigger musí přepočítat pokaždé.
- Správná verze funkce (spustit v Supabase SQL Editoru pokud je třeba opravit):
```sql
CREATE OR REPLACE FUNCTION evaluate_tips()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.played = true THEN
    UPDATE tips SET
      points_earned = CASE
        WHEN predicted_home = NEW.home_score AND predicted_away = NEW.away_score THEN 3
        WHEN SIGN(predicted_home - predicted_away) = SIGN(NEW.home_score - NEW.away_score) THEN 1
        ELSE 0
      END,
      evaluated = true
    WHERE match_id = NEW.id;
    UPDATE tipsters SET
      total_points = (
        SELECT COALESCE(SUM(t.points_earned), 0) FROM tips t WHERE t.tipster_id = tipsters.id
      ) + (
        SELECT COALESCE(SUM(bt.points_earned), 0) FROM bracket_tips bt WHERE bt.tipster_id = tipsters.id
      ) + (
        SELECT COALESCE(SUM(st.points_earned), 0) FROM special_tips st WHERE st.tipster_id = tipsters.id
      )
    WHERE id IN (SELECT tipster_id FROM tips WHERE match_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Ruční recalc `total_points` (v TipsAdminTab):**
- `recalcTipsterPoints()` — sečte existující `points_earned` ze všech tabulek, updateuje `tipsters.total_points`
- `recalcAllTips()` — přepočítá `tips.points_earned` i `bracket_tips.points_earned` ze skutečných výsledků zápasů/slotů, pak zavolá `recalcTipsterPoints()`. Použít po opravě chybného výsledku pokud trigger selhal.

### Komponenty tipovačky
- `src/components/public/Tips.tsx` — hlavní komponenta (veřejná záložka)
  - `TipsLogin` — registrace/přihlášení: **dvě pole Jméno + Příjmení** (uloženo jako `"jan novák"` lowercase), 4místný PIN, UNIQUE constraint na celé jméno
  - `Leaderboard` — žebříček tipérů, zvýraznění aktuálního uživatele
  - `SpecialTipsSection` — vítěz turnaje + vítěz/poslední každé skupiny
    - **Zamčeno** (read-only 🔒) jakmile je odehrán první zápas (`anyMatchPlayed` prop)
    - Po vyhodnocení adminem: zobrazuje výsledek + body
    - State pattern: `selected` (dropdowny) + `savedSelections` (potvrzené v DB) — `savedSelections` se aktualizuje okamžitě po save bez čekání na realtime; `changed = selected !== savedSelections`
    - **Nesmí být definována jako nested komponenta** — způsobuje unmount/remount na každý re-render a reset state
  - `GroupTipsSection` — skupinové zápasy seřazené dle kola, score inputy, hromadný save
    - Dirty tracking: user-edited inputy se nepřepisují realtime updatem; **dirty se nečistí po save** (viz known issues)
    - `loading` prop z `useTips` — zobrazí "Načítám tipy…" spinner místo prázdných inputů
    - `saveAll` má error handling — chyba z DB se zobrazí jako toast, ne tichá chyba
    - Po odehrání: zobrazuje skóre + "tip: X:Y" + body badge (`+N b. ✓` / `0 b.` / `čeká…`)
  - `BracketTipsSection` — playoff sloty; TBD sloty nelze tipovat; po odehrání read-only s body
    - Stejný dirty tracking + loading + error handling jako GroupTipsSection
- `src/components/admin/tabs/TipsAdminTab.tsx` — admin záložka
  - **Auto-vyhodnocení skupin**: `useEffect` při načtení zkontroluje každou skupinu; pokud jsou všechny zápasy odehrány → `calcGroupStandings` → automaticky uloží `group_winner` a `group_last` do `special_tips` → zobrazí `✓ 🥇 [tým] / ✓ ⬇️ [tým]`; pokud skupina není hotová → "Čeká na dokončení skupiny…"
  - Vítěz turnaje: ruční výběr (EvalRow s dropdownem)
  - **Přepočet bodů**: tlačítko "🔄 Přepočítat tipy ze zápasů" — volá `recalcAllTips()` pro re-evaluaci ze skutečných výsledků
  - Reset všech tipů (tips + bracket_tips + special_tips + vynulování bodů)
  - Přehled tipérů s body + mazání (sekce je **dole** — méně důležitá při turnaji)
  - Přijímá prop `matches: Match[]` (nutné pro auto-detekci skupin)
- `src/hooks/useTipsters.ts` — seznam tipérů seřazených dle bodů
- `src/hooks/useTips.ts` — skupinové tipy konkrétního tipéra
- `src/hooks/useBracketTips.ts` — playoff tipy konkrétního tipéra
- `src/hooks/useSpecialTips.ts` — speciální tipy konkrétního tipéra

### Aktivace tipovačky
Admin panel → Nastavení → toggle "Tipovačka" → nastaví `tournament.tips_enabled = true`.
Záložka "Tipy" se pak zobrazí v BottomNav i Header.

## Týmová loga (Supabase Storage) — IMPLEMENTOVÁNO

### Pravidla pro loga
- **Formát: pouze PNG** (průhledné pozadí)
- **Max velikost: 500 KB**
- **Rozměry: čtvercové, doporučeno 200×200px**
- Storage path: `{teamId}.png` — upsert přepíše staré logo
- Cache-bust: URL se ukládá s `?v={timestamp}`

### Supabase setup (jednou ručně)
```sql
ALTER TABLE teams ADD COLUMN logo_url TEXT;
-- Storage bucket: "team-logos", Public: true (v Supabase Dashboard)
CREATE POLICY "public_read_logos" ON storage.objects FOR SELECT USING (bucket_id = 'team-logos');
CREATE POLICY "admin_upload_logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'team-logos');
CREATE POLICY "admin_delete_logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'team-logos');
```

### Komponenta `TeamLogo`
`src/components/ui/TeamLogo.tsx` — nahrazuje `team-dot` span všude:
- Pokud `logo_url` existuje → `<img>` s `onError` fallback na tečku
- Jinak → barevná tečka (původní chování)

Velikosti dle kontextu:
| Místo | size |
|-------|------|
| Results, Bracket | 32px |
| Tips | 24px |
| Scorers | 28px |
| Standings | 24px |
| Scoreboard (TV) — tabulky, zápasy, playoff | 16px |
| Scoreboard (TV) — bracket (FlatBracketCol) | 18px |
| Teams karta (hlavička) | 38px |

## Vlastní ikony v Přehledu (Overview)
`src/components/public/Overview.tsx` — komponenta `TileIcon`:
- Zkusí načíst `<img src="/icons/{file}">` z veřejné složky `public/icons/`
- `onError` fallback na emoji (původní chování)
- Soubory PNG se umístí do `public/icons/`:

| Soubor | Dlaždice |
|--------|---------|
| `info.png` | Informace |
| `teams.png` | Týmy |
| `matches.png` | Zápasy |
| `standings.png` | Tabulka |
| `scorers.png` | Střelci |
| `playoff.png` | Play-off |

- Chybějící soubor = fallback emoji, funguje per-soubor (lze mít jen část ikon vlastních)

## Mobilní tabulka skupin (Standings, ≤600px)
CSS třída `.standings-table` na `<table>` + `.standings-name` na span s názvem týmu:
- Padding buněk: `.38rem .18rem` (místo `.55rem .7rem`)
- Fonty číslic/hlaviček: `.65rem`
- Název týmu: `-webkit-line-clamp: 2` — wrapuje max na 2 řádky, nepřetéká do strany
- Všech 9 sloupců zůstává viditelných (žádné skrývání)

## Layout zápasů — Results tab a Scoreboard

### CSS match-grid (čas doleva)
CSS v `src/index.css` — třídy `.match-grid`, `.match-col-time`, `.match-col-home`, `.match-col-score`, `.match-col-away`, `.match-col-badge`, `.match-score-side`, `.match-team-name`:
- **Desktop (>500px)**: CSS grid `46px 1fr auto 1fr auto`, areas: `"time home score away badge"` — jeden řádek, nižší výška karet
- **Mobil (≤500px)**: CSS grid `36px 1fr`, areas: `"time home" / "time away" / ". badge"` — čas vlevo přes oba řádky týmů, score vpravo v každém řádku (`.match-score-side`)
- `match-col-meta` **odstraněno** — nahrazeno `match-col-time` (vlevo) + `match-col-badge` (vpravo)
- Přepis vyžaduje `!important` kvůli specificitě; grid-area `time` automaticky span přes 2 řádky na mobilu (stejný název v obou řádcích grid-template-areas)

## TV Scoreboard (Tabule) — architektura
3 sloupce `27% | 51% | 22%`, `overflow: hidden` všude (žádný scroll), fluid fonty přes `clamp()`:
- **Levý (27%)**: skupinové tabulky + top-5 střelců; střelci jsou `flex-shrink: 0` sekce dole → vždy viditelní bez ohledu na výšku tabulek
- **Prostřední (51%)**: dynamický obsah dle fáze turnaje:
  - **Skupinová fáze**: 2 sub-sloupce side-by-side (`repeat(N, 1fr)`) — každá skupina má svůj sloupec s názvem a zápasy; čas vlevo každého řádku (`gridTemplateColumns: 'auto 1fr auto 1fr'`)
  - **Po odehrání skupin** (`allGroupMatchesPlayed`): `PlayoffMatchesSubCol` — flat list playoff slotů per kolo s detekci finále/3.místa
- **Pravý (22%)**: `FlatBracketCol` — flat list playoff kol oddělených nadpisy; detekce finále (`/finále/i` bez "3") → zlatá + 🏆, o 3. místo → bronzová + 🥉
- **Střelci (levý sloupec)**: jméno hráče + pod ním název týmu menším fontem (`S.label`, muted barva)
- Props: `tournament, teams, players, groups, matches, goals, bracketRounds, bracketSlots, onExit`
- `MatchesCol` přijímá: `matches, teams, groups, bracketRounds, bracketSlots`

## Barvy týmů (TEAM_COLORS v src/lib/constants.ts)
20 barev: červená, modrá, zelená, žlutá, oranžová, fialová, růžová, tmavě červená, tmavě zelená, šedá, tyrkysová, jantarová, indigo, malinová, limetková, teplá šedá, tmavě modrá, purpurová, hnědá, smaragdová.

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
