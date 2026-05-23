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
- `bracket_slots`: id, round_id, position, home_id, away_id, home_score, away_score, played, **scheduled_time (TEXT nullable)** — migrační SQL: `ALTER TABLE bracket_slots ADD COLUMN IF NOT EXISTS scheduled_time TEXT;`
- `bracket_goals`: id, slot_id (FK → bracket_slots), player_id (FK → players), count, UNIQUE(slot_id, player_id)
  - Samostatná tabulka od `goals` — `goals` má FK na `matches`, playoff sloty nejsou v `matches`
- `announcements`: id, icon (TEXT), title (TEXT), body (TEXT), position (INT), **type TEXT DEFAULT 'text'** (`'text'|'image'|'video'`), **media_url TEXT** — migrační SQL: `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text'; ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_url TEXT;`
- `tipsters`: id, name (TEXT UNIQUE), pin (CHAR(4)), total_points (INTEGER DEFAULT 0)
- `tips`: id, tipster_id (FK → tipsters), match_id (FK → matches), predicted_home, predicted_away (INTEGER), points_earned (INTEGER DEFAULT 0), evaluated (BOOL DEFAULT false) — UNIQUE(tipster_id, match_id)
- `bracket_tips`: id, tipster_id (FK → tipsters), slot_id (FK → bracket_slots), predicted_home, predicted_away (INTEGER), points_earned (INTEGER DEFAULT 0), evaluated (BOOL DEFAULT false) — UNIQUE(tipster_id, slot_id)
- `special_tips`: id, tipster_id (FK → tipsters), tip_type (TEXT), predicted_team_id (UUID FK → teams), points_earned (INTEGER DEFAULT 0), evaluated (BOOL DEFAULT false) — UNIQUE(tipster_id, tip_type)
- `tournament`: obsahuje všechny globální parametry turnaje:
  - `tips_enabled BOOLEAN` — řídí viditelnost záložky Tipy
  - `format TEXT DEFAULT 'groups'` (`'groups'` | `'league'`)
  - `match_duration INT DEFAULT 20`, `halves SMALLINT DEFAULT 1`, `playoff_kickoff TEXT DEFAULT ''`, `round_break INT DEFAULT 5`
  - `tips_lock_from TEXT DEFAULT ''` — datum YYYY-MM-DD pro datový zámek tipování
  - `num_teams INT DEFAULT 0`, `num_groups INT DEFAULT 2`, `advancing_per_group INT DEFAULT 2` — nastavení scénáře
  - `num_pitches INT DEFAULT 2` — **počet hřišť**; určuje kolik zápasů probíhá simultánně; platí pro skupiny i ligu
  - `rules_content TEXT DEFAULT ''` — text pravidel soutěže; zobrazuje se v záložce Pravidla
  - `league_has_playoff BOOLEAN DEFAULT true` — liga s playoff (QF+SF+Finále) nebo bez (vítěz = 1. místo tabulky)

### SQL migrace (spustit jednou v Supabase SQL Editor)
```sql
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'groups',
  ADD COLUMN IF NOT EXISTS match_duration INT DEFAULT 20,
  ADD COLUMN IF NOT EXISTS halves SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playoff_kickoff TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS round_break INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tips_lock_from TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS num_teams INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_groups INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS advancing_per_group INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS num_pitches INT DEFAULT 2;

ALTER TABLE bracket_slots ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
ALTER TABLE bracket_rounds
  ADD COLUMN IF NOT EXISTS scheduled_start TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS break_after INT DEFAULT 5;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS rules_content TEXT DEFAULT '';
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS league_has_playoff BOOLEAN DEFAULT true;
```

## Pravidla kódování
- Komponenty do `src/components/`, stránky (záložky) jsou inline v App.tsx
- Každá entita má vlastní hook v `src/hooks/` (useMatches, useGroups, usePlayers, atd.)
- Realtime subscriptions přes **`src/lib/realtimeManager.ts`** — singleton, který sloučí všechny postgres_changes do **jednoho sdíleného kanálu** `app-realtime`; hooky volají `subscribeTable(table, handler)` místo vlastního `supabase.channel()`
- **Page Visibility API** — všechny hooky zastaví polling při `document.hidden = true` a restartují při návratu (+ okamžitý refetch)
- **Polling intervaly** (záchrana pro případ výpadku WebSocketu; realtime je primární):
  - matches, goals, bracket, bracketGoals, tipsters, announcements: **120s**
  - tips, bracketTips, specialTips: **180s**
  - Statická data (teams, players, groups, tournament, referees): **120s**
