# Pracovní deník projektu

> Živý dokument: **kde jsme, v jaké fázi, co je hotové a co dál.**
> Aktualizovat na konci každého pracovního bloku. Nejnovější stav nahoře.

---

## Aktuální stav — 2026-10-27

**Plán dotažení (9 fází, schválen 2026-10-27):** `C:\Users\denis\.claude\plans\expressive-leaping-pnueli.md`
Fáze: 0 dokončit soutěže → 1 bezpečnost a role → 2 rychlé opravy (bulletin, přepínání turnajů, Přehled) → 3 datová vrstva → 4 detail týmu/zápasu → 5 knihovna klubů + historie → 6 design (TV, branding, oznámení) → 7 demo na úvodní stránce → 8 právní rámec. Tipovačka se jen globálně vypne (zabezpečení odloženo).

**Větev:** `main` — Fáze 0 a 1 hotové a nasazené (f94d7f0); Fáze 2 hotová a nasazená (9aaf0b2); Fáze 3 hotová a nasazená; Fáze 4 hotová a nasazená (dfe8a45); Fáze 5 nasazená (160c637); Fáze 6 nasazená (57898b6); Fáze 7 nasazená; **další: Fáze 8 (právní rámec)**, pak Fáze 9 (registrace + obchodní model — čeká na rozhodnutí)
**Produkce (`main`, Vercel):** web je stále za maintenance heslem (`MAINTENANCE=true`)
**DB migrace:** 01–14 spuštěné (14 = brand_style, spuštěná 2026-10-27); 01–12 spuštěné (12 = indexy tournament_id) (10 = realtime publikace; 11 = role a RLS podle vlastníka, platform_settings)
**Účty:** správce platformy `denis.honzejk@gmail.com` (vlastní všechny turnaje/soutěže); `zf@zf.com` už nepoužívat (běžný organizátor bez turnajů). Maintenance údaje jen v env Vercelu (`MAINTENANCE_USER`/`MAINTENANCE_PASSWORD`).

### Fáze 0 — výsledek E2E testu (2026-10-27)
- Ověřeno v UI proti DB: soutěž „QA soutěž“ (1. ročník = QA liga), 2. ročník „QA liga 2 (test)“ (`8892b38c-f314-41f6-b338-a793bfd8aef2`, hokej, sezóna) s převzetím 6 týmů, rozpis sezóny 10 kol × 3 zápasy (každý tým 5× doma), výsledky vč. PP/SN, tabulka 3-2-1-0, Zápasy po kolech, TV tabule = nejbližší kolo, `/s/qa-soutez` (síň vítězů, věčná tabulka — součty sedí, rekordy).
- Opraveno: sezóna se zakládala se skupinovým formátem (chyběl generátor sezóny) · nový ročník přebírá formát/časy/moduly/vzhled (`lastEdition`, `formatColumns`) · kolize párování týmů při převzetí · „Číslo ročníku“ prázdné = 1 · `competitions.owner_id` se zapisuje · kola řazena číselně (`compareRounds`) v admin Zápasech, veřejných Zápasech a Tipech.
- **Nalezeno — realtime nefunguje:** DB neposílá žádné `postgres_changes` (tabulky nejsou v publikaci `supabase_realtime`) → veřejný web se obnoví až pollingem po 120 s. Oprava = migrace 10.
- Do dalších fází: `confirm()` dialogy nahradit vlastními (blokují i automatizaci) · v sezónním režimu nenabízet skupinové formáty · Tabule u hokeje ukazuje sloupec R a nerozlišuje VP · stránka soutěže se načítá ~8 s · prázdný Přehled nového turnaje.
- Testovací data: „QA liga (test)“, „QA liga 2 (test)“, „QA soutěž“ (+ 6 clubs) — mazat jen se souhlasem uživatele.

### Fáze 1 — role a bezpečnost (2026-10-27)
- Ověřeno proti DB: `zf@zf.com` (bez vlastnictví) nezmění cizí turnaj (update/insert/delete/Storage/platform_settings odmítnuto); správce upravuje vše; vypínač tipovačky (úvodní stránka → Platforma) přepíná DB i UI, ponechán **vypnutý**.
- CSP a hlavičky ověřeny lokálně na produkčním buildu (úvodní stránka, turnaj s logy, sdílecí grafika — bez porušení CSP).
- Neověřeno: organizátor zakládá a spravuje **vlastní** turnaj (test přerušen odhlášením) · produkce po nasazení (adresa není v repu — ověří uživatel).

