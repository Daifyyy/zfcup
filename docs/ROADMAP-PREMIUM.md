# Roadmapa prémiového produktu (prověrka 2026-10-30)

## Kontext
Cíl: prodávat aplikaci **celou, bez osekaných tarifů, za vyšší cenu** firmám, komerčním pořadatelům, ligám/svazům i obcím/školám/charitě. Provoz **podle balíčku**: samoobsluha, nebo obsluha na místě za příplatek. „Prodávají oči“, takže vzhled a grafiky pro sítě jsou klíčové. Sporty zůstávají fotbal + hokej.
Prověrka: kód + snímky validačního turnaje (Přehled, TV tabule, Zápasy, sdílecí grafika) + stručně konkurence.

## 1. Co kvalitu potvrzuje (prodejní argumenty – už máme)
- **Vzhled jako v televizi**: tmavé lišty, Barlow Condensed, vlastní barvy turnaje (Jemná/Výrazná), hero Přehledu s „Presented by“ a QR. Na snímcích působí profesionálně.
- **TV tabule + TV režim**: Full HD i 4K, písmo se samo přizpůsobí, běžící pás partnerů, QR „Sledujte živě“, hodiny.
- **Partneři v 5 úrovních**: generální partner v hlavičce, na TV a v grafikách; postranní loga na velkých monitorech.
- **Hotové grafiky na sítě** (1:1 a 9:16): výsledek/pozvánka na zápas, tabulka, statistiky, grafika turnaje s QR. Na mobilu se sdílí rovnou do Instagramu/WhatsAppu.
- **12 formátů** (skupiny, liga, play-off, umístění), sezónní režim, historie soutěže napříč ročníky, knihovna klubů.
- **Živé výsledky** (realtime + záložní obnovování), detail týmu a zápasu, statistiky, disciplína (karty / trestné minuty), prodloužení a nájezdy u hokeje.
- **Organizace**: import týmů z Excelu, zápis o utkání k tisku (A6), bulletin, mediální servis (XLSX, loga ke stažení), soukromé turnaje s kódem.
- **Právní rámec a GDPR** (fonty bez Googlu, YouTube nocookie, CSP), čeština.

## 2. Nálezy ze snímků
- **Grafika výsledku má špatnou hierarchii**: název turnaje zabírá 3 řádky nahoře a výsledek (to hlavní) je relativně malý. Partneři se zalamují do 2 řádků. Pozadí je vždy stejné tmavě modré, ne v barvách turnaje. Bez fotky. Funkční, ale „šablonovité“. **Největší rychlá výhra.**
- Zápasy: dlouhý název týmu hostů se schová pod štítek KONEC (drobnost).
- TV tabule: kvalitní; skupinové tabulky jsou na menším okně drobné, na 16:9 TV v pořádku.
- **Na TV se nic „neděje“**: žádná animace gólu, oznámení se na TV nezobrazují (`KioskMode` je v props má, ale nepoužívá), partneři jen v liště.

## 3. Konkurence (stručně)
- **Tournify** (NL, nejbližší): zdarma do 8 týmů, **40 € / 120 € za akci** (~1 000 / 3 000 Kč). Má online registrace, aplikaci pro rozhodčí, mobilní aplikaci, slideshow na TV, partnery v úrovních. Grafiky na sítě jsem u nich nenašel.
- **LeagueRepublic / Challonge**: ligy a pavouky, zdarma s reklamou, placené = vlastní doména a značka. Vzhledem slabší.
- **AHL.cz** (hlavní česká konkurence pro ligy, jen hokej): od 2002, **200+ soutěží**, 20 000+ zápasů. **1 000 Kč/rok za soutěž, ale jako dobrovolný příspěvek** – platí se až po pravidelném používání, faktura na požádání; „partner AHL“ = lepší zobrazení na úvodu a přednostní podpora. Funkce: rozpis, výsledky, tabulky, novinky, **statistiky hráčů, brankářů a týmů včetně historických a dlouhodobých rekordů**, **trofeje pro hráče a týmy**, **online zápis zápasu na tabletu/PC s živou aktualizací**, živé sledování a **video přenosy**, **databáze hráčů s jedním profilem napříč soutěžemi** a správa oprávnění, **čeština i angličtina**, formáty dlouhodobá část, play-off, kvalifikace, play-out, útěcha, malý pohár. Grafiky na sítě, TV ani branding stránka neuvádí; vzhled je starší.
  → AHL je silný v **hokejových ligách** (statistiky, zápis, komunita), ale prakticky zdarma. Do jeho segmentu nejít cenou; jít tam, kde AHL nic nenabízí: **jednorázové a firemní akce, vzhled, TV, grafiky, partneři, fotbal**.