- `refetch()` z hooků exponovat přes `useRef` pattern — umožňuje okamžitý refresh po save (viz useMatches, useGoals, useBracketGoals, useBracket)
- Nikdy service_role key ve frontendu
- Chyby vždy ošetři — ukaž uživateli toast, ne console.error
- Všechny `<button>` musí mít `type="button"` — bez toho může dojít k nechtěnému submit
- **Nikdy nepoužívat `disabled` atribut na tlačítkách v admin formulářích** — Android ignoruje touch eventy na disabled elementech; místo toho proveď kontrolu uvnitř onClick a zobraz toast; používej `style={{ opacity: 0.5 }}` pro vizuální stav

## Důležité chování / known issues
- **`scheduled_time` a `round`**: sloupce jsou TEXT NOT NULL — při UPDATE posílat `''` (prázdný string), **ne `null`**, jinak 400 Bad Request
- **Mazání skupiny**: nejdříve smazat zápasy (`DELETE FROM matches WHERE group_id = X`), pak teprve skupinu — DB cascade nastaví group_id na NULL a následný delete by nenašel nic
- **Řazení skupin v zobrazení**: používat `localeCompare` pro řazení round entries abecedně, ne insertion order
- **`played` flag**: auto-nastavit na `true` při ukládání pokud home_score > 0 nebo away_score > 0
- **Trigger `after_match_result` na matches**: volá `evaluate_tips()` při UPDATE. Musí mít `WHERE id IN (SELECT tipster_id FROM tips WHERE match_id = NEW.id)` — bez toho Supabase hodí "UPDATE requires a WHERE clause" a rollbackne i původní UPDATE matches. Nesmí obsahovat `AND evaluated = false` ani `AND OLD.played = false`.
- **Android zoom inputů**: `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }` — prohlížeč nezoomuje když font-size ≥ 16px
- **Tipy — NEvymazávat `dirty` po save**: `setDirty(new Set())` po `saveAll()` způsobuje přepsání inputů realtime updatem. `dirty` se čistí pouze na unmount.
- **Tipy — upsert místo insert/update**: `saveAll` používá `supabase.from('tips').upsert({...}, {onConflict: 'tipster_id,match_id'})` — předchází UNIQUE constraint violation.
- **useBracket exportuje `refetch()`**: useRef pattern — volá se po každém `saveSlot` a `seedTeams` pro okamžitý UI update.
- **Admin panel backdrop — drag z panelu ven**: `onClick` na backdrops by zavřel panel i při drag (mousedown uvnitř, mouseup venku). Oprava: `mouseDownOnBackdrop = useRef(false)` → `onMouseDown` nastaví flag jen když klik začal přímo na backdrops; `onClick` kontroluje oba podmínky. Viz `AdminPanel.tsx`.

## Styl a UX
- Světlé téma: pozadí `#f8fafc`, karty bílé se shadow, akcent `#2563eb` (modrá)
- Nadpisy: Bebas Neue, text: DM Sans
- Mobilní first — funguje na telefonu i na velkém monitoru
- Admin panel: slide-in zprava (560px), vlastní scroll container
- Toast notifikace pro všechny akce
- Vítěz zápasu: zvýraznit accent barvou + tučné, poražený: muted barva
- Skupiny/sekce: oddělit výraznou hlavičkou s border-left akcentem

## Architektura záložek
### Veřejné záložky (BottomNav + Header)
- `overview` — Dashboard: název turnaje + QR kód + oznámení/média (text, obrázky, YouTube videa); pořadí dle `position`
- `teams` — Týmy + soupisky; hráči seřazeni abecedně; zobrazení: Jméno | RoleBadge (C/B/CB) | ⚽N (jen pokud > 0)
- `results` — Zápasy skupinových zápasů (řazené abecedně dle skupiny), zvýraznění vítěze; label v navigaci: **"Zápasy"**
- `standings` — Tabulky skupin; barevné kódování dle `tournament.format`:
  - **Liga**: řádky 0–1 zelená (→ SF), 2–5 amber (→ QF), badge "→ SF" / "→ QF"
  - **Groups**: řádek 0 zelená (🥇 vítěz skupiny), řádek 1 světle modrá (možný postup)
