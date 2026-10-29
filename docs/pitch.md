# Turnajník — Webová aplikace pro správu sportovních turnajů

## Co aplikace řeší

Kompletní digitální správa firemního nebo amatérského fotbalového turnaje — od přihlášení týmů až po vyhlášení vítěze. Vše v reálném čase, dostupné z mobilu i PC, bez instalace.

---

## Klíčové funkce

### Správa turnaje
- Skupinová fáze i liga (round-robin, circle-method)
- Playoff bracket s automatickým postupem (8 různých formátů)
- Automatické generování rozpisu zápasů včetně časování a hřišť
- Správa týmů, hráčů, čísel dresů a rolí (kapitán, brankář)

### Živé výsledky
- Realtime aktualizace bez refreshe stránky (WebSocket)
- Tabulky skupin s plným tiebreakerem (skóre → vstřelené góly → vzájemný zápas)
- Střelecká tabulka, přihrávky, disciplinární záznamy

### TV Scoreboard (Tabule)
- Kiosková obrazovka pro promítání na TV/projektor
- Automatické stránkování při velkém počtu zápasů
- Zobrazuje standings, aktuální zápasy i playoff bracket

### Tipovačka
- Hráči tipují výsledky skupinové fáze i playoff
- Automatické bodování (trigger v databázi, žádná ruční práce)
- Speciální tipy: vítěz turnaje, nejlepší střelec, vítěz skupiny
- Datový zámek — tipy se uzamknou v nastavenou dobu

### Admin panel
- Plná správa bez přístupu do databáze
- Upload log týmů a hráčů (PNG/JPG)
- Import hráčů z CSV/Excel
- Správa sponzorů včetně zobrazení na webu
- Oznámení s podporou textu, obrázků a YouTube videí
- Záložka Pravidla pro zobrazení propozic

### Přizpůsobení
- Logo turnaje, název, barvy
- Sponzorská loga v postranním panelu
- Volitelné moduly: asistence, kartičky, tipovačka, sponzoři
- Tisknutelný bulletin (PDF přes prohlížeč)

---

## Technický stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS (světlé téma, plně responzivní) |
| Databáze | Supabase (PostgreSQL, Row Level Security) |
| Realtime | Supabase Realtime (WebSocket) |
| Auth | Supabase Auth (admin) + vlastní systém (tipéři) |
| Hosting | Vercel (CDN, edge functions) |

---

## Provozní náklady (měsíčně)

| Služba | Free tier | Placený |
|--------|-----------|---------|
| Vercel | 0 Kč (hobby) | ~500 Kč/měs (pro) |
| Supabase | 0 Kč (500 MB DB, 1 GB storage) | ~1 100 Kč/měs (pro) |

Pro 1–3 turnaje ročně = **free tier plně dostačuje**, náklady 0 Kč.

---

## Multi-tenant architektura

Jedna instalace = neomezený počet turnajů současně. Každý turnaj má vlastní UUID, vlastní data, vlastní admin přístup. Diváci přistupují přes URL `/{tournamentId}` — bez registrace.

---

## Co není součástí

- Mobilní aplikace (pouze webová)
- Platební brána
- Automatický email/SMS systém
- Integrace s federacemi (FAČR apod.)
