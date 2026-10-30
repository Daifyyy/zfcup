# CLAUDE.md — Instrukce pro Claude Code

## Role
Jsi senior full-stack developer. Multi-sportová platforma pro firemní a amatérské turnaje (prodávaný produkt, profesionální „broadcast“ vzhled).
Referenční implementace: `turnaj_final.html` — zachovej veškerou existující funkcionalitu.

**Orientace v projektu:** `docs/ARCHITECTURE.md` (mapa aplikace: routing, datový tok, hooky → tabulky, komponenty → zápisy, závislosti `src/lib`, DB, migrace) · `docs/PROGRESS.md` (stav, „Kde navázat“) · plán fází `C:Usersdenis.claudeplansexpressive-leaping-pnueli.md`. Při přidání souboru/hooku/tabulky/migrace aktualizovat i mapu.

## Technický stack
- **Frontend:** React 18 + Vite 6, TypeScript (`npm run typecheck`); **Styling:** CSS tokeny + Tailwind 3 — viz „Design systém“
- **Testy:** Vitest (`npm test`) — `src/lib/__tests__/` (tabulky, rozpisy, stav zápasu, historie, polling a integrační test všech 12 formátů play-off s paměťovou „DB“). Změna výpočtů = spustit testy.
- **Backend:** Supabase (PostgreSQL + RLS + Realtime + Auth); **Hosting:** Vercel + Cloudflare souběžně (přesun na Cloudflare, viz Nasazení)
- **Fonty:** Barlow Condensed (nadpisy, skóre — `var(--font-display)`), Inter (text — `var(--font-body)`) — hostované s aplikací (`@fontsource`, `src/fonts.ts`, jen latin + latin-ext), **ne Google Fonts** (GDPR, CSP je bez Google domén)
- **Ikony:** `lucide-react` + vlastní sportovní ikony `SportDef.Icon` (`src/components/ui/icons/SportIcons.tsx`). **Žádná emoji v UI.**
- **`@supabase/supabase-js` přesně `2.49.1`** — nepovyšovat! Verze 2.99+ neodesílá `apikey` header pro mutace → 400 Bad Request
- `createClient` musí mít explicitní `global: { headers: { apikey: supabaseAnonKey } }` (viz `src/lib/supabase.ts`)

## Design systém (broadcast vzhled)
- **Tokeny** v `src/index.css` `:root`: `--surface-0/1/2`, `--ink`, `--ink-muted`, `--line`, `--chrome*` (tmavé lišty), `--brand*` (značka turnaje), `--live/--win/--loss/--draw/--warn/--gold`, `--radius*`. Staré názvy (`--accent`, `--muted`, `--border`, `--text`…) jsou aliasy → nepoužívat v novém kódu.
- **Nikdy natvrdo hex barvy** v komponentách (výjimka: TV paleta `C` ve `Scoreboard`/`KioskMode`, sdílecí šablony).
- Inline styl s `fontFamily: 'var(--font-display)'` dostane automaticky verzálky + tučné + tabulková čísla (pravidlo `[style*="font-display"]` v index.css).
- **Potvrzení akcí**: `await confirmDialog(text, { danger, title, confirmLabel })` (`src/components/ui/ConfirmDialog.tsx`, `<ConfirmHost/>` v `main.tsx`). **Nikdy `window.confirm/alert/prompt`** (blokují stránku i automatizaci).
- **TV (Tabule `Scoreboard` + TV režim `KioskMode`)**: sdílené `src/components/tv/` — paleta `TV` a velikosti `TV_SIZE` (vw, Full HD i 4K), `fit()` + `FitBox` (když se obsah nevejde, plynule zmenší písmo — nic se neusekne), `tvLogo(px)` (loga podle rozlišení), `TvGroupTable` (sloupce podle sportu, pásma postupu z `src/lib/zones.ts`). Akcent = `var(--brand-on-dark)`, nikdy natvrdo modrá.
- **Demo na úvodní stránce**: `src/demo/` — dlaždice `FEATURES` otevírají `DemoModal` s živými ukázkami nad `buildDemoData()` (žádné dotazy do DB). Nová funkce = doplnit dlaždici a ukázku. Velikosti TV používají `var(--tv-vw, 1vw)`, aby šly zmenšit do ukázky. Jen 4 ukázky (živé výsledky, TV, grafiky, formáty); na mobilu je ukázka přes celou obrazovku s popisem nahoře. „Chci turnaj“ (hero, pás pod funkcemi, ukázky, patička „Kontakt“) = `contactHref()` z `src/lib/brand.ts`, jen když je vyplněný `BRAND.supportEmail`.
- **Pásma postupu** v tabulkách: `standingsZones(tournament)` (`src/lib/zones.ts`) — web i TV.
- **Ikony oznámení**: klíč v `announcements.icon` (`src/lib/announcementIcons.tsx`, staré emoji se převádějí při zobrazení); obrázek oznámení se nahrává do Storage `tournaments/{id}/announcements/…`.
- **Primitiva** `src/components/ui/`: `Button` (prop `inactive` místo `disabled`), `Badge`/`MatchStatusBadge`, `Card`/`SectionHeader`/`StatTile`, `Tabs`/`Segmented`, `MatchRow` (výsledková lišta), `PartnerStrip`, `TvPartnerBar`, `CardChip` (žlutá/červená karta), `TeamLogo` (fallback = iniciály), `Empty` (řetězcová ikona se ignoruje).
- **Styly**: `src/styles/ui.css` (primitiva), `layout.css` (hlavička, spodní navigace, TV tabule, admin), `pages.css` (veřejné stránky), `landing.css` (úvodní stránka).
- **Značka platformy**: `src/lib/brand.ts` (`BRAND.name` — název zatím není finální, nikde jinde nepsat natvrdo).
- **Právní rámec**: údaje provozovatele jen v `src/lib/legal.ts` (`OPERATOR`, prázdné = „[doplnit]“), stránky `/pravni/{doc}` (`LegalPage`), patička `SiteFooter`. Nový zpracovatel/externí služba = doplnit `SUBPROCESSORS`; nové úložiště v prohlížeči = doplnit tabulku na stránce Cookies. YouTube jen přes `youtube-nocookie.com`.
- **Stav zápasu** `getMatchState(match, tournament)` (`src/lib/matchState.ts`) → `scheduled|live|final`; „Živě“ jen v den turnaje (`tips_lock_from`) v okně `scheduled_time + match_duration`. Bez změny DB.
- `src/lib/fixtures.ts`: `buildFixtures()` (zápasy + play-off sloty), `topScorers()`.
- **Detail týmu / zápasu**: `useDetail().openTeam(id)` / `openMatch(id)` (id zápasu i play-off slotu) odkudkoli na veřejném webu; data z `useTournamentData()` (`src/lib/TournamentDataContext.tsx`, plní `App.tsx` — žádné další dotazy), výpočty v `src/lib/details.ts`. `DetailHost` drží stav, URL `?zapas=`/`?tym=` a historii (Zpět zavře). Klikací `MatchRow` = prop `onClick`; vnořená tlačítka (Sdílet) musí volat `e.stopPropagation()`.