- `scorers` — Střelci (agregováno z goals + bracket_goals)
- `bracket` — Play-off jako flat list zápasů oddělených koly (ne pavouk), finále zlatě; stacked layout (home/away řádky); **skryta v navigaci i renderu při `format='league' && !league_has_playoff`**
- `info` — Info o turnaji + oznámení/média (stejný render jako Overview)
- `rules` — Pravidla soutěže; zobrazuje `tournament.rules_content` s `white-space: pre-wrap`; viditelná vždy
- `tips` — Tipovačka; viditelná jen pokud `tournament.tips_enabled === true`

### Admin záložky (AdminPanel slide-in)
Pořadí: **Info → Informace → Týmy → Skupiny → Střelci → Zápasy → Play-off → Tipovačka → Nastavení**

Záložky aktivně používané při turnaji (**Zápasy, Play-off, Tipovačka**) jsou vizuálně zvýrazněny: světle zelené pozadí + tmavě zelený text (`ACTION_TABS` konstanta v AdminPanel.tsx).

- `info` — Metadata turnaje + **pravidla soutěže** (`rules_content` textarea dole ve formuláři)
- `announcements` — CRUD oznámení/médií; typy: 📢 text / 🖼️ obrázek (URL+preview) / ▶️ video (YouTube URL); řazení tlačítky **↑ ↓** (prohazují `position` v DB); realtime hook zajistí refresh
- `teams` — Týmy + soupisky; **inline editace hráče**: ✎ → input jméno + select role + ✓/✕
- `groups` — Skupiny + generování zápasů; **časy zápasů jsou ovlivněny `tournament.num_pitches`** — N zápasů sdílí stejný časový slot; v liga módu generuje skupinu "Liga"
- `scorers` — Read-only přehled střelců
- `matches` — Sjednocený inline editor: "✎ Upravit" → skóre (±stepery) + soupisky + góly + "💾 Uložit vše"
- `bracket` — 2-krokový flow: Step 1 = generovat strukturu, Step 2 = nasadit týmy (po dokončení skupin); SlotEditor se stacked layoutem + inline góly
- `tips` — Tipovačka admin: pořadí sekcí: 1) Vyhodnocení speciálních tipů, 2) Přepočet bodů, 3) Nebezpečná zóna, 4) Tipéři
- `settings` — Nastavení; sekce **vždy viditelné**:
  - **Formát turnaje**: toggle Skupiny / Liga
  - **Počet hřišť** (`num_pitches`, 1–4): ovlivňuje plánování časů pro skupiny i ligu — N zápasů hraje simultánně, každý slot má N zápasů
  - **Scénář** (jen groups): num_teams, num_groups, advancing_per_group
  - **Parametry ligového zápasu** (jen league): toggle **Playoff po lize** (Ano/Ne = `league_has_playoff`), match_duration, round_break, halves, playoff_kickoff
  - **Datum turnaje** (`tips_lock_from`) + toggle Tipovačka

## Parametr `num_pitches` — počet hřišť

Klíčový parametr pro správné plánování harmonogramů. Platí pro **oba formáty** (skupiny i liga).

### Jak `num_pitches` ovlivňuje harmonogram

**Skupiny (`GroupsTab.tsx`):**
```
scheduled_time = start + floor(matchIndex / numPitches) * (match_duration + break)
```
- N zápasů dostane stejný čas → hrají se simultánně na N hřištích
- Příklad (num_pitches=2, dur=20, brk=5): zápas 0+1 → 08:00, zápas 2+3 → 08:25, ...

**Liga (`leagueSchedule.ts` — funkce `generateLeagueSchedule`):**
- Circle-method vrátí seřazené páry per kolo (DP optimalizace zachována)
- Pro každé kolo: `orderedPairs = [...slotA, ...slotB]` → rozdělí na batches o `numPitches` párech
- `numSubSlots = ceil(orderedPairs.length / numPitches)` time slotů per kolo

| `num_pitches` | Sub-sloty/kolo (9 týmů, 4 reálné páry) | Celkem slotů |
|---|---|---|
| 1 | 4 | 36 |
| 2 | 2 | 18 (výchozí) |
| 3 | 2 (3+1) | 18 |
| 4 | 1 | 9 |

**`leagueSlotCount(n, numPitches)`** — správně počítá počet slotů pro preview:
```typescript
const rounds = n % 2 === 0 ? n - 1 : n
const realPairs = n % 2 === 0 ? n / 2 : (n - 1) / 2
return rounds * Math.ceil(realPairs / numPitches)
```