- **Ostatní Česko**: trh je roztříštěný – svazové systémy (FAČR, florbal) jen pro registrované soutěže, ligy malé kopané s vlastními weby, HuráLiga (tenis/badminton/stolní tenis), Turnaje.org (aplikace pro registraci a výsledky, jiné sporty), jinak hlavně studentské práce. **Hotový český produkt zaměřený na „broadcast“ turnaje jsem nenašel** – to je naše mezera na trhu.
- **Závěr:** v **„broadcastu“** (TV, grafiky, partneři) jsme nad konkurencí. V **organizaci** (registrace, platby, zápis z hřiště) jsme pod Tournify. Prémiovou cenu (nad 3 000 Kč za akci) obhájí jen obojí.

## 4. Roadmapa nadstandardu (seřazeno podle přínosu pro prodej)
Velikost: S ≈ do 1 sezení, M ≈ 1–2 sezení, L ≈ více sezení / vyžaduje návrh.

### Vlna 1 – „Oči“: grafiky na sítě (nejvyšší priorita)
1. ✅ *(2026-10-30: kompaktní lišta, výsledek jako hrdina, styly Tmavý / Barvy turnaje / Světlý, presented by; styl Foto = bod 2)* **Redesign šablon** (`src/components/share/templates.tsx`, `Frame`): výsledek jako hrdina (velké skóre a loga), název turnaje malý v liště, pozadí v barvě turnaje (`--brand`, Výrazná varianta), generální partner jako „presented by“ místo zalamovaného pásu, ostatní partneři max. 1 řádek. **2–3 vizuální styly** na výběr (např. Broadcast / Minimal / Foto). – M
2. ✅ *(2026-10-30: styl Foto — výchozí fotka v Nastavení → Vzhled turnaje (migrace 20) nebo vlastní fotka v okně sdílení, jen v zařízení)* **Fotka jako pozadí** (z akce, nahraná organizátorem přes `uploadAsset`, Storage `tournaments/{id}/…`), s tmavým přechodem pro čitelnost. – M
3. ✅ *(2026-10-30: program a výsledky dne, vítěz, konečné pořadí, hráč zápasu, tým turnaje/kola — automaticky s ručními úpravami; migrace 22)* **Nové šablony**: program hracího dne / pozvánka, **hráč zápasu (MVP)**, nejlepší sestava / tým turnaje, gratulace vítězi, konečné pořadí, souhrn dne (výsledky dne v jedné grafice). MVP vyžaduje nový sloupec (`matches.mvp_player_id`, `bracket_slots.mvp_player_id`) → migrace 22 + volba v editoru zápasu. – M/L
4. **Balíček grafik**: „Stáhnout vše za dnešek“ (ZIP grafik dne pro správce sociálních sítí). – S
5. **Video / animace (Reels/Stories)**: animovaný výsledek 5–8 s (příjezd log, odpočet skóre, partner na konci). Technicky: vykreslení snímků na `canvas` v prohlížeči + `MediaRecorder` (WebM) / WebCodecs (MP4), bez serveru. Nejdřív prototyp na 1 šabloně a ověření, že Instagram/WhatsApp formát přijmou. – L