## Soutěže, ročníky a sezóny (migrace 09)
- **Hierarchie**: `competitions` (soutěž) → ročníky = `tournament` s `competition_id` + `edition` (UNIQUE v soutěži) + `season_label`.
- **Identita napříč ročníky**: `clubs` ↔ `teams.club_id`, `persons` ↔ `players.person_id`. Bez propojení se páruje podle normalizovaného jména (`normalizeName` v `src/lib/history.ts`; hráč v rámci klubu).
- **`src/lib/history.ts`** (čisté funkce): `summarizeEditions` (vítěz: finále, u ligy bez play-off konečná tabulka), `allTimeTable` (body dle `SportDef`, V/VP/PP/P), `computeRecords`, `allTimePlayers`, `isPlacementRound`.
- **`src/lib/editions.ts`**: `ensureIdentities`, `carryOverTeams` (převzetí týmů+soupisek, idempotentní), `nextEditionNumber`, `slugify`.
- **Hooky** `src/hooks/useCompetitions.ts`: `useCompetitions()`, `useCompetitionEditions(competitionId)`, `useCompetitionHistory(slug)` (vrací `available: false` bez migrace).
- **UI**: veřejná stránka `/s/{slug}` (`src/components/competition/CompetitionPage.tsx`; nahoře vždy přehled `competitionHighlights` + řada ročníků; v turnaji výběr ročníku v hlavičce `editionOptions` a karta Historie soutěže na Přehledu; detekce v `App.tsx`, `detectTournamentIdFromUrl` vrací '' pro `/s/…`), admin Nastavení → Soutěž a ročník (`CompetitionSection.tsx`), sekce Soutěže na úvodní stránce, odkaz v hlavičce ročníku.
- **Sezónní režim** `tournament.schedule_mode = 'season'` (volí se při založení, pak read-only): zápasy mají `match_date`; rozpis `generateSeasonSchedule()` (`src/lib/leagueSchedule.ts`: Berger + Eulerova orientace doma/venku, 1×/2×); `round = 'N. kolo'` (`roundNumber()` pro řazení). `match_date` posílat do DB **jen v sezónním režimu** (bez migrace sloupec chybí).
- **Datum v logice**: `getMatchState`/`matchDay` (`src/lib/matchState.ts`), zámek tipů `isMatchTimePassed(time, lockFromDate, matchDate)`, TV tabule/kiosk ukazují aktuální kolo (`currentSeasonRound` v `src/lib/fixtures.ts`), formátování `src/lib/dates.ts`.

## Soukromé turnaje (migrace 15)
- `tournament.visibility` (`public`|`private`) + `access_code`. RLS čtení přes `can_read_tournament(tid)`: veřejný, vlastník/správce, nebo kód v hlavičce `x-access-code` (posílá `src/lib/supabase.ts` z `src/lib/accessCodes.ts`, jen pro `/rest/v1/`). Realtime hlavičku nezná → divák s kódem má polling 30 s (`App.tsx`).
- Nová tabulka s `tournament_id` = přidat ji do seznamu v migraci 15 (politika `public_read` s `can_read_tournament`). `visibility`/`access_code` posílat jen u soukromého turnaje (bez migrace sloupce chybí).
- Validační turnaj `/adcb7982-5716-407a-9f27-6fbae02346cb` (slug `validacni-pohar-2026`) nemazat; skript `src/dev/seedValidation.ts`.
- **QR a odkazy u soukromého turnaje**: TV tabule, TV režim a QR na Přehledu obsahují přístupový kód (`tournamentQrUrl` v `src/lib/share.ts`). Sdílecí grafika a „Kopírovat odkaz“ jsou bez kódu; v okně sdílení volba „Přidat přístupový kód“ (výchozí vypnuto, `withAccessCode`).
- Úvodní stránka nezobrazuje všechny turnaje: vyhledávání + „Právě probíhá“ + „Moje turnaje“ (`src/lib/tournamentSearch.ts`).