### Fáze 2 — rychlé opravy (2026-10-27, 9aaf0b2)
- **Bulletin** (`PrintBulletin.tsx`): portál do `<body>`, v tisku se skryje `#root` (dřív se tiskla prázdná stránka — `body > *` skrylo i bulletin uvnitř `#root`); auto-tisk jen jednou a jen když je co tisknout; prázdné skupiny vynechány, prázdný turnaj = hláška; hokej V/VP/PP/P bez R, PP/SN u skóre; sloupec Datum v sezónním režimu, řazení kol číselně; Esc zavře; opraveno „Skupina Skupina A“.
- **Přepínání turnajů**: 18 hooků při změně `tournamentId` hned vyprázdní stav a zahodí opožděné odpovědi (`cancelled`); `useTournament` resetuje na `null` a vrací `notFound` (PGRST116 / neplatné UUID → „Turnaj nenalezen“). `App.tsx`: načítací obrazovka `TournamentSkeleton` (dokud `tournament.id !== tournamentId` nebo se načítají týmy/skupiny/zápasy), jeden `popstate` handler (turnaj+soutěž z URL, záložka ze state), `openTournament()` začíná na Přehledu, při přepnutí se zavře admin/bulletin/tabule.
- **Přehled**: mini tabulka v hlavním sloupci hned pod KPI (po „Právě se hraje“), nad „Další zápasy“; pravý sloupec jen když jsou střelci.
- Ověřeno v prohlížeči (dev): přepnutí A→B bez míchání dat (starý → skeleton → nový), Zpět/Vpřed, úvodní stránka ↔ turnaj, neplatný odkaz, bulletin hokej/sezóna i fotbal/skupiny+play-off, simulace tiskového CSS. Typová kontrola 63 = baseline, build OK.
- Uživatel ověřil na produkci: tisk bulletinu do PDF a Přehled na mobilu — OK.

### Fáze 3 — datová vrstva, cílená verze (2026-10-27)
- **Měření (produkční build, před změnami):** studené otevření turnaje ~2,7–3,4 s, teplé otevření/reload **0,2 s**, přepnutí turnaje 0,13 s; 19 dotazů na turnaj. Pomalost = studený start Supabase free tieru + navázání spojení, ne dotazy → uživatel zvolil cílenou verzi bez TanStack Query.
- **Realtime filtr** (`realtimeManager.ts`): odběry `tournament_id=eq.{id}` (tournament `id=eq.`, tipy `tipster_id=eq.`, stránka soutěže `competition_id`/`tournament_id=in.(ročníky)` + 3s sloučení). Dřív každá změna v jakémkoli turnaji vyvolala refetch u všech diváků všech turnajů. DELETE nejde filtrovat → nefiltrovaný DELETE na tabulku. Kanál se přestaví jen při změně filtrů; po výpadku spojení jednorázový refetch. `useReferees` dostal realtime (dřív chyběl).
- **Společný polling** (`poller.ts`): 1 časovač na interval místo ~22 `setInterval` + 22 posluchačů viditelnosti; návrat na kartu = refetch rozložený do 1,5 s. Naměřeno: 0 dotazů za 20 s v klidu.
- **Migrace 12** `db-backup/12_tournament_indexes.sql`: index `tournament_id` na 22 tabulkách + chybějící FK indexy (asistence, karty, rozhodčí) + složené pro tipy. Spuštěná uživatelem 2026-10-27 (dnes neměřitelný přínos, příprava na víc turnajů).
- **Fonty lokálně** (`@fontsource`, `src/fonts.ts`): bez Google Fonts (GDPR + o jedno spojení méně), CSP bez Google domén. Ověřeno na produkčním buildu s hlavičkami z `vercel.json`: fonty z vlastní domény, 0 externích požadavků, sdílecí grafika OK, žádné porušení CSP.
- **Testy (Vitest, `npm test`)**: 74 testů — tabulky (fotbal, hokej 3-2-1-0, H2H, tiebreakery), rozpisy (liga 3–10 týmů, 1–4 hřiště, přestávka; sezóna 2–16 týmů, 1×/2×, doma/venku), stav zápasu, historie soutěže, polling, **integrační test všech 12 formátů play-off** (struktura → nasazení → odehrání → vítěz).
- **Nalezená a opravená chyba:** `groups_qf_full` (Skupiny + QF + Umístění) ve výchozím nastavení 4 skupiny × 2 nasadil do QF jen skupiny A a B, každý tým 2×, skupiny C a D vůbec. **Cup 2026 tento formát používá** — zatím nemá skupiny ani play-off, takže bez škody.
- Vynecháno záměrně: zúžení `select('*')` (úvodní stránka potřebuje celé řádky pro převzetí nastavení do nového ročníku, úspora pár kB) · lazy loading obrázků (riziko chybějících log ve sdílecích grafikách) · TanStack Query (viz Otevřené body).
- **Realtime ověřen naostro** (přihlášený správce, divák v druhé kartě, QA liga 2): změna zápasu v cizím turnaji → divák nestáhl nic; ve vlastním → refetch zápasů za 0,4 s; nové oznámení → zobrazeno za 2 s; smazání → zmizelo za 0,8 s (nefiltrovaný DELETE funguje). Testovací oznámení smazáno.
- Pozor při měření v dev režimu: buffer `performance` má 250 položek a Vite ho zaplní moduly → nové požadavky se nezapisují. Před měřením `performance.setResourceTimingBufferSize(10000); performance.clearResourceTimings()`.

