# PROJEKT.md — ZF Cup Tournament App

## Přehled
Webová aplikace pro firemní fotbalový turnaj. Veřejnost sleduje výsledky v reálném čase,
jeden admin spravuje data. Aplikace běží na sdíleném monitoru na místě turnaje i na telefonech.

---

## Supabase schema — spusť v SQL editoru

```sql
-- Povolit UUID
create extension if not exists "uuid-ossp";

-- Turnaj (jeden záznam)
create table tournament (
  id uuid primary key default uuid_generate_v4(),
  name text default '',
  subtitle text default '',
  date text default '',
  venue text default '',
  description text default '',
  created_at timestamptz default now()
);
insert into tournament (name) values ('ZF Cup');

-- Týmy
create table teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text default '#2563eb',
  created_at timestamptz default now()
);

-- Hráči (soupiska)
create table players (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  number int,
  created_at timestamptz default now()
);

-- Skupiny
create table groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  team_ids uuid[] default '{}',
  schedule text default 'once',        -- 'once' | 'twice'
  tiebreaker text default 'score_first', -- 'score_first' | 'h2h_first'
  start_time text default '',
  match_duration int default 20,
  break_between int default 5,
  created_at timestamptz default now()
);

-- Zápasy
create table matches (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references groups(id) on delete set null,
  round text default '',
  home_id uuid references teams(id) on delete cascade,
  away_id uuid references teams(id) on delete cascade,
  home_score int default 0,
  away_score int default 0,
  played boolean default false,
  scheduled_time text default '',
  created_at timestamptz default now()
);

-- Góly
create table goals (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references players(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  count int default 1,
  created_at timestamptz default now(),
  unique(player_id, match_id)
);

-- Bracket (pavouk)
create table bracket_rounds (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);

create table bracket_slots (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references bracket_rounds(id) on delete cascade,
  position int default 0,
  home_id uuid references teams(id) on delete set null,
  away_id uuid references teams(id) on delete set null,
  home_score int default 0,
  away_score int default 0,
  played boolean default false
);

-- Informace / oznámení
create table announcements (
  id uuid primary key default uuid_generate_v4(),
  icon text default '📌',
  title text not null,
  body text default '',
  position int default 0,
  created_at timestamptz default now()
);

-- Play-off nastavení
create table playoff_settings (
  id uuid primary key default uuid_generate_v4(),
  start_time text default '',
  match_duration int default 30,
  break_between int default 10,
  group_break int default 30
);
insert into playoff_settings default values;

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table tournament enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table groups enable row level security;
alter table matches enable row level security;
alter table goals enable row level security;
alter table bracket_rounds enable row level security;
alter table bracket_slots enable row level security;
alter table announcements enable row level security;
alter table playoff_settings enable row level security;

-- Veřejnost: čtení všeho
create policy "public read" on tournament for select using (true);
create policy "public read" on teams for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on groups for select using (true);
create policy "public read" on matches for select using (true);
create policy "public read" on goals for select using (true);
create policy "public read" on bracket_rounds for select using (true);
create policy "public read" on bracket_slots for select using (true);
create policy "public read" on announcements for select using (true);
create policy "public read" on playoff_settings for select using (true);

-- Admin (authenticated): plný přístup
create policy "admin write" on tournament for all using (auth.role() = 'authenticated');
create policy "admin write" on teams for all using (auth.role() = 'authenticated');
create policy "admin write" on players for all using (auth.role() = 'authenticated');
create policy "admin write" on groups for all using (auth.role() = 'authenticated');
create policy "admin write" on matches for all using (auth.role() = 'authenticated');
create policy "admin write" on goals for all using (auth.role() = 'authenticated');
create policy "admin write" on bracket_rounds for all using (auth.role() = 'authenticated');
create policy "admin write" on bracket_slots for all using (auth.role() = 'authenticated');
create policy "admin write" on announcements for all using (auth.role() = 'authenticated');
create policy "admin write" on playoff_settings for all using (auth.role() = 'authenticated');
```

---

## Supabase Auth setup
1. Supabase dashboard → Authentication → Users → Add user
2. Email: tvůj email, heslo: silné heslo
3. Tento účet = jediný admin, žádná registrace pro veřejnost

---

## .env.local
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Struktura projektu