### Vlna 2 – Zážitek na místě a pro partnery
6. ✅ *(2026-10-30, modul `goal_animation`)* **Animace gólu na TV**: „GÓL!“ + střelec + logo týmu přes celou obrazovku na 4–5 s při změně skóre (realtime už je); volitelně „gól powered by [partner]“ = **prodejné partnerovi**. – M
7. ✅ *(2026-10-30, modul `tv_spots`; počet zobrazení podle úrovně 3/2/1)* **Reklamní spoty partnerů v TV režimu**: celoobrazovkové logo/obrázek partnera v rotaci `KioskMode` (vedle Zápasy/Tabulka/Pavouk), počet zobrazení podle úrovně. + **oznámení na TV**. – S/M
8. **Grafika pro živý přenos (OBS/YouTube)**: stránka `/overlay` s průhledným pozadím: skóre zápasu na hřišti X, tabulka do spodní třetiny, partner. Znovu použije `src/components/tv/`. – M
9. **Report pro partnery po akci** (PDF): počet diváků webu a TV, kolikrát byla grafika sdílena, kde se logo objevilo. Vyžaduje jednoduché počítání návštěv bez cookies (RPC čítač v DB) → doplnit do stránky Cookies/GDPR. – M

### Vlna 3 – Organizace (dorovnání Tournify, nutné pro samoobsluhu)
10. **Online přihlášky týmů**: veřejný formulář (tým, kontakt, soupiska, souhlasy GDPR), organizátor schvaluje → vznikne tým a hráči. Bezpečně: zápis přes RPC s limitem, ne anon INSERT do `teams`. – L
11. **Startovné**: první krok bez platební brány – **QR platba (SPD) + variabilní symbol** v potvrzení přihlášky, organizátor označí „zaplaceno“. Brána (Stripe/GoPay) až později. – M
12. **Zápis z hřiště**: odkaz pro zapisovatele u konkrétního hřiště (mobilní obrazovka: +gól, karta, konec), **časomíra zápasu** viditelná na webu i TV. Bezpečnost: přihlášení přes Supabase (pozvánka/magic link pro roli zapisovatel s oprávněním jen k turnaji), **ne PIN jako tipovačka**. Vyžaduje roli v DB a úpravu `can_edit_tournament`. – L
13. **Fotogalerie akce**: nahrávání fotek (zmenšení přes `uploadAsset`), galerie na webu, výběr fotky do grafik (navazuje na bod 2). Pozor na Storage limit (Free 1 GB, Pro 100 GB). – M

### Vlna 4 – Dotažení detailů
13a. **Dorovnání AHL pro hokejové ligy** (jen pokud chceme do ligového segmentu): statistiky brankářů (zákroky, úspěšnost, čistá konta – nová data v editoru zápasu), ocenění/trofeje sezóny, anglické rozhraní (`i18n` – velká práce, až podle poptávky). Historie a rekordy napříč ročníky už máme (`src/lib/history.ts`). – M až L
14. Drobnosti z prověrky: přetékání dlouhých názvů v `MatchRow`. – S
15. **Prodejní materiály**: aktualizovat `docs/pitch.md` (příběh „turnaj, který se sám komentuje a šíří“ – Vlna 5), případová studie ZF Cup, ukázky nových grafik na úvodní stránce (`src/demo/`). – S

### Vlna 5 – Unikátnost (podpis produktu) *(zapsáno 2026-10-30)*
Prodejní příběh: **„turnaj, který se sám komentuje a šíří“**. Pořadatel nekupuje web s tabulkou, ale turnaj, o kterém se mluví. Aplikace sama vyrábí zážitek na místě i obsah na sítě. Každý modul jde **vypnout a zapnout** a před ostrým spuštěním prochází **Betou**.

**5.0 Základ: systém modulů a Beta** – S/M, dělá se jako první (podmínka pro 5.1–5.4 i 5.T) ✅ *(hotovo 2026-10-30, migrace 21 spuštěna; navíc stav `sunset` = „Doběh“ pro pravidlo 7)*
- **Úroveň platformy**: stav modulu `off | internal | beta | on` řídí správce platformy. `platform_settings` (migrace 11, `src/hooks/usePlatformSettings.ts`, `/moje` → Platforma) dostane JSON sloupec `modules`, např. `{"player_card":"beta","announcer":"internal"}`. Nová migrace 21; bez ní platí vše `off` (vzor `tips_globally_enabled`).
  - `off`: modul není nikde vidět.
  - `internal`: vidí ho jen správce platformy, na vlastních testech (validační turnaj).
  - `beta`: **vidí ho všichni pořadatelé** se štítkem **„Beta“** a popisem „funkce ve zkušebním provozu, může se ještě měnit“. Pořadatel si ji sám zapne; u modulu je **„Poslat zpětnou vazbu“** (tabulka `module_feedback`: modul, turnaj, text, hodnocení; správce ji vidí v Platformě).
  - `on`: hotový modul bez štítku.