### Fáze 4 — detail týmu a zápasu (2026-10-27)
- **Rozhodnutí uživatele:** data přes sdílený kontext (ne TanStack Query) · detail zápasu sdílitelný odkazem `?zapas={id}` (doplněno i `?tym={id}`).
- `TournamentDataContext` + `DetailHost`: detail se otevře odkudkoli, Zpět ho zavře (vnořené detaily se vrací po jednom), křížek/Esc zavře vše; odkaz z URL otevře turnaj rovnou s detailem.
- `TeamDetailDrawer` (vyjmut z `Teams.tsx`): bilance a zápasy **včetně play-off** (dřív jen skupiny), u hokeje bez remíz (i na kartě týmu), zápasy klikací → detail zápasu, neplatný odkaz = „Tým nenalezen“.
- `MatchDetailDrawer` (nový): skóre + PP/SN, kolo/skupina, datum, výkop, hřiště (jen jednodenní liga se souběžnými zápasy — stejně jako Zápasy), rozhodčí, střelci/asistence/karty/trestné minuty po týmech (jen zapnuté moduly), kopírování odkazu, „Střelci nebyli zadáni“, záznamy hráčů mimo soupisku.
- Otevírání: Zápasy, Přehled (živé/další/poslední + mini tabulka), Tabulka (tým), Pavouk (slot s aspoň jedním týmem), Týmy, detaily navzájem. `MatchRow` s `onClick` je přístupný z klávesnice. TV/kiosk záměrně bez detailů (pasivní obrazovka).
- Přehled: prázdný stav „Turnaj se připravuje“ (počet týmů + klikací týmy).
- Ověřeno: typová kontrola 63 = baseline, 85 testů (11 nových v `details.test.ts`), produkční build (+15 kB, +4 kB gzip).
- **Ověřeno v prohlížeči (dev):** hokej/sezóna (QA liga 2) i fotbal se skupinami a play-off (Testovací Turnaj, QA liga): detail z Přehledu, Zápasů, Tabulky, Pavouka (prázdné sloty neklikací), Týmů, prázdného stavu; vnořený detail tým → zápas, Zpět vrací po jednom, Vpřed znovu otevře, křížek a Esc zavřou vše, přímý odkaz `?zapas=` (hloubka 0) i neplatný `?tym=`; Sdílet v Zápasech neotevře detail; mobil 360/375/390 px (rámce) a desktop, dlouhé názvy týmů se zalamují (max. 3 řádky). Prázdný stav „Turnaj se připravuje“ na Cupu 2026.
- Úpravy po ověření: prázdný průběh = jen hláška · u jednodenního turnaje datum turnaje · u odehraného zápasu bez času nic místo „Termín upřesníme“ · „1 hráč / 2 hráči / 5 hráčů“.
- Neověřeno: tlačítko Zpět na fyzickém Androidu, kopírování odkazu do schránky (na http bez schránky se ukáže pole s odkazem).

