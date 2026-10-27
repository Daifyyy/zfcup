# Pracovní deník projektu

> Živý dokument: **kde jsme, v jaké fázi, co je hotové a co dál.**
> Aktualizovat na konci každého pracovního bloku. Nejnovější stav nahoře.

---

## Aktuální stav — 2026-10-27

**Plán dotažení (9 fází, schválen 2026-10-27):** `C:\Users\denis\.claude\plans\expressive-leaping-pnueli.md`
Fáze: 0 dokončit soutěže → 1 bezpečnost a role → 2 rychlé opravy (bulletin, přepínání turnajů, Přehled) → 3 datová vrstva → 4 detail týmu/zápasu → 5 knihovna klubů + historie → 6 design (TV, branding, oznámení) → 7 demo na úvodní stránce → 8 právní rámec. Tipovačka se jen globálně vypne (zabezpečení odloženo).

**Větev:** `main` — Fáze 0 a 1 hotové a nasazené (f94d7f0)
**Produkce (`main`, Vercel):** web je stále za maintenance heslem (`MAINTENANCE=true`)
**DB migrace:** 01–11 spuštěné (10 = realtime publikace; 11 = role a RLS podle vlastníka, platform_settings)
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

### Kde navázat
1. Fáze 2 — bulletin (portál + `#root` skrýt v tisku), přepínání turnajů (reset stavu hooků, zahazování opožděných odpovědí, načítací obrazovka), tabulka na Přehledu nad „Další zápasy“.
2. (dříve) Fáze 1 — bezpečnost a role. Pozn.: čísla migrací v plánu se posouvají o 1 (role = 11, indexy = 12, kluby = 13).

### Otevřené body / nápady
- Prázdný turnaj na Přehledu ukazuje jen hero — doplnit přívětivý prázdný stav („Turnaj se připravuje“).
- Turnaj se načítá ~5–8 s (mnoho hooků najednou) — zvážit sloučení dotazů / RPC.
- Loga turnajů: kvůli staré chybě (sdílený `tournament-logo.png`) je nutné nahrát logo znovu u každého turnaje.
- OG náhledy odkazů (`api/og.ts`, middleware) ověřit až po vypnutí maintenance (roboti dostávají 401).
- Zvážit ověření názvu „Turnajník“ v rejstříku ochranných známek (ÚPV/EUIPO) před prodejem.
- `docs/pitch.md` (necommitnutý) má zastaralé údaje (např. „8 formátů“) — aktualizovat pro prodej.
- Typová kontrola: baseline 63 starších chyb (`npm run typecheck`); nové změny nesmí přidat žádnou. Porovnávací skript: scratchpad `tscdiff.sh` (při novém sezení vygenerovat baseline znovu).

---

## Historie

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