- **Úroveň turnaje**: pořadatel zapíná v Admin → Nastavení → Volitelné moduly; jeden JSON sloupec `tournament.modules` (žádná migrace na každý modul).
- Jedna funkce `isModuleEnabled(key, tournament, platform, isPlatformAdmin)` v novém `src/lib/modules.ts`, registr modulů (název, popis, výchozí stav), štítek Beta v `src/components/ui/Badge`.

**Zapnutí a vypnutí uprostřed běžícího turnaje** (povinná pravidla pro každý modul)
1. **Přepínač nikdy nemaže ani nemění data turnaje.** Řídí jen zobrazení a chování; data modulu (hlasy, články, skeny) se po vypnutí skryjí a po zapnutí vrátí.
2. **Moduly reagující na události začínají „od teď“.** Hlasatel, chytrá režie a animace gólu si při zapnutí a při každém načtení TV uloží výchozí stav a hlásí jen změny po něm (jinak by po zapnutí nebo výpadku sítě přečetly všechny dosavadní góly). Události starší než ~60 s se ignorují, každá se ohlásí jen jednou.
3. **Nic se nedopočítává hromadně automaticky.** AI zpravodaj po zapnutí negeneruje články za celý den; nabídne ručně „Vytvořit i pro odehrané (N zápasů)“ s limitem.
4. **Oprava výsledku po vygenerování obsahu**: článek, karta nebo diplom ze starých dat se označí jako zastaralý a nabídne se obnovení. Nic se nepřepisuje potichu.
5. **Vytištěné QR kódy nesmí přestat fungovat**: přesměrování `/r/{kód}` funguje i po vypnutí modulu, jen se nepočítá. Report uvádí období měření.
6. **Změna se projeví bez obnovení stránky**: `tournament.modules` přijde přes stávající realtime odběr `tournament`; hlasatel ztichne okamžitě (`speechSynthesis.cancel()`), režie se vrátí ke střídání obrazovek.
7. **Vypnutí z platformy (`beta` → `off`) je nouzová brzda** jen pro případ chyby. Běžné ukončení bety nevypíná modul turnajům, které právě běží (den turnaje podle `tips_lock_from`/`match_date`), ale až po jejich skončení.

| Modul | Zapnutí uprostřed | Vypnutí uprostřed |
|---|---|---|
| Karta hráče, stránka hráče | bez rizika, počítá z dosavadních dat | sdílené obrázky zůstanou venku, stránka zmizí |
| Upozornění v telefonu | odběr jen od zapnutí | odesílání se zastaví, odběry se smažou |
| Hlasatel, chytrá režie | jen nové události (pravidlo 2) | okamžité ztišení, návrat ke střídání |
| Hlasování diváků | jen zápasy od zapnutí | hlasy se skryjí, nemažou se |
| AI zpravodaj | jen nové zápasy, starší ručně (pravidlo 3) | články se skryjí |
| Diplomy | kdykoli; před koncem turnaje upozornění „průběžné pořadí“ | bez dopadu |
| Dosah partnera | měří od zapnutí | QR dál přesměrovává (pravidlo 5) |
| Tipovačka | jen nezačaté zápasy, speciální tipy s uzávěrkou | tipy a body zůstanou, žebříček se skryje |

