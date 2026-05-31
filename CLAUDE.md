# CLAUDE.md — Instrukce pro Claude Code

## Role
Jsi senior full-stack developer. Webová aplikace pro firemní fotbalový turnaj.
Referenční implementace: `turnaj_final.html` — zachovej veškerou existující funkcionalitu.

## Technický stack
- **Frontend:** React 18 + Vite 6, TypeScript; **Styling:** Tailwind CSS 3 (světlé téma, #f8fafc / #2563eb)
- **Backend:** Supabase (PostgreSQL + RLS + Realtime + Auth); **Hosting:** Vercel
- **Fonty:** Bebas Neue (nadpisy), DM Sans (text)
- **`@supabase/supabase-js` přesně `2.49.1`** — nepovyšovat! Verze 2.99+ neodesílá `apikey` header pro mutace → 400 Bad Request
- `createClient` musí mít explicitní `global: { headers: { apikey: supabaseAnonKey } }` (viz `src/lib/supabase.ts`)

## Multi-tenant architektura
Každá datová tabulka má `tournament_id UUID NOT NULL FK → tournament(id)`. Viz `db-backup/05_migrations.sql`.

### Typy uživatelů
| Typ | Auth |
|-----|------|
| Divák | Žádný — čtení přes URL `/{tournamentId}` |
| Tipér | Vlastní systém — jméno + PIN → tabulka `tipsters` |
| Admin | Supabase Auth (email + heslo) → JWT → RLS write |

### Routing
- **`/`** → `TournamentLanding` (seznam + admin login + create)
- **`/{tournamentId}`** → konkrétní turnaj (UUID z `window.location.pathname`)
- `src/lib/TournamentContext.tsx` — `TournamentProvider` + `useTournamentId()` hook
- Reset hesla: `onAuthStateChange` event `PASSWORD_RECOVERY` → `PasswordResetOverlay`
- **Auth → "Allow new users to sign up" = VYPNUTO** — nové účty přes Supabase dashboard → Invite user

## RLS a DB záloha
Kompletní SQL (tabulky, RLS, triggery, storage, migrace) je v `db-backup/01–05_*.sql`.
Stručný přehled RLS šablony: SELECT pro všechny (anon), ALL pro authenticated — viz `db-backup/02_rls.sql`.

## DB Schema — kritické detaily
- `matches.scheduled_time TEXT NOT NULL`, `matches.round TEXT NOT NULL` — při UPDATE posílat `''`, **ne `null`** → jinak 400
- `goals`: UNIQUE(player_id, match_id); `bracket_goals`: UNIQUE(slot_id, player_id) — **samostatná tabulka**, playoff sloty nejsou v `matches`
- `special_tips.predicted_team_id` nullable — pro `top_scorer` INSERT nutno `predicted_team_id: null`
- `tournament` klíčové sloupce: `format ('groups'|'league')`, `format_id TEXT`, `league_has_playoff BOOL`, `num_pitches INT DEFAULT 2`, `tips_enabled BOOL`, `tips_lock_from TEXT`, `assists_enabled BOOL`, `cards_enabled BOOL`, `logo_url TEXT`, `slug TEXT UNIQUE NOT NULL`
- `announcements`: `type TEXT DEFAULT 'text'` (`'text'|'image'|'video'`), `media_url TEXT`
- `tips`/`bracket_tips`: UNIQUE(tipster_id, match_id) / UNIQUE(tipster_id, slot_id)

## Pravidla kódování

**Hooky:**
- Každá entita má hook v `src/hooks/`; všechny přijímají `tournamentId: string` jako 1. param — bez něj nefetchují (`if (!tournamentId) return`)
- Výjimky: `useTournament(tournamentId?)`, `useTips(tipsterId, tournamentId)`, `useBracketTips(tipsterId, tournamentId)`, `useSpecialTips(tipsterId, tournamentId)`
- Realtime přes `src/lib/realtimeManager.ts` (singleton, sdílený kanál `app-realtime`) — hooky volají `subscribeTable(table, handler)`
- Polling intervaly: dynamic data 120s, tipy 180s; Page Visibility API zastaví polling při `document.hidden`
- `refetch()` exponovat přes `useRef` pattern (viz useMatches, useBracket) — pro okamžitý UI update po save

**Bezpečnost a správnost:**
- **`dangerouslySetInnerHTML` — vždy sanitizovat** přes `sanitizeHtml(html)` z `src/lib/sanitize.ts` (DOMPurify wrapper)
- **`if (!error)` pattern** — hooky nesmí mazat state při selhání: `const { data, error } = await supabase...; if (!error) setState(data ?? [])`
- Nikdy `service_role` key ve frontendu; chyby → toast (ne `console.error`)

**UI / formuláře:**
- Všechny `<button>` musí mít `type="button"` — bez toho nechtěný form submit
- **Nikdy `disabled` na tlačítkách** — Android ignoruje touch eventy; místo toho guard uvnitř `onClick` + toast + `style={{ opacity: 0.5 }}`
- **`async save` funkce — vždy `try-finally`**: `setSaving(false)` musí být ve `finally` — jinak tlačítko uvízne při síťové chybě

**DB mutace:**
- **Batch UPDATE** místo N+1 smyčky: `.update().in('id', ids)` — viz `recalcAllTips`
- **Optimistické UI pro řazení**: lokální swap + `Promise.all` DB updaty; při chybě revert state
- **Tipy — upsert**: `supabase.from('tips').upsert({...}, {onConflict: 'tipster_id,match_id'})` — předchází UNIQUE violation
- **Tipy — NEčistit `dirty` po save**: `setDirty(new Set())` způsobuje přepsání inputů realtime updatem; čistit jen na unmount

## Důležité chování / known issues
- **Mazání skupiny**: nejdříve DELETE matches, pak skupinu — cascade nefunguje jak se čeká
- **Trigger `after_match_result`**: UPDATE tipsters musí mít `WHERE id IN (SELECT tipster_id FROM tips WHERE match_id = NEW.id)` — bez WHERE Supabase rollbackne i původní UPDATE matches
- **`played` flag**: auto-set na `true` při ukládání pokud home_score > 0 nebo away_score > 0
- **Admin panel backdrop drag**: mousedown uvnitř → mouseup venku by zavřel panel; fix: `mouseDownOnBackdrop = useRef(false)` v `AdminPanel.tsx`
- **BracketTab SlotEditor.saveAll**: chyba gólů/asistencí/kartiček neblokuje `onSave()` — auto-advance proběhne i při částečném selhání
- **Race conditions**: `generateLeague()` a `seedPlayoff()` mají `if (loading) return` guard — nelze použít `disabled`, guard musí být uvnitř funkce
- **SettingsTab.resetData**: UPDATE musí cílit `.eq('id', tournament.id)` — nikdy `.neq()` (zasáhlo by všechny řádky)
- **Scorers.tsx**: při `showAssists` zobrazovat `+0A` s `color: transparent` pro zarovnání sloupců
- **InfoTab save**: volat `refetchTournament()` — jinak změny viditelné až po 120s pollingu
- **Android zoom**: `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }`
- **RichTextEditor** (`src/components/ui/RichTextEditor.tsx`): TipTap + StarterKit; výstup HTML string; renderovat přes `dangerouslySetInnerHTML` s třídou `rich-content`
- **Čistý start (`resetTournamentData`)**: soft tables (bracket_*) — chyby ignorovány; hard tables (goals, tips, matches, groups) — chyba zastaví

## Parametr `num_pitches` — vzorce
**Skupiny**: `pitchesPerGroup = max(1, floor(numPitches / numGroups))`, čas = `floor(matchIndex / pitchesPerGroup) * (duration + break)`

**Liga** (`leagueSchedule.ts`): circle-method + DP optimalizace; `orderedPairs → batches po numPitches → 1 time slot per batch`
```
leagueSlotCount(n, numPitches):
  rounds = n % 2 === 0 ? n-1 : n
  realPairs = n % 2 === 0 ? n/2 : (n-1)/2
  return rounds * ceil(realPairs / numPitches)
```

## Bracket (Play-off) — architektura

### Formátový registr (`src/lib/formats.ts`)
Přidat nový formát = soubor v `src/lib/bracket-formats/` + řádek v `TOURNAMENT_FORMATS`.
Klíčové funkce: `getFormatDef(formatId)`, `getLegacyFormatDef(tournament, groups)` (zpětná kompatibilita), `getAdvancingCutoffs(formatId, tournament)`

### Registrované formáty (11)
| ID | Struktura | Skupin |
|----|-----------|--------|
| `league` | Jen tabulka | 1 |
| `league_playoff` | QF(2)+SF+O3+Final | 1 |
| `league_sf` | SF(2)+O3+Final | 1 |
| `groups_sf` | SF(2)+O3+Final | 1–2 |
| `groups_six` | QF(2)+SF+O3+Final | 3 |
| `groups_six_cross` | QF(3)+SF+O3+Final | 3 |
| `groups_qf` | QF(4)+SF+O3+Final | 4 |
| `groups_qf_full` | QF+O7-8SF+SF+O5+O3+Final | 4 |
| `groups_full_placement` | Útěšné QF+QF+…+Final (10 kol) | 2 |
| `knockout_8` | QF(4)+SF+O3+Final (bez skupin) | 0 |
| `groups_ro16` | R16(8)+QF+SF+O3+Final | 8 |

### BracketTab flow
1. `generateStructure` → `formatDef.fns.generate()`
2. `seedTeams` → `formatDef.fns.seed({groups, matches, bracketRounds, bracketSlots, advancingPerGroup})`
3. `saveSlot` → `formatDef.fns.autoAdvance(...)` → při finále → `checkTournamentWinner(bracketRounds, tournament.id)`
- `formatDef = getFormatDef(tournament.format_id) ?? getLegacyFormatDef(tournament, groups)`
- **Auto-advance konvence**: `slot.position % 2 === 0 → 'home_id'`, jinak `'away_id'`; terminální kola (O3, O7…) → `return { toast: 'Uloženo ✓' }`

## Tipovačka — architektura
Session: `localStorage` klíč `turnajnik_tipster_id`. Bodování: skupiny 3/1 b., playoff 5/2 b.
Speciální: Vítěz turnaje 10 b., Nejlepší střelec 10 b., Vítěz skupiny 5 b., Tým s nejvíce góly 5 b., Poslední skupiny 3 b.

### Vyhodnocení — kdo spouští
| Typ | Spouští |
|-----|---------|
| Skupiny | DB trigger `after_match_result` → `evaluate_tips()` |
| Playoff | DB trigger `after_bracket_slot_result` |
| Speciální skupinové | `TipsAdminTab` mount → `useEffect` → `calcGroupStandings` |
| Vítěz turnaje (playoff) | `BracketTab.saveSlot` → `checkTournamentWinner` |
| Vítěz turnaje (liga bez playoff) | `MatchesTab.saveAll` → `checkLeagueTournamentWinner` |

### Klíčové soubory
- `src/lib/tipsEval.ts` — všechny eval funkce; všechny přijímají `tournamentId` jako poslední param
- `src/components/public/Tips.tsx` — `SpecialTipsSection` **nesmí být nested komponenta** (reset state)
- `TipsAdminTab.tsx` — `recalcAllTips(showToast)` try/catch + error check na každém UPDATE

### Datový zámek
- `isMatchTimePassed(scheduledTime, lockFromDate?)` — `today < lockFromDate` → tipy volné
- `anyPlayoffPlayed`: liga bez playoff → zamkne od 1. odehraného zápasu; ostatní → zamkne při nasazení do bracket

## Volitelné moduly
Všechny togglované v Admin → Nastavení → Volitelné moduly; řídí `tournament.assists_enabled` / `tournament.cards_enabled`.
- **Asistence**: hooky `useAssists`/`useBracketAssists`; ±stepper v editoru; Scorers — sloupec `G+A`, `+0A` s `color: transparent` pro zarovnání
- **Kartičky**: hooky `useCards`/`useBracketCards`; záznamy INSERT/DELETE (ne upsert); záložka Disciplína — viditelná jen pokud `cards_enabled`
- **Import CSV/Excel**: `src/components/admin/ImportTeamsModal.tsx`; balíček `xlsx`; List "Sheet1" se importuje pokud `players.length > 0`
- **Fotky hráčů**: `players.avatar_url`; Storage `team-logos/players/{id}.png|.jpg`; max 200 KB, pouze PNG/JPG
- **Tisknutelný bulletin**: `src/components/public/PrintBulletin.tsx`; `window.print()` po 400ms

## Architektura záložek (přehled)
**Veřejné**: overview, teams, results (label "Zápasy"), standings, scorers, bracket (skryta při `league && !league_has_playoff`), info, rules (`rule_items` karty), discipline (jen `cards_enabled`), tips (jen `tips_enabled`)

**Admin pořadí**: Info → Oznámení → Pravidla → Týmy → Skupiny → Střelci → Zápasy → Play-off → Tipovačka → Nastavení
Aktivní záložky (Zápasy, Play-off, Tipovačka) = zelené pozadí (`ACTION_TABS` v AdminPanel.tsx)

**Standings barevné kódování**:
- Liga: 0–1 zelená (→SF), 2–5 amber (→QF)
- Groups: 0 zelená (vítěz), 1 světle modrá (postup)

## Loga (Supabase Storage, bucket "team-logos")
- Týmová loga: `{teamId}.png`, max 500 KB; cache-bust: `?v={timestamp}`; komponenta `TeamLogo`
- Logo turnaje: `tournament-logo.png`, 140px v Overview; po uploadu volat `refetchTournament()`

## Vercel deployment
`VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` jsou baked při buildu — změna env vars v dashboardu vyžaduje redeploy.

**Checklist "No API key" / kód 21000:**
- `package.json`: `"@supabase/supabase-js": "2.49.1"` (bez `^`)
- `src/lib/supabase.ts`: `global: { headers: { apikey: supabaseAnonKey } }`
- Commitnuto + pushnuto; Vercel env vars nastaveny; nový build PO nastavení env vars
