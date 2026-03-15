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
- `players`: id, team_id, name, number (nullable), role (TEXT nullable: 'captain' | 'goalkeeper')
- `bracket_goals`: id, slot_id (FK → bracket_slots), player_id (FK → players), count, UNIQUE(slot_id, player_id)
  - Samostatná tabulka od `goals` — `goals` má FK na `matches`, playoff sloty nejsou v `matches`
  - SQL pro vytvoření viz sekce Bracket níže

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
- **Trigger `after_match_result` na matches**: volá `evaluate_tips()` při UPDATE. Funkce obsahovala `UPDATE tipsters SET ... ` bez WHERE clause — Supabase to blokuje a hodí "UPDATE requires a WHERE clause" (400), čímž rollbackne i původní UPDATE matches. Fix: přidat `WHERE id IN (SELECT tipster_id FROM tips WHERE match_id = NEW.id)`. Opraveno přímo v DB funkci.
- **Android touch na disabled tlačítkách**: tlačítka s `disabled` atributem na Androidu nespustí onClick handler. Řešení: odstranit `disabled`, kontrolu provést uvnitř handleru + toast.
- **Android zoom inputů**: `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }` — prohlížeč nezoomuje když font-size ≥ 16px

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
- `teams` — Týmy + soupisky; hráči seřazeni abecedně; zobrazení: Jméno | RoleBadge (C/B) | ⚽N (jen pokud > 0)
- `results` — Výsledky skupinových zápasů (řazené abecedně dle skupiny), zvýraznění vítěze; mobilní layout: týmy vlevo + skóre vpravo (CSS grid/flex s !important override na ≤500px)
- `standings` — Tabulky skupin (tiebreaker A/B + H2H)
- `scorers` — Střelci (agregováno z goals tabulky)
- `bracket` — Play-off jako flat list zápasů oddělených koly (ne pavouk), finále zlatě
- `info` — Info o turnaji + oznámení

### Admin záložky (AdminPanel slide-in)
- `info` — Metadata turnaje
- `announcements` — CRUD oznámení
- `teams` — Týmy + soupisky; hráči mají pole role (Kapitán/Brankář/žádná); dres# odebrán z UI
- `groups` — Skupiny + generování zápasů (circle-method)
- `matches` — Zápasy + inline GoalEditor (±1 góly per hráč); po save okamžitý refetch přes `refetchMatches()`/`refetchGoals()`
- `scorers` — Read-only přehled střelců
- `bracket` — 2-krokový flow: Step 1 = vygenerovat strukturu (vždy dostupné), Step 2 = nasadit týmy (jen pokud jsou všechny skupinové zápasy odehrané); SlotEditor má ±stepery skóre + BracketGoalEditor per hráč
- `settings` — Nastavení

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

## Mobilní tabulka skupin (Standings, ≤600px)
CSS třída `.standings-table` na `<table>` + `.standings-name` na span s názvem týmu:
- Padding buněk: `.38rem .18rem` (místo `.55rem .7rem`)
- Fonty číslic/hlaviček: `.65rem`
- Název týmu: `-webkit-line-clamp: 2` — wrapuje max na 2 řádky, nepřetéká do strany
- Všech 9 sloupců zůstává viditelných (žádné skrývání)

## Mobilní layout zápasů (Results tab, ≤500px)
CSS v `src/index.css` — třídy `.match-grid`, `.match-col-home`, `.match-col-score`, `.match-col-away`, `.match-col-meta`, `.match-score-side`, `.match-team-name`:
- Desktop (>500px): CSS grid `1fr auto 1fr`, home team s `flex-direction: row-reverse`
- Mobil (≤500px): flex column, home/away jsou řádky s `justify-content: flex-start`, `.match-col-score` skryt, `.match-score-side` viditelný (score vpravo v každém řádku)
- Přepis vyžaduje `!important` a `grid-area: unset !important` kvůli specificitě grid-area vlastností

## TV Scoreboard (Tabule) — architektura
3 sloupce, `overflow: hidden` všude (žádný scroll), fluid fonty přes `clamp()`:
- **Levý (27%)**: skupinové tabulky + top-5 střelců dole (`marginTop: auto`)
- **Prostřední (46%)**: skupinové zápasy abecedně dle kola, VS i skóre stejná velikost fontu (`S.score`), kompaktní karty; `scheduled_time` zobrazen u všech zápasů (odehrané: muted, neodrané: accent bold)
- **Pravý (27%)**: flat list playoff kol oddělených nadpisy; detekce finále (`/finále/i` bez "3") → zlatá + 🏆, o 3. místo (`/3/i` nebo `/třet/i` nebo `/bronze/i`) → bronzová + 🥉
- **Střelci (levý sloupec)**: jméno hráče + pod ním název týmu menším fontem (`S.label`, muted barva)
- Props: `tournament, teams, players, groups, matches, goals, bracketRounds, bracketSlots, onExit`

## Plán: Týmová loga (Supabase Storage) — V IMPLEMENTACI