## Knihovna klubů (migrace 13)
- `clubs`/`persons` patří **organizátorovi** (`owner_id`), `competition_id` je nepovinné; `clubs.slug` globálně unikátní → veřejná stránka `/k/{slug}` (`ClubPage`, `useClubPage`, výpočty `src/lib/clubHistory.ts`). Soupiska klubu = `persons.club_id` (+ `number`, `role`).
- `src/lib/clubs.ts`: `libraryAvailable()` (bez migrace → knihovna skrytá), `addClubToTournament`, `saveTeamToLibrary`, `mergeClubs`. `ensureIdentities` s migrací páruje kluby v knihovně vlastníka turnaje.
- UI: úvodní stránka → „Moje kluby“ (`ClubLibrary`), Admin → Týmy → „Přidat z knihovny“ / „Uložit do knihovny“. Logo klubu ve Storage `clubs/{clubId}/logo.{png|jpg}`.
- Sezónní režim nabízí jen ligové formáty (`formatsForScheduleMode`).

## Multi-tenant architektura
Každá datová tabulka má `tournament_id UUID NOT NULL FK → tournament(id)`. Viz `db-backup/05_migrations.sql`.

## Multi-sport architektura
Aplikace podporuje více sportů (fotbal, hokej) přes `tournament.sport` (`'football'|'hockey'`, NOT NULL, default `'football'`) — viz `db-backup/07_multisport.sql`.
- **Registr sportů**: `src/lib/sports.ts` — `SportDef` (ikona, terminologie hřiště/výkopu/částí zápasu, bodovací vzorec V/R/P, typ modulu disciplíny). `getSportDef(tournament?.sport)` vždy vrací platnou definici (fallback fotbal).
- **Sport je needitovatelný po založení turnaje** — volí se jen ve `TournamentLanding` při vytváření; `SettingsTab` jej zobrazuje read-only. Důvod: změna sportu za chodu by rozbila konzistenci bodování a rozehraných dat.
- **Bodování (`src/lib/standings.ts`)**: `calcGroupStandings(group, matches, sportDef)` — `sportDef` je **povinný** (dřív volitelný fotbalový default způsobil špatné nasazení play-off a vyhodnocení tipů u hokeje). `StandingRow` má i `otw`/`otl` (výhry/prohry po prodl./nájezdech); H2H počítá body vítěze i poraženého. Nasazení play-off dostává `sportDef` přes `SeedParams`. Hokej: `allowDraws: false` → sloupec remíz se v `Standings.tsx`/`Scoreboard.tsx`/`KioskMode.tsx` skryje.
- **Disciplína — dva paralelní moduly**: `cards`/`bracket_cards` (fotbal, žlutá/červená, `cards_enabled`) a `penalties`/`bracket_penalties` (hokej, trestné minuty 2/5/10, `penalty_minutes_enabled`). Hooky `usePenalties`/`useBracketPenalties`. Žádný modul nenahrazuje druhý — `SettingsTab` nabízí jen ten, který odpovídá `sportDef.discipline`.
- **Zadávání trestných minut**: `MatchesTab`/`BracketTab` slot editory mají sekci "🚨 Trestné minuty" (viditelná jen při `penalty_minutes_enabled`) — tlačítka +2/+5/+10 přidávají záznam do pole na hráče (na rozdíl od karet nemá `penalties`/`bracket_penalties` UNIQUE constraint, hráč může mít víc trestů za zápas); badge se odebere kliknutím. Save = delete all pro match/slot + insert nového pole, stejný vzor jako kartičky. Zobrazuje se i ve veřejné záložce Týmy (roster badge) a ve Statistikách — stejná parita jako kartičky u fotbalu.
- **Prodloužení/nájezdy (OT/SO)**: `matches.decided_in`/`bracket_slots.decided_in` (`'regulation'|'ot'|'so'`, nullable). `sportHasOvertime(sportDef)` (`src/lib/sports.ts`) řídí, kde se v UI vůbec zobrazí přepínač "Základní hrací doba / Prodloužení / Nájezdy" — u fotbalu se skryje a `decided_in` zůstává `null`. Hokej má `standings.otWinPts: 2, otLossPts: 1` (IIHF 3-2-1-0 schéma) — `calcGroupStandings`/`calcH2H` v `standings.ts` je použije místo `winPts`/`lossPts`, pokud `decided_in !== 'regulation'`. Veřejně se zobrazí jako badge "PP"/"SN" u skóre (`Results.tsx`, `Bracket.tsx`).
- **Ochrana proti remíze**: pokud `sportDef.standings.allowDraws === false` (hokej), `MatchesTab`/`BracketTab` odmítnou uložit odehraný zápas/slot s `home_score === away_score` — toast žádá zadat konečné rozhodnuté skóre. Zápas se totiž hraje až do rozhodujícího gólu, takže uložené skóre je vždy nerozhodné; `decided_in` je jen metadata o tom, *kdy* padl rozhodující gól (pro bodování a badge), ne mechanismus rozlousknutí remízy v datech.
- **Známý dluh**: `bracket-formats/*.ts` `homeWins` porovnání skóre nerozlišuje `decided_in` — nevadí, protože playoff skóre je vždy rozhodné (viz ochrana proti remíze výše), takže postup do dalšího kola funguje správně i bez toho.