```
src/
├── lib/
│   └── supabase.ts          — inicializace klienta
├── hooks/
│   ├── useTournament.ts
│   ├── useTeams.ts
│   ├── usePlayers.ts        — soupiska per tým
│   ├── useGroups.ts
│   ├── useMatches.ts
│   ├── useGoals.ts          — góly per hráč, agregace střelců
│   ├── useBracket.ts
│   └── useAnnouncements.ts
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Nav.tsx
│   ├── public/
│   │   ├── Overview.tsx
│   │   ├── Teams.tsx        — karty týmů + počty hráčů
│   │   ├── Roster.tsx       — soupiska týmu (modal/detail)
│   │   ├── Results.tsx      — výsledky s časy
│   │   ├── Standings.tsx    — tabulka skupin
│   │   ├── Scorers.tsx      — střelci (pouze hráči s góly ≥ 1)
│   │   └── Bracket.tsx      — pavouk
│   ├── admin/
│   │   ├── AdminPanel.tsx   — slide-in wrapper
│   │   ├── tabs/
│   │   │   ├── InfoTab.tsx
│   │   │   ├── AnnouncementsTab.tsx
│   │   │   ├── TeamsTab.tsx      — správa týmů + soupisek
│   │   │   ├── GroupsTab.tsx     — skupiny + generování zápasů
│   │   │   ├── MatchesTab.tsx    — výsledky + góly per hráč
│   │   │   ├── ScorersTab.tsx
│   │   │   ├── BracketTab.tsx
│   │   │   └── SettingsTab.tsx
│   ├── kiosk/
│   │   └── KioskMode.tsx    — fullscreen, auto-rotace záložek
│   └── ui/
│       ├── Toast.tsx
│       ├── QRCode.tsx
│       └── Badge.tsx
└── App.tsx
```

---

## Funkcionalita — detailní popis

### Soupisky hráčů
- Každý tým má seznam hráčů (jméno, číslo dresu volitelné)
- Admin: TeamsTab → výběr týmu → přidat/smazat hráče
- Veřejnost: karta týmu → klik → modal se soupiskou

### Góly per zápas
- Admin: MatchesTab → klik na zápas → zobrazí se hráči obou týmů
- Pro každého hráče tlačítka − a + (min 0)
- Uloží se do tabulky `goals` (player_id, match_id, count)
- Střelci = agregace: `SELECT player_id, SUM(count) WHERE sum >= 1 ORDER BY sum DESC`
- Aktualizace realtime → všichni vidí okamžitě

### Display / Kiosk mode
- Tlačítko v headeru (nebo URL parametr `?kiosk=1`)
- Fullscreen bez admin UI
- Auto-rotace: Přehled → Výsledky → Tabulka → Střelci → Pavouk (každých 15s)
- Progress bar naznačuje kdy se přepne další záložka
- Klik kamkoliv = pauza rotace
- Ideální pro sdílený monitor na turnaji

### QR kód
- Zobrazí se v Přehledu (pravý roh karty) a v Kiosk mode
- Generuje QR z aktuální URL stránky
- Použij knihovnu `qrcode.react`
- Kolegové naskenují → otevře se jim stejná stránka na mobilu

### Realtime
- Supabase Realtime subscription na všechny tabulky
- Při změně = automatický re-fetch dotčené tabulky
- Žádný polling, žádné manuální refresh

### Skupiny — zachovat
- Circle-method generování (každý tým má pauzu po zápase)
- Tiebreaker A (skóre→H2H) nebo B (H2H→skóre)
- Časový harmonogram: čas 1. zápasu, délka, pauza
- Preview konce skupiny při zadávání
- Úprava skupiny zachová odehrané zápasy, přegeneruje neodehrané

---

## Design systém

```
Barvy:
  pozadí:     #f8fafc  (světle šedá)
  karta:      #ffffff  (bílá se shadow)
  akcent:     #2563eb  (modrá)
  akcent2:    #1d4ed8  (tmavší modrá hover)
  text:       #0f172a  (téměř černá)
  muted:      #64748b  (šedá)
  border:     #e2e8f0
  success:    #16a34a  (zelená)
  danger:     #dc2626  (červená)
  gold:       #d97706  (zlatá, 1. místo)

Shadow:
  karta:  0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)
  panel:  0 20px 60px rgba(0,0,0,.15)

Fonts:
  nadpisy:  'Bebas Neue', sans-serif
  text:     'DM Sans', sans-serif

Breakpointy:
  tablet:  768px
  mobile:  480px
  small:   360px
```

---

## Spuštění projektu

```bash
npm create vite@latest zf-cup -- --template react
cd zf-cup
npm install @supabase/supabase-js qrcode.react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm run dev
```

---

## Deploy na Vercel

```bash
npm install -g vercel
vercel
# nebo propoj GitHub repo a automatický deploy
```

Environment variables přidej v Vercel dashboard (Settings → Environment Variables).

---

## Prioritní pořadí implementace

1. Supabase setup (schema, RLS, auth uživatel)
2. Základní hooks (useTeams, useMatches, useGroups)
3. Veřejný pohled — Přehled, Týmy, Výsledky, Tabulka, Střelci, Pavouk
4. Admin panel — přihlášení, základní CRUD
5. Soupisky hráčů (players tabulka)
6. Góly per hráč per zápas
7. Skupiny — generování, úprava, harmonogram
8. Kiosk/Display mode
9. QR kód
10. Redesign, polish, testování na mobilu