### Fáze 5 — knihovna klubů (2026-10-27)
- **Migrace 13** `db-backup/13_clubs_library.sql` (**spuštěná uživatelem 2026-10-27**; 6 klubů QA soutěže dostalo slug a vlastníka): `clubs`/`persons` + `owner_id` (doplněno z vlastníka soutěže), `clubs.slug` (doplněn, unikátní), `persons.club_id/number/role` (doplněno z posledního ročníku), `competition_id` nepovinné, RLS `can_edit_library`, Storage `clubs/{id}/…`, realtime.
- `src/lib/clubs.ts` (knihovna), `ensureIdentities` páruje v knihovně vlastníka turnaje, párování v soutěži nabízí i kluby organizátora, `savePairing` bez N+1.
- UI: úvodní stránka → „Moje kluby“ (založit, upravit název/barvu/logo, soupiska, sloučit duplicity, smazat — potvrzení dvojklikem, ne `confirm()`); Admin → Týmy → „Přidat z knihovny“ (tým + soupiska jedním klikem) a „Uložit do knihovny“ u týmu; veřejná stránka klubu `/k/{slug}` (turnaje a umístění, vzájemné zápasy, nejlepší hráči, soupiska); odkazy z detailu týmu a věčné tabulky.
- Sezónní režim nabízí jen ligové formáty (`formatsForScheduleMode`).
- Ověřeno: 91 testů (+6 `clubHistory`, +1 formáty), typová kontrola 63, build; v prohlížeči bez migrace — knihovna hlásí migraci, `/k/…` „není aktivní“, zbytek beze změny.
- Navigace mezi ročníky v hlavičce turnaje (‹ ›), `useCompetitionEditions` bez prázdného realtime odběru.
- **Ověřeno v prohlížeči po migraci** (na dočasném „QA Klub (test)“, po testu smazán i s týmem v Testovacím turnaji): založení klubu, soupiska (číslo, role), sloučení duplicity (jmenovec spojen, druhý hráč přesunut), Admin → Týmy → Přidat z knihovny (tým + 3 hráči s person_id), Aktualizovat soupisku v knihovně (nový hráč, 4/4 propojeno), odkaz Profil klubu z detailu týmu i z věčné tabulky, `/k/hc-medvedi` (umístění, vzájemné zápasy — součty sedí), proklik na turnaj a Zpět, mobil 375 px, šipky ročníků.
- **RLS ověřeno** jako nepřihlášený: úprava/smazání klubu a osob = 0 řádků, založení klubu odmítnuto, čtení veřejné. Neověřeno: druhý přihlášený organizátor (nemáme testovací účet s heslem) — stejný mechanismus `owner_id = auth.uid()` jako u turnajů (ověřeno ve Fázi 1).

### Fáze 6 — design: TV, branding, oznámení (2026-10-27)
- **Potvrzovací dialogy**: 23× `confirm()` → `confirmDialog()` (vlastní dialog, Esc/klik mimo = zrušit, nezavře admin pod sebou); zdvojená potvrzení „Čistý start“ / „Smazat vše“ sloučena do jednoho jasného dialogu.
- **Oznámení**: 44 ikon lucide místo emoji (klíč v `icon`, stará emoji se převádějí), ikona i ve veřejné kartě, nahrání obrázku do Storage (PNG/JPG/WebP, max 2 MB, při smazání se uklidí), segmentový přepínač typu; v adminu ✓ ✕ ✎ ↑ ↓ ⊕ nahrazeny ikonami (Týmy, Pravidla, Import, Tipovačka, Zápasy, Play-off, Skupiny).
- **TV**: sdílené `src/components/tv/` (paleta, velikosti, `TvGroupTable`, `FitBox`). Opraveno: Tabule u hokeje ukazovala remízy a nerozlišovala VP/PP · natvrdo „1–2 SF / 3–6 QF“ u všech lig (teď podle formátu) · „HŘIŠTĚ“ v TV režimu i u hokeje · „TBD“ → „Určí se“ · akcent natvrdo modrý → barva značky · 4K mělo poloviční písmo (strop velikostí) · 4 skupiny na Full HD Tabuli useknuté (teď se písmo přizpůsobí, žádný řádek nechybí).
- **Pásma postupu** `src/lib/zones.ts` (web + TV). Nalezena chyba: liga bez play-off psala „Vítěz skupiny postupuje do play-off“ → „1. místo = vítěz ligy“.
- **Branding**: `--brand-on-dark` (akcenty na tmavých plochách), intenzita Jemná / Výrazná (`brand_style`, **migrace 14 — nespuštěná**, bez ní se uloží jen barvy), živý náhled hlavičky, Přehledu a TV v adminu.
- **Audit zobrazení** na dočasném zátěžovém turnaji (16 týmů s dlouhými názvy, 112 hráčů, 4 skupiny, play-off, 10 partnerů; po auditu smazán): web 360 / 768 / 1366 / 1920 px — opraveno přetékání mini tabulky, výběru týmu v Zápasech, zalamování jmen ve Statistikách, záhlaví sekcí na mobilu, název turnaje v úvodu (mobil max. 4 řádky). Tabule a TV 1920×1080 i 3840×2160 — bez useknutí.
- Ověřeno: typy 63, 99 testů, build (+30 kB / +8 kB gzip — ikony oznámení).
- Zbývá do budoucna: Tabule se 4+ skupinami na Full HD je hustá (písmo ~72 %) — zvážit širší sloupec tabulek nebo střídání skupin.