### Typy uživatelů
| Typ | Auth |
|-----|------|
| Divák | Žádný — čtení přes URL `/{tournamentId}` |
| Tipér | Vlastní systém — jméno + PIN → tabulka `tipsters` |
| Organizátor (admin) | Supabase Auth (email + heslo) → JWT → RLS zápis jen do vlastních turnajů/soutěží (`owner_id`) |
| Správce platformy | Supabase Auth + řádek v `platform_admins` → smí vše, ovládá `platform_settings` (vypínač tipovačky) |

### Routing
- **`/`** → `TournamentLanding` (pro diváky: vyhledávání, právě probíhá, soutěže, ukázky; přihlášení pořadatele → `/moje`)
- **`/moje`** → `OrganizerHome` (Můj prostor: Nový turnaj, Moje turnaje se Spravovat/Otevřít, Soutěže a ročníky, Knihovna klubů, Platforma); `CreateTournamentModal`, `PlatformModal` v `src/components/organizer/`; `/{id}?admin=1` otevře turnaj rovnou v administraci
- **`/{tournamentId}`** → konkrétní turnaj (UUID z `window.location.pathname`)
- `src/lib/TournamentContext.tsx` — `TournamentProvider` + `useTournamentId()` hook
- Reset hesla: `onAuthStateChange` event `PASSWORD_RECOVERY` → `PasswordResetOverlay`
- **Auth → "Allow new users to sign up" = VYPNUTO** — nové účty přes Supabase dashboard → Invite user

## RLS a DB záloha
Kompletní SQL (tabulky, RLS, triggery, storage, migrace) je v `db-backup/01–20_*.sql` (12 = indexy `tournament_id`, 15 = soukromé turnaje, 16 = odstranění cizích politik čtení, 17+18 = vypnutí anonymních zápisů tipovačky, 19 = soutěž dědí viditelnost z ročníků, 20 = `tournament.share_photo_url`). Pozor: živá DB obsahovala politiky s jinými názvy než v db-backup — nové migrace mažou podle role/příkazu (`pg_policies`), ne podle názvu. **Žádné další SELECT politiky na tabulkách turnaje nevytvářet** (ani v dashboardu) — sčítají se a obešly by soukromí.
- **Čtení**: SELECT pro všechny (anon) u veřejných turnajů; soukromé jen s kódem / vlastník (migrace 15).
- **Zápis (migrace 11)**: `can_edit_tournament(tournament_id)` = vlastník turnaje (`tournament.owner_id`) nebo správce platformy (`is_platform_admin()`); soutěže/kluby/osoby přes `can_edit_competition`. Storage: `can_edit_storage_path(name)` — nové soubory ukládat pod `tournaments/{turnajId}/…` (`src/lib/storage.ts`: `tournamentAssetPath`, `uploadAsset`, `removeAssetByUrl`).
- **Frontend**: `useAuthRole()` (`session`, `isPlatformAdmin`, `canEditTournament(ownerId)`); `App.tsx` `canEdit` řídí admin panel (cizí turnaj → „Bez oprávnění“). Výběr soutěže pro nový ročník jen z vlastních.
- **Tipovačka**: globální vypínač `platform_settings.tips_globally_enabled` (`usePlatformSettings()`, úvodní stránka → Platforma, jen správce); bez migrace = vypnuto. Zabezpečení tipovačky (PINy, anon zápisy) je **odloženo** — nezapínat ji globálně, dokud se nevyřeší.
- **Realtime (migrace 10)**: tabulky musí být v publikaci `supabase_realtime`, jinak DB neposílá události.
- **Hlavičky** (CSP, HSTS, X-Frame-Options…) jsou do přepnutí hostingu na **třech místech**: `vercel.json`, `public/_headers` (Cloudflare) a `SECURITY_HEADERS` v `edge/core.ts` (odpovědi Workeru) — měnit všechny tři, shodu hlídá test `edgeHeaders`. Nový externí zdroj (font, iframe, API) = doplnit do CSP.

