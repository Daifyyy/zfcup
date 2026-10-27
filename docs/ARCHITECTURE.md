# Mapa aplikace a závislostí

> Referenční mapa pro práci na projektu: kde co je, kdo na čem závisí, kudy tečou data.
> Pravidla kódování jsou v `CLAUDE.md`, stav práce v `docs/PROGRESS.md`, plán v
> `C:\Users\denis\.claude\plans\expressive-leaping-pnueli.md`.
> Aktualizovat při přidání souboru, hooku, tabulky nebo migrace. Stav k 2026-10-27 (commit 80dfef6).

---

## 1. Vrstvy v kostce

```
 Prohlížeč ──► middleware.ts (Vercel Edge: maintenance heslo, OG HTML pro roboty)
               api/og.ts (OG obrázek 1200×630)
     │
     ▼
 index.html → src/main.tsx (fonty, CSS, ErrorBoundary) → src/App.tsx (routing + načtení dat turnaje)
     │
     ├─ hooky src/hooks/*  ──► src/lib/supabase.ts ──► Supabase REST (PostgREST + RLS)
     │        │                 src/lib/realtimeManager.ts ──► Supabase Realtime (WebSocket)
     │        └──────────────── src/lib/poller.ts (záloha za realtime)
     │
     ├─ veřejné komponenty src/components/public/* (jen čtou data z props)
     ├─ admin src/components/admin/* (zapisují přímo přes supabase, pak volají refetch*)
     └─ čisté výpočty src/lib/* (tabulky, rozpisy, formáty, historie, stav zápasu)
```

**Zásada:** data turnaje načítá **jen `App.tsx`** (cca 19 hooků) a posílá je dolů přes props.
Výjimky s vlastními hooky: `TournamentLanding`, `CompetitionPage`, `CompetitionSection`, `Tips`, `TipsAdminTab` (viz §4).

---

## 2. Routing (`src/App.tsx`)

| URL | Co se vykreslí | Detekce |
|-----|----------------|---------|
| `/` | `TournamentLanding` (seznam, soutěže, přihlášení, založení turnaje, Platforma) | `tournamentId === ''` |
| `/{uuid}` | turnaj: `Header` + záložky + `BottomNav` | `detectTournamentIdFromUrl()` |
| `/{uuid}?kiosk=1` | `KioskMode` (+ `Scoreboard` přes tlačítko) | stav `kiosk` |
| `/s/{slug}` | `CompetitionPage` (síň vítězů, věčná tabulka, rekordy, hráči) | `detectCompetitionSlugFromUrl()` |
| `/k/{slug}` | `ClubPage` (turnaje a umístění, vzájemné zápasy, hráči, soupiska) | `detectClubSlugFromUrl()` |
| `/{uuid}?zapas={id}` / `?tym={id}` | turnaj s otevřeným detailem zápasu (i play-off slotu) / týmu | `DetailHost` |

- Záložka turnaje je jen ve `history.state.tab` (ne v URL). Jediný `popstate` handler čte turnaj/soutěž z URL a záložku ze state.
- `openTournament(id)` → vždy Přehled; změna `tournamentId` zavře admin/bulletin/tabuli.
- Načítání: `TournamentSkeleton`, dokud `tournament.id !== tournamentId` nebo se načítají týmy/skupiny/zápasy; `notFound` → „Turnaj nenalezen“.
- **Detaily (Fáze 4)**: `TournamentDataContext` (data, která App už načítá — `useTournamentData()`) + `DetailHost` (stav otevřeného detailu, `useDetail().openTeam/openMatch`). Otevření = `pushState` s `detail` + `detailDepth` ve stavu a `?zapas=`/`?tym=` v URL; Zpět vrátí předchozí detail, křížek/Esc zavře všechny (`history.go(-depth)`); odkaz z URL se otevře bez nového záznamu (hloubka 0). `DetailHost` má `key={tournamentId}`. V kiosku/TV a adminu se detaily neotevírají (`useDetail()` mimo provider nic nedělá).
- Překryvy: `AdminPanel` (Ctrl+Shift+A / ikona zámku, jen `canEdit`), `PrintBulletin` (portál do `<body>`), `Scoreboard`, `PasswordResetOverlay`.
- Líně načítané: `AdminPanel`, `KioskMode`, `Scoreboard`, `PrintBulletin`, `CompetitionPage` (`lib/lazyComponent.tsx`), sdílecí grafiky (`share/lazy.tsx`), `xlsx` v exportech.