### Fáze 7 — demo na úvodní stránce (2026-10-27)
- Dlaždice funkcí (`src/demo/features.ts`) jsou tlačítka „Ukázka“ → `DemoModal` (líně) se skutečnými komponentami nad ukázkovým turnajem `buildDemoData()` (8 týmů, 2 skupiny, semifinále, o 3. místo, finále živě; střelci, asistence, karty, partneři s SVG logy). Žádné dotazy do DB.
- Ukázky: Živé výsledky (živé finále, výsledky, tabulka; klik → detail zápasu/týmu uvnitř ukázky, URL se nemění) · TV tabule (skutečná `Scoreboard` zmenšená) · Partneři (Presented by, stránka partnerů, lišta) · Grafiky (výsledek + tabulka) · Formáty (pavouk + 12 formátů) · Mediální servis · Mobil (detail zápasu v rámečku telefonu) · Tipovačka jen při globálně zapnuté tipovačce. Navigace Předchozí/Další, šipky, Esc.
- `--tv-vw` v TV velikostech (ostrá TV beze změny, v ukázce 1 % virtuální 1920px plochy). Opraveno „Jedenáct formátů“ → „Dvanáct“.
- Ověřeno v prohlížeči: desktop i mobil 390 px (bez přetečení), typy 63, 99 testů, build (DemoModal 5 kB gzip).
- Tlačítko „Chci turnaj“ v ukázkách → `mailto:` na `BRAND.supportEmail` (vyplněno, e-mail správce platformy). Do budoucna zvážit kontaktní formulář (spam, GDPR — Fáze 8).

### Kde navázat
1. **Příště začít:** Fáze 8 — právní rámec (GDPR, podmínky, cookies) — nutné před vypnutím maintenance režimu. Na začátku si od uživatele vyžádat identitu provozovatele (jméno/firma, IČO, adresa, e-mail).
2. **Fáze 9 (nová, 2026-10-27):** registrace organizátorů a obchodní model — uživatel ještě nerozhodl (předplatné vs. cena za turnaj…). Detaily v plánu.
2. Před nasazením play-off v Cupu 2026 ověřit, že je nasazená oprava `groups_qf_full`.
3. Pozn.: čísla migrací v plánu jsou posunutá o 1 (indexy = 12, kluby = 13).