## DB Schema — kritické detaily
- `matches.scheduled_time TEXT NOT NULL`, `matches.round TEXT NOT NULL` — při UPDATE posílat `''`, **ne `null`** → jinak 400
- `goals`: UNIQUE(player_id, match_id); `bracket_goals`: UNIQUE(slot_id, player_id) — **samostatná tabulka**, playoff sloty nejsou v `matches`
- `special_tips.predicted_team_id` nullable — pro `top_scorer` INSERT nutno `predicted_team_id: null`
- **Migrace 08** (`db-backup/08_partners_branding_media.sql`): `sponsors.tier`, `tournament.brand_primary/brand_secondary`, `press_enabled`, `press_contact_name/email/phone`, `press_note`. Frontend musí fungovat i bez ní (`tier ?? 'partner'`, `press_enabled ?? false`; uložení hlásí migraci přes `isMissingColumnError` z `src/lib/partners.ts`).
- `tournament` klíčové sloupce: `format ('groups'|'league')`, `format_id TEXT`, `league_has_playoff BOOL`, `num_pitches INT DEFAULT 2`, `tips_enabled BOOL`, `tips_lock_from TEXT`, `assists_enabled BOOL`, `cards_enabled BOOL`, `sponsors_enabled BOOL`, `logo_url TEXT`, `slug TEXT UNIQUE NOT NULL`, `sport TEXT NOT NULL DEFAULT 'football'` (`'football'|'hockey'`, needitovatelné po založení), `penalty_minutes_enabled BOOL`
- `matches`/`bracket_slots.decided_in`: nullable `'regulation'|'ot'|'so'` — skeleton pro budoucí prodloužení/nájezdy, u fotbalu se nepoužívá
- `sponsors`: `id, tournament_id, name, logo_url, website_url, position` — UNIQUE none; Storage `team-logos/sponsors/{id}.png`
- `special_tips`: UNIQUE(tipster_id, tip_type, **tournament_id**) — `tournament_id` NOT NULL (migrace v 05_migrations.sql)
- `announcements`: `type TEXT DEFAULT 'text'` (`'text'|'image'|'video'`), `media_url TEXT`
- `tips`/`bracket_tips`: UNIQUE(tipster_id, match_id) / UNIQUE(tipster_id, slot_id)

## Pravidla kódování

**Hooky:**
- Každá entita má hook v `src/hooks/`; všechny přijímají `tournamentId: string` jako 1. param — bez něj nefetchují (`if (!tournamentId) return`)
- Výjimky: `useTournament(tournamentId?)`, `useTips(tipsterId, tournamentId)`, `useBracketTips(tipsterId, tournamentId)`, `useSpecialTips(tipsterId, tournamentId)`
- Realtime přes `src/lib/realtimeManager.ts` (jeden sdílený kanál) — hooky volají `subscribeTable(table, handler, byTournament(tournamentId))`. **Vždy s filtrem** na turnaj (`tournament_id=eq.…`, u `tournament` `id=eq.…`, u tipů `tipster_id=eq.…`), jinak každá změna v jakémkoli turnaji vyvolá refetch u všech diváků. DELETE nejde filtrovat → manager má na tabulku jeden nefiltrovaný odběr DELETE. Kanál se přestaví jen při změně sady filtrů; po obnovení spojení se vše jednou refetchne.
- Polling přes `onPoll(handler, ms?, fixed?)` (`src/lib/poller.ts`): jeden časovač na interval (základ data 120 s, tipy 180 s), skrytá karta = žádné dotazy, návrat na kartu = obnova rozložená do 1,5 s. Interval se přizpůsobuje realtime (`isRealtimeHealthy` v `realtimeManager.ts`): připojený ×5 (10 min), výpadek ÷4 (min. 30 s); `fixed` = beze změny. Skrytá karta po 1 min uvolní realtime spojení (limit Free 200). **Nepoužívat vlastní `setInterval`/`visibilitychange` v hookách.**
- Přepnutí turnaje: efekt hooku na začátku vyprázdní stav (`setX([])`, `setLoading(true)`) a fetch má příznak `cancelled` (opožděná odpověď starého turnaje se zahodí). `App.tsx` ukazuje `TournamentSkeleton`, dokud `tournament.id !== tournamentId` nebo se načítají týmy/skupiny/zápasy.
- `refetch()` exponovat přes `useRef` pattern (viz useMatches, useBracket) — pro okamžitý UI update po save