**5.1 Karta hráče + stránka hráče** – M + L
- **Sběratelská karta hráče** (jako ve FIFA): nová šablona v `src/components/share/templates.tsx` – fotka (`players.avatar_url`), číslo, góly, asistence, ocenění, barvy turnaje, partner, QR. Sdílí se přes `ShareModal`. Každá sdílená karta = reklama pro pořadatele, partnera i platformu.
- **Osobní stránka hráče** (`?hrac=` přes `DetailHost`): příští zápas a hřiště. Upozornění v telefonu (Web Push) až ve druhém kroku – vyžaduje service worker a server pro odesílání.

**5.2 Hlasatel + chytrá režie TV** – M *(hlasatel a chytrá režie ✅ 2026-10-30 jako moduly `announcer`, `smart_director`; hlasování diváků ✅ jako modul `fan_vote`, migrace 23)*
- **Hlasatel**: `speechSynthesis` prohlížeče s českým hlasem v TV režimu – začátek zápasu, gól se střelcem, zmínka partnera (prodejné partnerům). Pořadatel volí, co se hlásí; spuštění kliknutím (prohlížeče blokují zvuk bez interakce). Bez serveru a nákladů.
- **Chytrá režie**: `KioskMode` reaguje na události (gól, konec skupiny, finále) místo pevného střídání. Dělat spolu s Vlnou 2, bod 6 (animace gólu) – sdílejí logiku „od teď“.
- **Hlasování diváků o hráče zápasu**: QR na TV, hlas přes RPC s limitem (ne anonymní INSERT), výsledek živě na TV.

**5.3 AI zpravodaj + diplomy** – L + S
- ⏸ *(odloženo 2026-10-30; odhad ~15–30 Kč za turnaj se 40 zápasy podle modelu, nutný účet a API klíč Anthropic jen na serveru)* **AI zpravodaj**: po uložení zápasu článek a text na sítě, večer souhrn dne, po turnaji reportáž. Generuje server (funkce Vercel/Cloudflare s Claude API, klíč nikdy ve frontendu), vstup jen data turnaje. Pořadatel text schválí nebo upraví. Doplnit zpracovatele do `SUBPROCESSORS` (`src/lib/legal.ts`), stanovit náklady na turnaj a limit.
- ✅ *(2026-10-30, modul `diplomas`)* **Diplomy jedním klikem**: tisk/PDF podle vzoru `src/components/admin/MatchSheets.tsx` (pořadí, nejlepší střelec, hráč turnaje) v barvách turnaje s logy partnerů.

**5.4 Měřený dosah partnera** – M ✅ *(2026-10-30, modul `partner_reach`, migrace 24; report obsahuje i úspornou návštěvnost webu = Vlna 2 bod 9)*
- QR akce partnera na TV a v grafikách přes přesměrování `/r/{kód}` s čítačem skenů (RPC, bez cookies); po akci report pro partnera v PDF. Sloučit s Vlnou 2, bod 9.

**5.T Tipovačka – vlastní fáze revize** – L, samostatný plán, celé dny práce
Tipovačka přejde pod systém modulů (`tips_globally_enabled` → `modules.tips`, zachovat současný stav `off`). Před stupněm `beta` projde celou revizí:
- **Audit**: `Tips.tsx`, `TipsAdminTab.tsx`, `src/lib/tipsEval.ts`, triggery `after_match_result`/`after_bracket_slot_result`, migrace 17 + 18, tabulky `tipsters`, `tips`, `bracket_tips`, `special_tips`.
- **Bezpečnost tipérů**: místo jména a PINu v `localStorage` bezpečné přihlášení (odkaz e-mailem přes Supabase Auth, nebo PIN jen jako hash ověřovaný přes RPC s limitem pokusů). Zápis tipů jen přes RPC; tipér mění jen své tipy.
- **Zámek tipů na serveru**: dnes jen ve frontendu (`isMatchTimePassed`); DB musí odmítnout tip po začátku zápasu / po nasazení play-off.
- **Vyhodnocení na jednom místě (server)**: dnes část v triggerech, část ve frontendu (speciální tipy při otevření `TipsAdminTab`, vítěz v `BracketTab`/`MatchesTab`). Ověřit hokej (prodloužení, nájezdy) a opravy výsledků.
- **Použitelnost**: registrace tipéra, „moje tipy“, žebříček na webu i TV, srozumitelná pravidla bodování, mobil.
- **Zapnutí uprostřed turnaje**: tipovat jen nezačaté zápasy; speciální tipy s vlastní uzávěrkou; žebříček uvádí, od kdy se tipuje.
- **GDPR a zneužití**: údaje tipérů v právních stránkách (`src/lib/legal.ts`, Cookies), mazání tipéra, ochrana proti hromadné registraci.
- **Testy**: bodování všech typů tipů v `src/lib/__tests__/`, test RLS a RPC proti DB (cizí tipér, tip po zámku).
- Výstup: tipovačka ve stavu `beta`. Do té doby zůstává vypnutá.

