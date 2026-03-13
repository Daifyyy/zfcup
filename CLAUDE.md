# CLAUDE.md — Instrukce pro Claude Code

## Role
Jsi senior full-stack developer. Pracuješ na webové aplikaci pro firemní fotbalový turnaj.
Referenční implementace je v `turnaj_final.html` — zachovej veškerou existující funkcionalitu.

## Technický stack
- **Frontend:** React 18 + Vite, TypeScript volitelný
- **Styling:** Tailwind CSS (světlé téma, modrá/bílá/černá)
- **Backend:** Supabase (PostgreSQL + RLS + Realtime + Auth)
- **Hosting:** Vercel (nebo Netlify, dle výběru)
- **Fonty:** Bebas Neue (nadpisy), DM Sans (text)

## Supabase konfigurace
- Přihlašovací údaje jsou v `.env.local` (nikdy je necommituj)
- Použij `@supabase/supabase-js` klienta
- anon key = veřejné čtení (RLS SELECT pro všechny)
- Admin přihlášení = Supabase Auth (email + heslo) → JWT → RLS povolí mutace

## Pravidla kódování
- Komponenty do `src/components/`, stránky do `src/pages/`
- Každá entita má vlastní hook (např. `useMatches`, `useGroups`, `usePlayers`)
- Realtime subscriptions v hookách, cleanup v useEffect return
- Nikdy service_role key ve frontendu
- Chyby vždy ošetři — ukaž uživateli toast, ne console.error

## Styl a UX
- Světlé téma: pozadí #f8fafc, karty bílé se shadow, akcent #2563eb (modrá)
- Nadpisy: Bebas Neue, text: DM Sans
- Mobilní first — funguje na telefonu i na velkém monitoru
- Admin panel: slide-in panel zprava (jako dosud)
- Toast notifikace pro všechny akce

## Co zachovat z turnaj_final.html
- Přehled / Týmy / Výsledky / Tabulka / Střelci / Pavouk
- Skupiny: circle-method generování zápasů, tiebreaker A/B, časový harmonogram
- Admin záložky: Info, Informace, Týmy, Skupiny, Zápasy, Střelci, Pavouk, Nastavení
- Responsive design (768px, 480px, 360px breakpointy)

## Nové funkce (prioritizováno)
1. Soupisky hráčů per tým
2. Góly ±1 per hráč per zápas → automaticky do střelců
3. Display/Kiosk mode (fullscreen, auto-rotace záložek)
4. QR kód na stránce
5. Los skupin (až vše ostatní funguje)