**Bezpečnost a správnost:**
- **`dangerouslySetInnerHTML` — vždy sanitizovat** přes `sanitizeHtml(html)` z `src/lib/sanitize.ts` (DOMPurify wrapper)
- **`if (!error)` pattern** — hooky nesmí mazat state při selhání: `const { data, error } = await supabase...; if (!error) setState(data ?? [])`
- Nikdy `service_role` key ve frontendu; chyby → toast (ne `console.error`)
- Obrázky nahrávat jen přes `uploadAsset` (`src/lib/storage.ts`) — zmenší je a nastaví dlouhou cache. Nový `React.lazy` obalit `withReloadOnChunkError` (`src/lib/lazyComponent.tsx`), jinak po nasazení spadne.
- Audit provozu: `docs/AUDIT-2026-10.md` (limity tarifů, měření, P0/P1/P2).
- **Překryvy přes celou obrazovku** zapisovat do historie, jinak gesto/tlačítko Zpět (iPhone, Android) opustí turnaj: hook `useBackClose(open, onClose, key)` (`src/lib/useBackClose.ts`) — používají tabule, bulletin, sdílení, ukázky, nabídka „Více“, potvrzovací dialog; admin má `openAdmin`/`closeAdmin` v `App.tsx`, detaily `DetailHost`.
- **iOS zoom**: políčka i `contenteditable` mají na mobilu 16 px (index.css) a iOS dostává `maximum-scale=1` (`main.tsx`). Nové vstupy nesmí mít `font-size` s `!important` pod 16 px.

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
- **`played` flag**: skóre > 0 pole „Odehrán“ v editoru zaškrtne automaticky jen dokud na něj organizátor nesáhl; ukládá se přesně stav pole (živé zadávání = odškrtnout). Neodehraný zápas se skóre je v den turnaje **Živě** i po plánovaném konci (`getMatchState`).
- **Admin panel backdrop drag**: mousedown uvnitř → mouseup venku by zavřel panel; fix: `mouseDownOnBackdrop = useRef(false)` v `AdminPanel.tsx`
- **BracketTab SlotEditor.saveAll**: chyba gólů/asistencí/kartiček neblokuje `onSave()` — auto-advance proběhne i při částečném selhání
- **Race conditions**: `generateLeague()` a `seedPlayoff()` mají `if (loading) return` guard — nelze použít `disabled`, guard musí být uvnitř funkce
- **SettingsTab.resetData**: UPDATE musí cílit `.eq('id', tournament.id)` — nikdy `.neq()` (zasáhlo by všechny řádky)
- **Scoreboard `LeagueMatchesCol`**: auto-stránkování pokud slotů > `MAX_SLOTS_PER_PAGE` (12); `setInterval(5000)` cykluje stránky; indikátor `{page+1}/{totalPages}` v záhlaví
- **Header**: název turnaje — `webkit-line-clamp: 2` (ne ellipsis); meta text — `whiteSpace: nowrap` + ellipsis; `minHeight: 64` místo fixed height; title div má `minWidth: 130` (jinak ho nav vytlačí při mnoha záložkách); nav má `flex: '1 1 0', minWidth: 0, overflowX: auto` — scrolluje horizontálně pokud nestačí místo
- **`special_tips`**: UNIQUE je `(tipster_id, tip_type, tournament_id)` — `tournament_id` NOT NULL; INSERT musí vždy posílat `tournament_id`; `SpecialTipsSection` dostává `tournamentId` jako prop; `recalcPoints` nahrazeno `recalcTipsterPoints(tournamentId)` z `tipsEval.ts`
- **Scorers.tsx**: při `showAssists` zobrazovat `+0A` s `color: transparent` pro zarovnání sloupců
- **InfoTab save**: volat `refetchTournament()` — jinak změny viditelné až po 120s pollingu
- **Android zoom**: `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }`
- **RichTextEditor** (`src/components/ui/RichTextEditor.tsx`): TipTap + StarterKit; výstup HTML string; renderovat přes `dangerouslySetInnerHTML` s třídou `rich-content`
- **Čistý start (`resetTournamentData`)**: soft tables (bracket_*) — chyby ignorovány; hard tables (goals, tips, matches, groups) — chyba zastaví
- **`tournament.rules_content`**: sloupec existuje v DB ale je **nepoužívaný** — `Rules.tsx` zobrazuje `rule_items` tabulku (karty z admin záložky Pravidla), ne `rules_content`; pole není v InfoTab formuláři

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

### Registrované formáty (12)
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
| `mini_4teams` | SF+O3+Final pro 4 týmy (`formatMini4.ts`) | 1 |

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
Všechny togglované v Admin → Nastavení → Volitelné moduly; řídí `tournament.assists_enabled` / `tournament.cards_enabled` / `tournament.sponsors_enabled`.
- **Asistence**: hooky `useAssists`/`useBracketAssists`; ±stepper v editoru; Scorers — sloupec `G+A`, `+0A` s `color: transparent` pro zarovnání
- **Kartičky**: hooky `useCards`/`useBracketCards`; záznamy INSERT/DELETE (ne upsert); záložka Disciplína — viditelná jen pokud `cards_enabled`
- **Partneři (sponzoři)**: hook `useSponsors(tournamentId)`; úrovně `sponsors.tier` = `title|main|partner|supplier|media` (`src/lib/partners.ts`: `sortByTier`, `groupByTier`, `getTitlePartner`). **Generální partner = první s tier `title`** → „Presented by“ v hlavičce, hero Přehledu a na TV tabuli. Veřejná stránka `Sponsors.tsx` seskupená dle úrovní; admin `SponsorsTab.tsx` (úroveň, řazení ↑↓ jen v rámci úrovně, upload loga); Storage `team-logos/sponsors/{id}.png`, max 500 KB
  - Sidebar loga: `position: fixed` po stranách viewportu, **ne grid wrapper** — hlavní obsah se nesmí zúžit; loga 120×90px; seřazeno dle úrovně, sudý index → levý sidebar, lichý → pravý
  - CSS `.sponsor-sidebar { display: none }` → `display: flex` jen při ≥1500px; sidebary mají `left/right: 0`, `top: HEADER_HEIGHT_DESKTOP + 8`, `bottom: 0`, `overflowY: auto`