### Otevřené body / nápady
- **TanStack Query — potenciál do budoucna** (rozhodnutí uživatele 2026-10-27): dnes malý přínos (teplé načtení 0,2 s). Hodí se, až bude víc obrazovek sdílet stejná data (detail týmu/zápasu ve Fázi 4, knihovna klubů) — cache, deduplikace, okamžitý návrat na otevřený turnaj, jedno místo pro polling. Převádět hooky po jednom se zachováním API (`data`, `loading`, `refetch`); `poller.ts` a `realtimeManager.ts` pak jen invalidují dotazy.
- Studené otevření ~2–3 s (Supabase free tier se uspává, 19 dotazů) — zvážit placený tier nebo sloučení dotazů do jednoho RPC.
- Loga turnajů: kvůli staré chybě (sdílený `tournament-logo.png`) je nutné nahrát logo znovu u každého turnaje.
- OG náhledy odkazů (`api/og.ts`, middleware) ověřit až po vypnutí maintenance (roboti dostávají 401).
- Zvážit ověření názvu „Turnajník“ v rejstříku ochranných známek (ÚPV/EUIPO) před prodejem.
- `docs/pitch.md` (necommitnutý) má zastaralé údaje (např. „8 formátů“) — aktualizovat pro prodej.
- Typová kontrola: baseline 63 starších chyb (`npm run typecheck`); nové změny nesmí přidat žádnou (testy v `src/lib/__tests__` se kontrolují také).
- Ověření CSP lokálně: `vite preview` hlavičky z `vercel.json` neaplikuje — použít malý statický server, který je čte (bez HSTS, `upgrade-insecure-requests` a `Cache-Control`, jinak se na http://localhost rozbije načítání).

---

## Historie

### 2026-10-27 — Fáze 4, 5, 6 (večer)
- Fáze 4 (dfe8a45): detail týmu a zápasu, sdílený kontext, odkazy `?zapas=` / `?tym=`, prázdný stav Přehledu.
- Fáze 5 (160c637): knihovna klubů organizátora (migrace 13 spuštěná), stránka klubu `/k/{slug}`, navigace mezi ročníky.
- Fáze 6 (57898b6): vlastní potvrzovací dialogy, ikony oznámení, sdílené TV komponenty (Full HD i 4K, přizpůsobení písma), branding Jemná/Výrazná (migrace 14 napsaná), audit zobrazení na zátěžovém turnaji.
- Uživatel si přeje: v Chromu a v PC pracovat jen se záložkami aplikace (uloženo v paměti).

### 2026-10-27 — Fáze 2 a 3 (konec dne)
- Fáze 2 (9aaf0b2) a Fáze 3 cílená (80dfef6) nasazené; migrace 12 spuštěná; realtime filtr ověřen naostro; 74 testů; opravena chyba `groups_qf_full`.
- Sepsána mapa aplikace `docs/ARCHITECTURE.md`, aktualizován plán fází (stav, odchylky, číslování migrací, nálezy přesunuté do Fází 4–6).

### 2026-10-27 — Plán dotažení + Fáze 0 (E2E soutěží a sezón)
- Schválen plán 9 fází. E2E test soutěží/sezón proti DB prošel po opravách (viz Aktuální stav); nalezen nefunkční realtime (migrace 10).

### 2026-10-26 — Soutěže, sezóny, opravy formátů (větev `feature/competitions`)
- **Hotfix (na `main`)** `ac83632`: výběr ligového formátu padal na chybějícím `playoff_style`.
- **Hotfix (na `main`)** `ba4f462`: `calcGroupStandings` má povinný `sportDef` (hokej se dřív počítal fotbalově při nasazení play-off a v tipovačce), H2H s body poraženého, tabulka V/VP/PP/P, kola o umístění pod pavoukem, rychlé zadávání týmů, ligový rozpis vyžaduje čas.
- `e32d14d` vlastní vizuální motiv „diagonální řez“ (odlišení od Livesportu).
- `96cc25c` soutěže s ročníky: migrace 09, `lib/history.ts`, `lib/editions.ts`, stránka `/s/{slug}`, admin Soutěž a ročník.
- `51aa691` sezónní režim: `generateSeasonSchedule`, datum zápasu v editorech/zobrazení/tipech/TV/exportech, volba při založení turnaje.
- Ověřeno: E2E liga + play-off (hokej) přes UI; testy historie na reálných datech; generátor sezóny 2–16 týmů. **Neověřeno v UI: soutěže a sezóna proti DB (migrace 09 hotová až večer).**

### 2026-10-26 — Broadcast redesign (na `main`, nasazeno)
- Fáze 0–7: design systém (tokeny, Barlow Condensed + Inter, lucide), veřejný web, TV tabule/kiosk, úrovně partnerů, branding turnaje, sdílecí grafiky + OG, Média, admin panel, úvodní stránka, líné načítání (bundle 1,5 MB → 0,46 MB).
- Migrace 08 (partneři, branding, média) spuštěna a otestována.

### 2026-10-26 — Obnova projektu
- Supabase projekt byl uspaný (free tier) → obnoven uživatelem; data zachována.