**Export (`exportSchedule`):** dynamicky N sekcí "Hřiště A/B/C/D" — `pitchLabels = 'ABCD'`, index i → `group[i]`.

**Tabule (`LeagueMatchesCol`):** dynamicky N sloupců (HŘIŠTĚ A/B/C/D) + N `MatchCell` per slot.

## Liga formát — architektura

### Přehled
`tournament.format = 'league'` aktivuje liga mód. Jeden velký round-robin turnaj (skupina "Liga").

**Playoff je volitelný** (`tournament.league_has_playoff`):
- `true` (výchozí): Top-6 → QF (2) + SF (2) + O3 + Finále; vítěz turnaje = vítěz finále (auto-eval v BracketTab)
- `false`: Bez playoff; vítěz turnaje = 1. místo tabulky po odehrání všech zápasů (auto-eval v MatchesTab → `checkLeagueTournamentWinner`)
  - Záložka Play-off skryta v admin i veřejné navigaci; záložka Pavouk skryta v BottomNav/Header

### Generování harmonogramu (`src/lib/leagueSchedule.ts`)
- **Circle-method round-robin**: N týmů → doplnit BYE na sudé → (N-1) kol
- **DP optimalizace**: `computeSplits(pairs)` + `dpOptimize(rounds)` minimalizuje back-to-back přechody; `bestAssignments` dává optimální pořadí párů (slotA → slotB) pro každé kolo
- **Rotační loop**: zkusí všechna N rotací pole týmů, vybere nejlepší; zastaví se při cost=0
- **N-pitches slot loop**: `orderedPairs = [...slotA, ...slotB]` → batches po `numPitches` → každý batch = 1 time slot
- Parametry: `generateLeagueSchedule(teamIds, startTime, matchDuration, roundBreak, breakWindowStart?, breakWindowDuration?, numPitches=2)`

### Liga playoff (BracketTab)
- Formát: QF(2) + SF(2) + O3 + Finále = 6 slotů
- Nasazení (`seedTeams`): 3. vs 6. a 4. vs 5. v QF; 2. a 1. jsou předsazeni do SF (auto-advance)
- Auto-advance QF→SF: vítěz QF1 → away_id SF1, vítěz QF2 → away_id SF2

## Bracket (Play-off) — architektura

### Playoff formáty dle konfigurace
`advancingPerGroup` = `tournament.advancing_per_group` (nastavitelné v SettingsTab).
`totalAdvancing = advancingPerGroup × groups.length`.

| Scénář | totalAdvancing | groupFormat | Struktura |
|--------|---------------|-------------|-----------|
| 1 skupina | — | `sf` | top-4 → SF(2)+O3+Final |
| 2 skupiny, top-2 (6–10 t.) | 4 | `sf` | A1vsB2, B1vsA2 → SF |
| 3 skupiny, top-2 (12 t.) | 6 | `six` | rank 6 týmů, top-2 bye do SF, 3.vs6./4.vs5. v QF |
| 4 skupiny, top-2 (8–12 t.) | 8 | `qf` | (A+B), (C+D) páry → QF(4)+SF |
| 2 skupiny, top-4 (12–14 t.) | 8 | `qf` | křížové A1vsB4 atd. → QF(4)+SF |
| Liga | 6 (vždy) | — | top-6, 3.vs6./4.vs5. v QF, 1./2. předsazeni do SF |

- **Krok 1** (`generateStructure`): vytvoří `bracket_rounds` + prázdné `bracket_slots`
- **Krok 2** (`seedTeams`): doplní týmy z tabulky skupin; podmínka: všechny skupinové zápasy odehrané; tlačítko bez `disabled` — check uvnitř onClick
- **SlotEditor**: stacked layout, ±stepery skóre, inline góly, pole Čas, jediné "💾 Uložit vše"
- Auto-advance QF→SF: `isLeague || groupFormat === 'six'` → vítěz do SF na stejné pozici jako `away_id`
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
Skrytý modul. Viditelnost řídí `tournament.tips_enabled`. Tipéři: jméno + 4místný PIN (anonymní, ne Supabase Auth). Session: `localStorage` klíč `zfcup_tipster_id`.

### Bodové schéma
| Kategorie | Přesný výsledek | Správný vítěz/remíza |
|-----------|----------------|----------------------|
| Skupiny   | 3 b.           | 1 b.                 |
| Playoff   | 5 b.           | 2 b.                 |