### Pravidla pro loga (stanovená)
- **Formát: pouze PNG** (průhledné pozadí)
- **Max velikost: 500 KB**
- **Rozměry: čtvercové, doporučeno 200×200px** (min 100×100px)
- Storage path: `{teamId}.png` — upsert přepíše staré logo, žádné duplikáty
- Validace pouze na frontendu (admin je jediný kdo nahrává)

### Krok 0 — Supabase: jednou ručně ✓ (provést před implementací)
```sql
-- 1. DB
ALTER TABLE teams ADD COLUMN logo_url TEXT;

-- 2. Storage bucket (v Supabase Dashboard → Storage → New bucket)
--    Název: "team-logos", Public: true

-- 3. Storage RLS (v SQL Editoru)
CREATE POLICY "public_read_logos"
  ON storage.objects FOR SELECT USING (bucket_id = 'team-logos');
CREATE POLICY "admin_upload_logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-logos');
CREATE POLICY "admin_delete_logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'team-logos');
```

### Krok 1 — Hook: rozšířit `useTeams`
```typescript
// src/hooks/useTeams.ts
export interface Team {
  id: string
  name: string
  color: string
  logo_url: string | null   // ← přidat
}
// select('*') již vrátí logo_url automaticky
```

### Krok 2 — Admin: upload v `TeamsTab`
Do sekce editace týmu přidat (v RosterSection nebo samostatná sekce pod barvou):
```typescript
// Validace + upload handler
const uploadLogo = async (teamId: string, file: File) => {
  if (!file.type.includes('png')) { showToast('Pouze PNG soubory'); return }
  if (file.size > 512_000) { showToast('Max velikost je 500 KB'); return }
  const path = `${teamId}.png`
  const { error: upErr } = await supabase.storage
    .from('team-logos')
    .upload(path, file, { upsert: true })
  if (upErr) { showToast('Chyba uploadu: ' + upErr.message); return }
  const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
  // Cache-bust: přidat timestamp aby prohlížeč nenačítal staré logo
  const urlWithTs = `${data.publicUrl}?v=${Date.now()}`
  const { error } = await supabase.from('teams').update({ logo_url: urlWithTs }).eq('id', teamId)
  if (error) showToast('Chyba: ' + error.message)
  else showToast('Logo nahráno ✓')
}

const removeLogo = async (teamId: string) => {
  // path: vždy {teamId}.png — nezávislé na URL formátu
  await supabase.storage.from('team-logos').remove([`${teamId}.png`])
  await supabase.from('teams').update({ logo_url: null }).eq('id', teamId)
  showToast('Logo odstraněno')
}
```

UI v TeamsTab (v hlavičce každého týmu, pod tečkou barvy):
- Hint text vždy viditelný: `"PNG, čtverec, max 500 KB, doporučeno 200×200px"`
- Pokud `team.logo_url`: náhled 40×40px + tlačítko "Smazat logo"
- Pokud ne: `<input type="file" accept=".png,image/png">` + tlačítko "Nahrát logo"

### Krok 3 — Shared helper `TeamLogo`
Nová mini-komponenta `src/components/ui/TeamLogo.tsx`:
```typescript
// Používá se všude místo <span className="team-dot" ...>
// onError fallback: pokud URL existuje ale soubor selže → zobrazí tečku
import { useState } from 'react'
interface Props {
  team: { color: string; logo_url: string | null }
  size?: number     // default 18 (tečka), 44 (velké v Teams tabu)
  radius?: number   // default 4 pro logo, 50% pro fallback tečku
}
export function TeamLogo({ team, size = 18, radius = 4 }: Props) {
  const [imgError, setImgError] = useState(false)
  if (team.logo_url && !imgError) {
    return <img src={team.logo_url} onError={() => setImgError(true)}
      style={{ width: size, height: size, borderRadius: radius, objectFit: 'contain', flexShrink: 0 }} />
  }
  return <span className="team-dot" style={{ background: team.color, width: size, height: size, flexShrink: 0 }} />
}
```

### Krok 4 — Nahradit `team-dot` za `<TeamLogo>` ve veřejných komponentách
| Soubor | Aktuální | Nové | Poznámka |
|--------|----------|------|----------|
| `Results.tsx` | `team-dot` 12px | `<TeamLogo size={18}>` | |
| `Scorers.tsx` | `team-dot` 10px | `<TeamLogo size={18}>` | |
| `Teams.tsx` | žádná | `<TeamLogo size={44} radius={8}>` | v hlavičce karty týmu |
| `Bracket.tsx` | `team-dot` | `<TeamLogo size={18}>` | |
| `Standings.tsx` | `team-dot` 12px | `<TeamLogo size={14}>` | kompaktní layout — menší velikost |

### Krok 5 — TV Scoreboard (`Scoreboard.tsx`) — jako poslední, nejkritičtější
Ve všech třech sloupcích nahradit `team-dot` za `<TeamLogo>`:
- Tabulky skupin (levý sloupec): `size={14}`
- Zápasy (prostřední sloupec): `size={18}`
- Playoff (pravý sloupec): `size={18}`
- Střelci (levý sloupec): `size={14}`
- `overflow: hidden` + `objectFit: contain` + `flexShrink: 0` → loga nepřetékají layout

---

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