---

## 3. Datový tok

### 3.1 Načtení (hook)
```
useEffect([tournamentId]):
  cancelled = false; setX([]); setLoading(true)        ← přepnutí turnaje: pryč se starými daty
  fetch(): select … .eq('tournament_id', id) → if (cancelled) return → if (!error) setX(data)
  subscribeTable(tabulka, refetch, byTournament(id))   ← realtime jen pro tento turnaj
  onPoll(refetch)                                      ← záloha 120 s (tipy 180 s)
  cleanup: cancelled = true; unsub(); unpoll()
return { data, loading, refetch }                      ← refetch přes useRef
```

### 3.2 Zápis (admin)
```
admin komponenta → supabase.from(t).insert/update/delete  (RLS: can_edit_tournament)
                 → refetch*() z props (okamžitý UI update)
                 → DB pošle realtime událost → ostatní prohlížeče refetchnou (~0,4–2 s)
                 → DB triggery: after_match_result / after_bracket_slot_result → vyhodnocení tipů
```

### 3.3 Realtime (`src/lib/realtimeManager.ts`)
- Jeden kanál; vazby podle klíče `tabulka|filtr`. Filtrované odběry INSERT + UPDATE, k nim jeden **nefiltrovaný DELETE** na tabulku (Supabase DELETE filtrovat neumí).
- Kanál se přestaví jen při změně sady filtrů (přepnutí turnaje). Po obnovení spojení se všechno jednou refetchne.
- Filtry: běžné tabulky `tournament_id=eq.`, `tournament` `id=eq.`, tipy `tipster_id=eq.`, ročníky soutěže `competition_id=eq.`, historie soutěže `tournament_id=in.(…)` (sloučení do 3 s).
- Tabulky musí být v publikaci `supabase_realtime` (migrace 10).

### 3.4 Polling (`src/lib/poller.ts`)
Jeden časovač na interval; skrytá karta = nic; návrat na kartu = všechny refetche rozložené do 1,5 s.

---

## 4. Hooky → tabulky → kdo je používá

| Hook | Tabulka(y) | Realtime filtr | Používá |
|------|-----------|----------------|---------|
| `useTournament(id?)` | `tournament` | `id=eq.` | App |
| `useTeams` | `teams` | tournament | App |
| `usePlayers(id, teamId?)` | `players` | tournament | App |
| `useGroups` | `groups` | tournament | App |
| `useMatches` | `matches` | tournament | App |
| `useGoals` / `useAssists` / `useCards` / `usePenalties` | `goals` / `assists` / `cards` / `penalties` | tournament | App |
| `useBracket` | `bracket_rounds` + `bracket_slots` | tournament | App |
| `useBracketGoals` / `…Assists` / `…Cards` / `…Penalties` | `bracket_*` | tournament | App |
| `useAnnouncements` | `announcements` | tournament | App |
| `useRuleItems` | `rule_items` | tournament | App |
| `useReferees` | `referees` | tournament | App |
| `useSponsors` | `sponsors` | tournament | App |
| `useTipsters` | `tipsters` | tournament | Tips, TipsAdminTab |
| `useTips(tipster, id)` / `useBracketTips` / `useSpecialTips` | `tips` / `bracket_tips` / `special_tips` | `tipster_id` | Tips |
| `useCompetitions()` | `competitions` | bez filtru | App, TournamentLanding, CompetitionSection |
| `useCompetitionEditions(compId)` | `tournament` | `competition_id` | CompetitionSection |
| `useCompetitionHistory(slug)` | 18 tabulek všech ročníků | `competition_id` + `in(ročníky)` | CompetitionPage |
| `useAuthRole()` | auth + `platform_admins` | — | App, TournamentLanding, CompetitionSection |
| `usePlatformSettings()` | `platform_settings` | bez filtru | App, TournamentLanding |

---

## 5. Komponenty