Speciální tipy: Vítěz turnaje **10 b.**, Vítěz skupiny **5 b.**, Poslední skupiny **3 b.**

### Vyhodnocení tipů — kdo co spouští
| Typ | Kdy | Kdo spouští |
|-----|-----|-------------|
| Skupiny (`tips`) | Automaticky | DB trigger `after_match_result` → `evaluate_tips()` |
| Playoff (`bracket_tips`) | Automaticky | DB trigger `after_bracket_slot_result` |
| Speciální skupinové | **Automaticky při načtení TipsAdminTab** | `useEffect` → `calcGroupStandings` |
| Vítěz turnaje (playoff) | **Automaticky po uložení finále** | `BracketTab.saveSlot` → `checkTournamentWinner` |
| Vítěz turnaje (liga bez playoff) | **Automaticky po posledním zápase** | `MatchesTab.saveAll` → `checkLeagueTournamentWinner` |

**Trigger `evaluate_tips()` — správná verze:**
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

### Klíčové komponenty tipovačky
- `src/components/public/Tips.tsx` — hlavní komponenta
  - `TipsLogin`: Jméno + Příjmení (lowercase), 4místný PIN
  - `SpecialTipsSection`: zamykání per-tip (`anyMatchPlayed` vs `anyPlayoffPlayed`); **nesmí být nested komponenta** — reset state
  - `GroupTipsSection`: dirty tracking (nečistit po save); upsert; časový zámek (setInterval 60s); liga mód seskupuje dle `scheduled_time`
  - `BracketTipsSection`: stejné vzory jako GroupTipsSection
- `src/components/admin/tabs/TipsAdminTab.tsx`: auto-vyhodnocení skupin; EvalRow s DB check na mount; `recalcAllTips(showToast)` — try/catch, error check na každém UPDATE
- `src/lib/tipsEval.ts`: sdílené funkce `evaluateSpecialTip`, `recalcTipsterPoints`, `checkGroupSpecialTips`, `checkTournamentWinner`, `checkLeagueTournamentWinner`

### Tipy — datový zámek
- `isMatchTimePassed(scheduledTime, lockFromDate?)` — pokud `today < lockFromDate`, vrací `false` (tipy se nezamykají dříve než v den turnaje)
- `anyPlayoffPlayed` — zamkne `tournament_winner`; podmíněné dle formátu:
  - Liga bez playoff (`!league_has_playoff`): `groupMatches.some(m => m.played)` — zamkne od 1. odehraného zápasu
  - Ostatní: `bracketSlots.some(s => s.home_id != null || s.away_id != null)` — zamkne při nasazení týmů do playoff

### RLS pro tipovačku
```sql
-- anon uživatelé musí moci INSERT a UPDATE
CREATE POLICY "anon_insert_tipsters" ON tipsters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_tips" ON tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tips" ON tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- stejné pro bracket_tips a special_tips
```

## TV Kiosk — architektura

`src/components/kiosk/KioskMode.tsx` — fullscreen TV mód, auto-rotace 3 pohledů:

| View | Komponenta | Obsah |
|------|-----------|-------|
| `matches` | `KioskMatches` | Detekuje fázi (skupiny/liga/playoff) → renderuje GroupMatchesSubCol / LeagueMatchesCol / PlayoffMatchesSubCol (portováno ze Scoreboard) |
| `table` | `KioskTable` | 60% skupinové tabulky (barevné kódování jako Scoreboard), 40% top-10 střelců (goals + bracketGoals) |
| `bracket` | `KioskBracket` | Flat list playoff kol + stacked home/away sloty |

- `effectiveViews`: bracket view se zobrazí jen když `bracketSlots.some(s => s.home_id != null || s.away_id != null)`
- Paleta `C.*` a font scale `S.*` totožné se Scoreboard.tsx (fluid `clamp()` fonty)
- Rotace: progress bar, click-to-pause, klávesa Escape → exit, `requestFullscreen` při vstupu
- Props: `{ teams, players, groups, matches, goals, bracketRounds, bracketSlots, announcements, bracketGoals, tournament, onExit, onScoreboard }`
- `bracketGoals` je předáváno explicitně v App.tsx (není součástí `shared` objektu)

## TV Scoreboard (Tabule) — architektura
**2 sloupce `30% | 70%`**, `overflow: hidden` všude, fluid fonty přes `clamp()`:
- **Levý (30%)**: skupinové tabulky (flex: 1 per skupina) + top-5 střelců (flexShrink: 0 dole)
  - Liga mód: `leagueRowStyle(i)` — zelená 1–2 (→SF), amber 3–6 (→QF)