## 5. Doporučené pořadí
1. **Vlna 1, body 1–4** (grafiky): nejrychlejší viditelný skok kvality, prodává se „očima“. *(1–2 ✅)*
2. **Vlna 5, bod 5.0** (systém modulů a Beta): základ, aby se vše další stavělo rovnou jako vypínatelný modul. Doporučeno i před body 3–4. *(✅)*
3. Přesun na Cloudflare *(✅ 2026-10-30, zbývá doména)* (`docs/PROGRESS.md`) – nejpozději před prvním placeným turnajem (Vercel Hobby zakazuje komerční použití); při placené akci do ~3 týdnů předřadit.
4. **Vlna 2, body 6–7** (gól na TV, spoty partnerů) spolu s **5.2** (hlasatel, chytrá režie): wow efekt na akci + argument pro sponzory.
5. **5.1** karta a stránka hráče → **5.T** tipovačka → **5.3** AI zpravodaj a diplomy → **5.4** dosah partnera (s bodem 9).
6. **Vlna 3** (přihlášky, startovné, zápis z hřiště): nutné pro samoobsluhu a cenu nad Tournify; vyžaduje návrh bezpečnosti.
7. Video (bod 5), overlay pro přenos (8), galerie (13).

Nové moduly vždy nejdřív `internal` (validační turnaj), pak `beta` (ZF Cup a ochotní pořadatelé), `on` až po ověření na ostré akci.

Každý bod = vlastní plán a sezení; nová funkce = dlaždice/ukázka v `src/demo/` (pravidlo CLAUDE.md).

## 6. Ověření (u každého bodu při realizaci)
- `npm run typecheck` (baseline 63 chyb, nesmí přibýt), `npm test`, `npm run build`.
- Grafiky: vygenerovat PNG 1:1 a 9:16 na validačním turnaji (dlouhé názvy, 8 partnerů, bez loga, hokej i fotbal) a porovnat se starou verzí.
- TV: TV režim na 1920×1080 a 3840×2160, simulace změny skóre přes admin.
- Nové DB sloupce: migrace v `db-backup/`, aplikace musí fungovat i bez ní (vzor `isMissingColumnError`), RLS přes `can_edit_tournament`, nová tabulka do migrace 15.
- Aktualizovat `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, CLAUDE.md.
- **Moduly (Vlna 5)**: automatický test logiky „od teď“ (čistá funkce: výchozí stav + nová data → události k ohlášení) včetně výpadku sítě, opravy výsledku a smazaného gólu. Scénář **„zapnout v půlce“** na validačním turnaji: rozehraný turnaj, otevřená TV a web v telefonu → zapnout, zadat gól, vypnout, zapnout znovu. Nic se nesmí přehrát zpětně ani zmizet z dat a změna se musí projevit bez obnovení stránky. Totéž pro přepnutí z platformy (`beta` → `off`) během dne turnaje.

## Zdroje konkurence
- Tournify ceník: https://tournifyapp.com/en/pricing ; partneři: https://tournifyapp.com/en/features/sponsoren
- LeagueRepublic: https://www.getapp.co.nz/software/110155/leaguerepublic
- AHL.cz: https://www.ahl.cz/chci-na-ahl/ , https://www.ahl.cz/partneri/
- HuráLiga: https://exporters.czechtrade.cz/en/huraliga ; Turnaje.org: https://apps.apple.com/dk/app/turnaje-org/id6449600461
