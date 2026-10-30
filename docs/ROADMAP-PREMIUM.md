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
2. **Fotka jako pozadí** (z akce, nahraná organizátorem přes `uploadAsset`, Storage `tournaments/{id}/…`), s tmavým přechodem pro čitelnost. – M
3. **Nové šablony**: program hracího dne / pozvánka, **hráč zápasu (MVP)**, nejlepší sestava / tým turnaje, gratulace vítězi, konečné pořadí, souhrn dne (výsledky dne v jedné grafice). MVP vyžaduje nový sloupec (`matches.mvp_player_id`, `bracket_slots.mvp_player_id`) → migrace 20 + volba v editoru zápasu. – M/L
4. **Balíček grafik**: „Stáhnout vše za dnešek“ (ZIP grafik dne pro správce sociálních sítí). – S
5. **Video / animace (Reels/Stories)**: animovaný výsledek 5–8 s (příjezd log, odpočet skóre, partner na konci). Technicky: vykreslení snímků na `canvas` v prohlížeči + `MediaRecorder` (WebM) / WebCodecs (MP4), bez serveru. Nejdřív prototyp na 1 šabloně a ověření, že Instagram/WhatsApp formát přijmou. – L

### Vlna 2 – Zážitek na místě a pro partnery
6. **Animace gólu na TV**: „GÓL!“ + střelec + logo týmu přes celou obrazovku na 4–5 s při změně skóre (realtime už je); volitelně „gól powered by [partner]“ = **prodejné partnerovi**. – M
7. **Reklamní spoty partnerů v TV režimu**: celoobrazovkové logo/obrázek partnera v rotaci `KioskMode` (vedle Zápasy/Tabulka/Pavouk), počet zobrazení podle úrovně. + **oznámení na TV**. – S/M
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
15. **Prodejní materiály**: aktualizovat `docs/pitch.md`, případová studie ZF Cup, ukázky nových grafik na úvodní stránce (`src/demo/`). – S

## 5. Doporučené pořadí
1. **Vlna 1, body 1–4** (grafiky): nejrychlejší viditelný skok kvality, prodává se „očima“.
2. **Vlna 2, body 6–7** (gól na TV, spoty partnerů): wow efekt na akci + argument pro sponzory = pořadatel to zaplatí z peněz partnerů.
3. Přesun na Cloudflare (už naplánován v `docs/PROGRESS.md`) – před prvním placeným turnajem.
4. **Vlna 3** (přihlášky, startovné, zápis z hřiště): nutné pro samoobsluhu a cenu nad Tournify; vyžaduje návrh bezpečnosti.
5. Video (bod 5), overlay pro přenos (8), report pro partnery (9), galerie (13).

Každý bod = vlastní plán a sezení; nová funkce = dlaždice/ukázka v `src/demo/` (pravidlo CLAUDE.md).

## 6. Ověření (u každého bodu při realizaci)
- `npm run typecheck` (baseline 63 chyb, nesmí přibýt), `npm test`, `npm run build`.
- Grafiky: vygenerovat PNG 1:1 a 9:16 na validačním turnaji (dlouhé názvy, 8 partnerů, bez loga, hokej i fotbal) a porovnat se starou verzí.
- TV: TV režim na 1920×1080 a 3840×2160, simulace změny skóre přes admin.
- Nové DB sloupce: migrace v `db-backup/`, aplikace musí fungovat i bez ní (vzor `isMissingColumnError`), RLS přes `can_edit_tournament`, nová tabulka do migrace 15.
- Aktualizovat `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, CLAUDE.md.

## Zdroje konkurence
- Tournify ceník: https://tournifyapp.com/en/pricing ; partneři: https://tournifyapp.com/en/features/sponsoren
- LeagueRepublic: https://www.getapp.co.nz/software/110155/leaguerepublic
- AHL.cz: https://www.ahl.cz/chci-na-ahl/ , https://www.ahl.cz/partneri/
- HuráLiga: https://exporters.czechtrade.cz/en/huraliga ; Turnaje.org: https://apps.apple.com/dk/app/turnaje-org/id6449600461