- **Pravý (70%)** — dynamický dle fáze:
  - **Skupiny / groups**: `GroupMatchesSubCol` — každá skupina = 1 sloupec; **fluid výška** (každý zápas `flex: 1, minHeight: 0`); distribuce skupin do sloupců: 1–3 skupiny → N sloupců, 4+ → ceil(N/2) sloupců × 2 skupiny na sloupec
  - **Liga**: `LeagueMatchesCol` — **dynamicky `num_pitches` sloupců** (HŘIŠTĚ A/B/C/D); každý slot `flex: 1`; záhlaví i zápasy generovány dynamicky dle `numPitches`
  - **Po odehrání skupin**: `PlayoffMatchesSubCol` — flat list kol; každé kolo `flex: 1, minHeight: 0`; sloty `flex: 1` → vždy fit na obrazovku
- Props: `tournament, teams, players, groups, matches, goals, bracketGoals, bracketRounds, bracketSlots, onExit`
- `tournament.num_pitches` předáno do `LeagueMatchesCol` přes `MatchesCol`

## Týmová loga (Supabase Storage)
- Formát: PNG, max 500 KB, doporučeno 200×200px
- Storage path: `{teamId}.png` (upsert přepíše staré)
- Cache-bust: URL s `?v={timestamp}`
- Bucket: "team-logos", Public: true
- Komponenta `TeamLogo` (`src/components/ui/TeamLogo.tsx`): `logo_url` → `<img alt="">` s onError fallback na barevnou tečku

| Kontext | size |
|---------|------|
| Results | 32px |
| Bracket, Scorers | 28px |
| Tips, Standings | 24px |
| Scoreboard (TV) | 16px |
| Teams karta (hlavička) | 38px |

## Layout zápasů — CSS match-grid
CSS v `src/index.css` — třídy `.match-grid`, `.match-col-time`, `.match-col-home`, `.match-col-score`, `.match-col-away`:
- **Desktop (>500px)**: `46px 1fr auto 1fr auto`, areas `"time home score away badge"` — jeden řádek
- **Mobil (≤500px)**: `36px 1fr`, areas `"time home" / "time away" / ". badge"` — čas vlevo přes oba řádky, score vpravo

## Barvy týmů
`TEAM_COLORS` v `src/lib/constants.ts` — 20 barev (červená, modrá, zelená, žlutá, oranžová, fialová, růžová, tmavě červená, tmavě zelená, šedá, tyrkysová, jantarová, indigo, malinová, limetková, teplá šedá, tmavě modrá, purpurová, hnědá, smaragdová).

## Záloha DB architektury

Složka `db-backup/` obsahuje SQL skripty pro kompletní rekonstrukci Supabase databáze od nuly (bez dat):
- `01_tables.sql` — CREATE TABLE v pořadí FK závislostí
- `02_rls.sql` — RLS ENABLE + všechny politiky (vč. anon pro tipovačku)
- `03_triggers.sql` — `evaluate_tips()` + `evaluate_bracket_tips()` + triggery
- `04_storage.sql` — instrukce + RLS pro Storage bucket "team-logos"
- `05_migrations.sql` — ALTER TABLE IF NOT EXISTS pro upgrade existující DB

Dokumentace aplikace pro uživatele: `docs/navod.html` — HTML návod na tisk/PDF (admin, hráči, tipéři).

## Vercel deployment — kritické upozornění

### Vite env vars jsou baked at BUILD TIME
`VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` se vkládají do JS bundle **při buildu** — nastavení v Vercel dashboardu NEOVLIVNÍ aktuálně nasazený bundle.

**Postup:** commit + push → Vercel automaticky builduje. Nebo "Redeploy" v dashboardu.

### Kombinace chyb „No API key" + kód 21000
Obě chyby mají JEDEN kořen: chybí apikey. Oprava: redeploy s `supabase.ts` explicitním headerem + správnými env vars.

**Checklist:**
- [ ] `package.json` má `"@supabase/supabase-js": "2.49.1"` (bez `^`)
- [ ] `src/lib/supabase.ts` má `global: { headers: { apikey: supabaseAnonKey } }`
- [ ] Commitnuto + pushnuto do gitu
- [ ] Vercel env vars nastaveny (Settings → Environment Variables → Production)
- [ ] Vercel provedl nový build PO nastavení env vars