- **Branding turnaje**: `tournament.brand_primary/secondary` (hex) + `brand_style` (`subtle`/`bold`, migrace 14; bez ní jen Jemná); `applyTournamentTheme()` (`src/lib/theme.ts`) přepíše `--brand*`, `--brand-on-dark` (značka na tmavých plochách, kontrast ≥ 4,5:1), u Výrazné i `--chrome`/`--chrome-2` (tmavý odstín značky, bílý text ≥ 10:1) a `--brand-stripe` (doplňková barva); admin Nastavení → Vzhled turnaje (`BrandingSection.tsx`, živý náhled hlavičky, Přehledu a TV)
- **Média**: veřejná záložka `media` (`Media.tsx`, jen `press_enabled`) — kontakt, loga ke stažení, XLSX výsledkový servis (`src/lib/exportPress.ts`, xlsx načítán dynamicky), bulletin; admin Info → Média a tisk (`MediaSection.tsx`)
- **Sdílení = hotový obrázek**: `ShareModal` (kompaktní, náhled = výsledný PNG; mobil „Sdílet obrázek“ → systémová nabídka, počítač Stáhnout / Kopírovat obrázek / Kopírovat odkaz). Detail zápasu (i před zápasem), Přehled (`TournamentGraphic` s QR), tabulka, statistiky. **Styly grafik** `ShareStyle` = Tmavý / Barvy turnaje / Světlý / Foto (`PALETTES` v `share/templates.tsx`, výchozí `defaultShareStyle`: fotka turnaje → Foto, Výrazná → Barvy turnaje). **Foto**: výchozí fotka `tournament.share_photo_url` (migrace 20; admin Nastavení → Vzhled turnaje, Storage `tournaments/{id}/share/photo.jpg`) nebo vlastní fotka vybraná v okně sdílení — zůstává jen v zařízení jako **data URL** (ne `blob:` — html-to-image s `cacheBust` blob adresy rozbije). Obě cesty jdou přes `photoToJpeg()` (`src/lib/storage.ts`): vstup max 25 MB, výstup vždy JPEG ≤ 1920 px a < 1 MB (snižuje kvalitu), původní soubor se nikdy nenahraje; kompaktní lišta turnaje nahoře, obsah (výsledek) jako hlavní prvek, generální partner „presented by“ v patičce, ostatní partneři v jedné řadě (počet omezen, aby se nic neořízlo). TV tabule v odstínech barvy turnaje (`--tv-bg/--tv-col/--tv-panel` v index.css).
- **Sdílení odkazů**: `ShareButton` (jen detail týmu) (`src/components/share/`, logika `src/lib/share.ts`) — na mobilu systémová nabídka, na počítači nabídka sítí; doplňky (např. Grafika výsledku) přes `extras`. V detailech, které jsou uvnitř `tm-drawer`, obalit portálové dialogy `onClick={e => e.stopPropagation()}`.
- **Sdílecí grafiky**: `src/components/share/` (šablony 1080×1080 / 1080×1920, `html-to-image`, líně přes `share/lazy.tsx`); tlačítka Sdílet v Zápasech, Tabulce, Statistikách. Obrázky v šablonách musí mít `crossOrigin="anonymous"`.
- **Náhledy odkazů (OG)**: server nic nevykresluje (Cloudflare Free = 10 ms CPU). Obrázek 1200×630 vytváří prohlížeč organizátora: `OgImageSync` (`src/components/share/`, v `App.tsx` jen pro přihlášeného s `canEdit`) vykreslí `OgGraphic` (`share/templates.tsx`) a nahraje JPEG do Storage `tournaments/{id}/share/og.jpg`, když se změní podpis `ogSignature()` (`src/lib/og.ts`: název, podtitul, datum, místo, logo, sport, barvy, generální partner; uloženo v localStorage `turnajnik_og_{id}`). Změna šablony = zvýšit `OG_TEMPLATE_VERSION`. Soukromý turnaj náhled nemá (dřívější se smaže). `edge/core.ts` `ogResponse` vrací robotům na `/{uuid}` HTML s OG meta; obrázek ověří HEAD dotazem (`?v=` z ETagu), jinak `public/og-default.png`.
  - Kapacita bez scrollování: ~6–9 log na stranu (závisí na výšce monitoru)
- **Import CSV/Excel**: `src/components/admin/ImportTeamsModal.tsx`; balíček `xlsx`; tlačítko „Stáhnout vzorový soubor“ (list Soupisky + Návod; list Návod se při importu přeskočí, list se sloupcem Tým = varianta A)
- **Zápis o utkání** (dřív Excel karty rozhodčích): `src/components/admin/MatchSheets.tsx` — tisk/PDF, A4 → 2× A5 na šířku → přeložit na kapesní A6 (domácí | hosté), 15–22 řádků, výběr skupina/play-off/jen neodehrané; tlačítko v Admin → Zápasy
- **Ukládání výsledku**: jen změny a hromadně (`src/lib/eventDiff.ts`), vše paralelně; během ukládání `withBusy` + `BusyOverlay` (`src/lib/busy.ts`) blokuje kliknutí, zavření adminu i Zpět. Nové kritické zápisy dělat stejně.
- **Tlačítko vlevo nahoře v turnaji** = Zpět v rámci turnaje (`history.state.tdepth`, `headerBack` v `App.tsx`); na Přehledu bez historie ikona domu → všechny turnaje.
- **Fotky hráčů**: `players.avatar_url`; Storage `team-logos/players/{id}.png|.jpg`; max 200 KB, pouze PNG/JPG; zobrazují se v záložkách Týmy (32px kruh) i Statistiky (36px kruh vedle jména)
- **Tisknutelný bulletin**: `src/components/public/PrintBulletin.tsx`; `window.print()` po 400ms