### 5.1 Veřejné záložky (`src/components/public/`, pořadí `buildPublicTabs()` v `Header.tsx`)
| Záložka | Komponenta | Hlavní závislosti (lib) | Podmínka |
|---------|-----------|--------------------------|----------|
| Přehled | `Overview` | fixtures, matchState, standings, dates, sanitize | — |
| Zápasy | `Results` | matchState, leagueSchedule (řazení kol), dates, share | — |
| Tabulka | `Standings` | standings, formats (`getAdvancingCutoffs`), share | — |
| Statistiky | `Statistics` (+ `Scorers`) | sports | — |
| Týmy | `Teams` (karta → detail týmu) | details, fixtures | — |
| Pavouk | `Bracket` | history (`isPlacementRound`) | ne u ligy bez play-off |
| Pravidla | `Rules` | sanitize | — |
| Tipovačka | `Tips` (vlastní hooky tipů) | tipsEval, leagueSchedule, dates | globální vypínač && `tips_enabled` |
| Partneři | `Sponsors` | partners | `sponsors_enabled` |
| Média | `Media` | partners, exportPress (líně), `onPrint` | `press_enabled` |
| (Info) | `Info` | sanitize | starší záložka — není v `buildPublicTabs`, dostupná jen přes stav `tab`; kandidát na odstranění |

**Detaily**: `TeamDetailDrawer` (bilance ze skupin i play-off, zápasy → detail zápasu, soupiska se statistikami; exportuje `RoleBadge`/`StatBadges`), `MatchDetailDrawer` (skóre + PP/SN, kolo/datum/čas/hřiště/rozhodčí, střelci/asistence/karty/tresty po týmech, kopírování odkazu), `DetailHost`. Otevírají se z: `MatchRow` (Zápasy, Přehled, detail týmu), slot v `Bracket`, tým v `Standings`, mini tabulce a prázdném stavu Přehledu, karta v `Teams`, týmy v detailu zápasu.

**Kluby (Fáze 5)**: `clubs/ClubLibrary` (úvodní stránka → „Moje kluby“, jen přihlášený; líně), `club/ClubPage` (`/k/{slug}`, hook `useClubPage`), admin Týmy → `tabs/TeamsLibrary` (`LibraryPicker` „Přidat z knihovny“, `SaveToLibraryButton`). Odkazy na profil klubu: detail týmu, věčná tabulka soutěže.

Další veřejné: `Scoreboard` (TV tabule, paleta `C` natvrdo), `KioskMode` (TV, `kiosk/`), `PrintBulletin` (tisk), `AnnouncementCard`, `CompetitionPage` (`competition/`), `share/*` (sdílecí grafiky 1080×1080 / 1080×1920, `html-to-image`).

### 5.2 Administrace (`src/components/admin/AdminPanel.tsx`, `ADMIN_NAV`)
| Blok | Záložka | Komponenta | Zapisuje do tabulek |
|------|---------|-----------|---------------------|
| Obsah | Info | `InfoTab` (+ `MediaSection`) | tournament |
| | Oznámení | `AnnouncementsTab` | announcements |
| | Pravidla | `RuleItemsTab` | rule_items |
| Soutěž | Týmy | `TeamsTab` (+ `ImportTeamsModal`) | teams, players (+ Storage loga, fotky) |
| | Rozhodčí | `RefereesTab` | referees |
| | Skupiny | `GroupsTab` | groups, matches (generování rozpisu — leagueSchedule, formats) |
| | Střelci | `ScorersTab` | (čte) |
| Průběh | Zápasy | `MatchesTab` | matches, goals, assists, cards, penalties; exportExcel; tipsEval |
| | Play-off | `BracketTab` | bracket_rounds/slots/goals/assists/cards/penalties; formats → `fns.generate/seed/autoAdvance`; tipsEval |
| | Tipovačka | `TipsAdminTab` (+ `TipsGuideModal`) | tips, bracket_tips, special_tips, tipsters |
| Komerce | Partneři | `SponsorsTab` | sponsors (+ Storage) |
| Systém | Nastavení | `SettingsTab` (+ `CompetitionSection`, `BrandingSection`) | tournament, competitions, teams, tipsters; „Čistý start“ maže data turnaje |

Úvodní stránka `TournamentLanding` zapisuje `tournament` (založení) a přes `lib/editions.ts` `teams`, `players`, `clubs`, `persons` (převzetí do nového ročníku).

### 5.3 UI primitiva (`src/components/ui/`)
`Button` (`inactive` místo `disabled`), `Badge`/`MatchStatusBadge`, `Card`/`SectionHeader`/`StatTile`, `Tabs`/`Segmented`, `MatchRow`, `TeamLogo`, `PartnerStrip`, `TvPartnerBar`, `CardChip`, `Empty`, `Toast`, `QRCode`, `RichTextEditor` (TipTap), `TournamentSkeleton`, `icons/SportIcons`.
Layout: `layout/Header` (záložky, `HEADER_HEIGHT_DESKTOP`), `layout/BottomNav` (mobil).

