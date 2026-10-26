# Pracovní deník projektu

> Živý dokument: **kde jsme, v jaké fázi, co je hotové a co dál.**
> Aktualizovat na konci každého pracovního bloku. Nejnovější stav nahoře.

---

## Aktuální stav — 2026-10-26 (konec dne)

**Větev v práci:** `feature/competitions` (3 commity navíc oproti `main`, NEsloučeno)
**Produkce (`main`, Vercel):** redesign + hotfixy nasazeny; web je stále za maintenance heslem (`MAINTENANCE=true`)
**DB migrace:** 01–09 spuštěné v Supabase (09 ověřena přes REST 2026-10-26)

### Kde přesně navázat zítra
1. Lokálně: `npm run dev` (port 5173), přihlásit se v Chromu do adminu (heslo zadává uživatel sám).
2. **E2E test soutěží (fáze C3/C4)** na testovacích datech:
   - Turnaj „QA liga (test)“ (`5532fe3c-6f5c-49d7-8a88-c8d420f05f2f`, hokej, liga + play-off, vše odehráno, vítěz HC Medvedi) → Admin → Nastavení → Soutěž a ročník → *Nová soutěž* „QA soutěž“, 1. ročník.
   - Úvodní stránka → Nový turnaj → Hokej, Sezóna, *Další ročník: QA soutěž*, převzít týmy → ověřit, že se zkopírovalo 6 týmů (soupisky jsou prázdné — případně přidat hráče).
   - V 2. ročníku vygenerovat **rozpis sezóny** (Skupiny: datum 1. kola, 7 dní, dvoukolově) → ověřit 10 kol × 3 zápasy, data, Zápasy po kolech, editor s datem, TV tabule = aktuální kolo.
   - Zadat pár výsledků → `/s/qa-soutez`: síň vítězů, věčná tabulka (ruční přepočet), rekordy, hráči + profil, odkaz z hlavičky ročníku.
   - Ověřit tipovačku v sezóně (zámek podle data).
3. Po úspěšném testu: `git checkout main && git merge --ff-only feature/competitions && git push`.
4. **Úklid testovacích dat — jen se souhlasem uživatele:** „QA liga (test)“, druhý QA ročník, „QA soutěž“ (+ clubs/persons). Uživatel zatím nesouhlasil se smazáním.

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