## Architektura záložek (přehled)
**Veřejné** (pořadí = `buildPublicTabs()` v `Header.tsx`): overview (Přehled), results (Zápasy), standings (Tabulka), statistics, teams (+ detail týmu), bracket (Pavouk; skryt při `league && !league_has_playoff`), rules, tips (jen `tips_enabled`), sponsors (Partneři; jen `sponsors_enabled`), media (jen `press_enabled`). Mobil: `BottomNav` = Přehled/Zápasy/Tabulka/Pavouk (bez pavouka Statistiky) + „Více“. Dlaždice čísel na Přehledu jsou klikací (Týmy, Zápasy, Statistiky, nejlepší střelec).

**Admin pořadí**: Info → Oznámení → Pravidla → Týmy → Rozhodčí → Skupiny → Střelci → Zápasy → Play-off → Tipovačka → Partneři → Nastavení — v `ADMIN_NAV` (AdminPanel.tsx) seskupeno do bloků Obsah / Soutěž / Průběh turnaje / Komerce / Systém, levý sidebar (mobil: horizontální lišta)
Aktivní záložky (Zápasy, Play-off, Tipovačka) = zelené zvýraznění (`ACTION_TABS` v AdminPanel.tsx)

**Standings barevné kódování** (pruh vlevo + štítek, `zoneFor()` ve Standings.tsx): zelená `--win` = SF / postup, amber `--warn` = QF / útěcha. Forma posledních 5 zápasů (V/R/P).

## Loga (Supabase Storage, bucket "team-logos")
- Týmová loga: `{teamId}.png`, max 500 KB; cache-bust: `?v={timestamp}`; komponenta `TeamLogo`
- Logo turnaje: `tournaments/{tournamentId}/logo.png` (dříve sdílený `tournament-logo.png` — přepisoval logo všem turnajům, nepoužívat); 112px v hero Přehledu; po uploadu volat `refetchTournament()`
- Loga sponzorů: `sponsors/{sponsorId}.png`, max 500 KB; cesta v `sponsors.logo_url`
- **Storage RLS**: politiky pro upload musí být aplikovány v Supabase SQL Editoru — viz `db-backup/04_storage.sql`; bez nich vrací upload "new row violates row level security"

### TeamLogo sizes (referenční tabulka)
| Kontext | Size |
|---------|------|
| Přehled — výsledkové lišty / mini tabulka / střelci | 28 / 22 / 22px |
| Detail týmu (panel) | 64px |
| Záložka Týmy — logo týmu (karta) | 52px |
| Záložka Standings | 30px |
| Záložka Scorers / Discipline | 34px |
| Záložka Bracket (sloty) | 34px |
| Záložka Tips (zápasové řádky) | 30px |
| Záložka Results (MatchRow) | 30px |
| Záložka Statistics — PlayerInfo | 28px |
| Scoreboard — standings | 30px |
| Scoreboard — zápasy skupin/ligy | 28px |
| Scoreboard — play-off sloty | 28px |
| Scoreboard — flat bracket | 30px |
| Scoreboard — střelci | 26px |
| Kiosk — všechna loga | 28px |

## Nasazení (Vercel + Cloudflare souběžně)
Do koupě domény běží aplikace z `main` na **dvou hostinzích**: Vercel (ostrý web) a Cloudflare Worker se statickými soubory (`*.workers.dev`, test; postup v `docs/CLOUDFLARE.md`). Serverová logika je jen v `edge/core.ts` — `middleware.ts` (Vercel) i `edge/worker.ts` (Cloudflare, `wrangler.jsonc`) ji jen volají; nic serverového nepsat zvlášť pro jeden hosting. Nové serverové funkce psát rovnou pro Cloudflare (limit 10 ms CPU na požadavek, žádné vykreslování obrázků). Lokálně: `npm run cf:dev` (build + `wrangler dev`, proměnné přes `--var` nebo `.dev.vars`).
`VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` jsou baked při buildu — změna env vars v dashboardu vyžaduje redeploy (na Cloudflare je nastavit jako Build variables i jako proměnné Workeru — Worker je čte pro OG).

### Maintenance režim (Basic Auth)
`maintenanceResponse()` v `edge/core.ts` chrání aplikaci heslem (na obou hostinzích; na Cloudflare kromě `/assets/*`, které nejsou tajné).
- **Aktivace**: proměnná `MAINTENANCE = true` + Redeploy (Vercel) / uložení proměnné (Cloudflare)
- **Deaktivace**: `MAINTENANCE = false` + Redeploy (bez commitu); na Vercelu stačí proměnnou smazat, na Cloudflare chybějící proměnná = údržba zapnutá (fail closed, `edge/worker.ts`)
- Přihlašovací údaje: proměnné hostingu `MAINTENANCE_USER` + `MAINTENANCE_PASSWORD` (nikdy v kódu ani zde; na Cloudflare heslo jako Secret). Bez nich vrací při `MAINTENANCE=true` 503 (fail closed)
- Dále se obsluhují OG náhledy pro roboty (viz Volitelné moduly → Náhledy odkazů); maintenance kontrola musí zůstat první
- Proměnná `MAINTENANCE` je server-side (ne `VITE_` prefix) — čte ji middleware/Worker, ne frontend bundle

**Checklist "No API key" / kód 21000:**
- `package.json`: `"@supabase/supabase-js": "2.49.1"` (bez `^`)
- `src/lib/supabase.ts`: `global: { headers: { apikey: supabaseAnonKey } }`
- Commitnuto + pushnuto; Vercel env vars nastaveny; nový build PO nastavení env vars