---

## 6. `src/lib` — čisté výpočty a služby

| Modul | Účel | Závisí na | Používají ho |
|-------|------|-----------|--------------|
| `supabase.ts` | klient (verze **2.49.1**, explicitní `apikey`) | — | hooky, admin, formáty, editions, tipsEval, storage |
| `realtimeManager.ts` | sdílený realtime kanál s filtry | supabase | všechny datové hooky |
| `poller.ts` | společný polling + viditelnost karty | — | všechny datové hooky |
| `sports.ts` | `SportDef` (fotbal, hokej): body, OT/SO, terminologie, ikona | SportIcons | ~25 modulů — **základ bodování** |
| `standings.ts` | `calcGroupStandings(group, matches, sportDef)` — tabulka, H2H, tiebreakery | sports (typ) | Overview, Standings, Scoreboard, Kiosk, share, bulletin, MatchesTab, TipsAdminTab, všechny formáty, history, tipsEval, exportPress |
| `formats.ts` | registr 12 formátů, `getFormatDef`, `getLegacyFormatDef`, `getAdvancingCutoffs`, `formatColumns` | bracket-formats/* | BracketTab, GroupsTab, SettingsTab, Standings, TournamentLanding |
| `bracket-formats/*` | `generate` / `seed` / `autoAdvance` pro každý formát; `bracketHelpers` (`createRound`, `slotsOf`, `fill`) | supabase, standings | formats |
| `leagueSchedule.ts` | ligový rozpis (circle + DP), sezóna (Berger), `compareRounds`, `roundNumber`, `addDays` | — | GroupsTab, MatchesTab, Results, Tips, bulletin |
| `fixtures.ts` | `buildFixtures` (zápasy + play-off), `topScorers`, `currentSeasonRound` | matchState | Overview, Scoreboard, Kiosk |
| `matchState.ts` | `getMatchState` scheduled/live/final, `matchDay`, `parseHHMM` | dates | Overview, Results, Scoreboard, drawery detailů, MatchRow, fixtures |
| `dates.ts` | formátování dat | — | 8 modulů |
| `history.ts` | souhrn ročníků, věčná tabulka, rekordy, hráči napříč ročníky | standings, sports | CompetitionPage, CompetitionSection, Bracket, editions |
| `editions.ts` | `ensureIdentities`, `carryOverTeams`, `nextEditionNumber`, `slugify` | supabase, history | TournamentLanding, CompetitionSection |
| `tipsEval.ts` | vyhodnocení speciálních tipů, `checkTournamentWinner`, `recalcTipsterPoints` | supabase, standings | MatchesTab, BracketTab, TipsAdminTab, Tips |
| `partners.ts` | úrovně partnerů, `isMissingColumnError` | — | App, Sponsors, Media, admin |
| `theme.ts` | `applyTournamentTheme` (WCAG kontrast) | — | App, BrandingSection |
| `storage.ts` | cesty a upload do Storage (`tournaments/{id}/…`) | supabase | TeamsTab, SponsorsTab |
| `exportExcel.ts` / `exportPress.ts` | XLSX rozpis, kartičky rozhodčích / tiskový servis | standings, sports, `xlsx` (líně) | MatchesTab / Media |
| `sanitize.ts` | DOMPurify pro `dangerouslySetInnerHTML` | — | Overview, Info, Rules, AnnouncementCard |
| `brand.ts` | `BRAND.name` (název platformy — nepsat natvrdo) | — | 8 modulů |
| `constants.ts` | `TEAM_COLORS`, `addMinutes`, `matchCount` | — | admin, Scoreboard |
| `TournamentContext.tsx` | `useTournamentId()` | — | App |
| `TournamentDataContext.tsx` | `TournamentData` (data turnaje pro detaily), `useTournamentData()`, `useDetail()` | — | App, DetailHost, drawery, Teams, Results, Overview, Standings, Bracket |
| `clubs.ts` | knihovna klubů (migrace 13): `libraryAvailable`, `fetchLibrary`, `createClub`, `uniqueClubSlug`, `addClubToTournament`, `saveTeamToLibrary`, `mergeClubs` | supabase, history, editions | ClubLibrary, TeamsLibrary, editions, CompetitionSection |
| `clubHistory.ts` | `clubSeasons` (umístění v turnajích), `clubTotals`, `headToHead`, `clubPlayers` | history, standings, sports | ClubPage |
| `details.ts` | `findMatchDetail` (zápas i slot, hřiště jako v Zápasech), `matchEvents`, `teamFixtures`, `teamRecord`, `playerStats`, `rosterOf` | fixtures, sports | drawery, Teams |
| `lazyComponent.tsx` | líné načítání s fallbackem | — | App |

**Citlivá místa (změna = spustit `npm test`):** `standings.ts` → nasazení play-off, tipy, historie, TV; `sports.ts` → bodování všude; `bracket-formats/*` → postup v pavouku; `leagueSchedule.ts` → rozpisy.

---

## 7. Databáze (Supabase)

### 7.1 Tabulky
- **Turnaj:** `tournament` (nastavení, formát, moduly, branding, `owner_id`, `competition_id`, `edition`, `schedule_mode`, `sport`)
- **Soupisky:** `teams` (`club_id`), `players` (`person_id`, `avatar_url`), `referees`
- **Základní část:** `groups` (`team_ids[]`, tiebreaker), `matches` (`group_id`, `round`, `match_date`, `decided_in`, `referee_id`)
- **Statistiky zápasů:** `goals`, `assists`, `cards`, `penalties`
- **Play-off:** `bracket_rounds`, `bracket_slots` (`decided_in`, `match_date`), `bracket_goals`, `bracket_assists`, `bracket_cards`, `bracket_penalties`
- **Obsah:** `announcements`, `rule_items`, `sponsors` (`tier`)
- **Tipovačka:** `tipsters`, `tips`, `bracket_tips`, `special_tips` (globálně vypnutá, zabezpečení odloženo)
- **Soutěže:** `competitions` (`owner_id`, `slug`), `clubs`, `persons`
- **Platforma:** `platform_admins`, `platform_settings`
- Každá datová tabulka má `tournament_id` (FK, index z migrace 12).

### 7.2 Funkce a triggery
- `can_edit_tournament(tid)`, `can_edit_competition(cid)`, `is_platform_admin()`, `can_edit_storage_path(name)`, `try_uuid()` — RLS (migrace 11)
- `after_match_result` → `evaluate_tips()`; `after_bracket_slot_result` → `evaluate_bracket_tips()` (03)
- `recalc_all_tipster_points()` (06)

### 7.3 Migrace (`db-backup/`, spouští uživatel v SQL Editoru)
01 tabulky · 02 RLS · 03 triggery · 04 storage · 05 upgrade sloupců · 06 FK indexy + RPC · 07 multisport · 08 partneři/branding/média · 09 soutěže a sezóny · 10 realtime publikace · 11 role a RLS podle vlastníka · **12 indexy `tournament_id`** — všechny spuštěné. Další volné číslo: **13** (knihovna klubů, Fáze 5).

### 7.4 Storage (bucket `team-logos`)
Nové soubory pod `tournaments/{turnajId}/…` (`lib/storage.ts`); starší cesty `{teamId}.png`, `sponsors/{id}.png`, `players/{id}.png`.

---

## 8. Nasazení a prostředí
- **Vercel:** build `vite build`; env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (zapečené při buildu), `MAINTENANCE`, `MAINTENANCE_USER`, `MAINTENANCE_PASSWORD` (edge middleware).
- **`vercel.json`:** rewrite na `index.html` (mimo `/api/`), hlavičky — CSP (`'self'` + `*.supabase.co` + YouTube iframe), HSTS, X-Frame-Options, cache `/assets/`.
- **Push na `main` = nasazení.** Web je za maintenance heslem (`MAINTENANCE=true`).
- **Závislosti:** react 18, vite 6, typescript 5, tailwind 3, `@supabase/supabase-js` **2.49.1 (nepovyšovat)**, lucide-react, @tiptap, dompurify, html-to-image, qrcode.react, xlsx, @vercel/og, @fontsource (Barlow Condensed, Inter); dev: vitest 3.

## 9. Testy a kontroly
- `npm test` — Vitest, `src/lib/__tests__/` (91 testů): `clubHistory`, `details`, `standings`, `leagueSchedule`, `matchState`, `history`, `poller`, `bracketFormats` (integrační: všech 12 formátů od struktury po vítěze; Supabase nahrazen paměťovou „DB“ přes `vi.mock`).
- `npm run typecheck` — baseline 63 starších chyb, nové nesmí přibýt.
- Chybí: testy `tipsEval.ts`, komponent a E2E automatizace (E2E se dělá ručně v Chromu).
