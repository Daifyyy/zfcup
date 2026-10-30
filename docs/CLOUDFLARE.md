# Cloudflare — založení projektu (návod pro provozovatele)

Aplikace běží souběžně na Vercelu (ostrý web) a na Cloudflare (zkušební adresa `*.workers.dev`).
Kód je připravený v `main` (`wrangler.jsonc`, `edge/worker.ts`, `public/_headers`). Projekt v Cloudflare
se zakládá jednou, vlastním účtem. Celkem ~15 minut.

## 1. Účet a projekt
1. Účet na <https://dash.cloudflare.com/sign-up> (stačí bezplatný tarif Workers Free — komerční použití povoluje).
2. **Workers & Pages → Create → Import a repository** → připojit GitHub, vybrat `Daifyyy/zfcup`.
3. Nastavení sestavení:
   - **Project name:** `turnaje-app` (musí odpovídat `name` ve `wrangler.jsonc`)
   - **Git branch / Production branch:** `main`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy` (výchozí)
   - **Preview command** (jiné větve): ponechat výchozí
   - Verze Node se bere ze souboru `.node-version` (22).
4. **Build variables** (Settings → Build → Variables and secrets) — Vite je zapéká do aplikace při buildu:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Proměnné Workeru** (Settings → Variables & Secrets). Dokud nejsou zadané, web vrací „Web je v údržbě“ (503) — na Cloudflare je údržba výchozí, otevře se jen výslovným `MAINTENANCE=false`:
   - `MAINTENANCE` = `true`
   - `MAINTENANCE_USER` = (stejné jako na Vercelu)
   - `MAINTENANCE_PASSWORD` = typ **Secret**
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — znovu, tentokrát pro Worker (náhledy odkazů čtou název turnaje)
   Proměnné z dashboardu se při nasazení nemažou (`keep_vars: true` ve `wrangler.jsonc`).
6. Po uložení proměnných spustit nové nasazení (Deployments → Retry / nový push), aby build dostal Build variables.

Pokud Cloudflare nabídne místo „Import a repository“ projekt typu *Pages*, nepoužívat — konfigurace je pro **Workers** se statickými soubory.

## 2. Supabase
Authentication → URL Configuration → **Redirect URLs**: přidat `https://turnaje-app.<účet>.workers.dev/**`
(reset hesla posílá odkaz na adresu, ze které byl vyžádán). Site URL zatím nechat na Vercelu.

## 3. Kontrola po nasazení
- `https://turnaje-app.<účet>.workers.dev/` → okno s heslem → aplikace se načte, turnaj jde otevřít, přihlášení organizátora funguje.
- Obnovení stránky na `/{id turnaje}` i `/moje` vrátí aplikaci (ne 404).
- Náhledy odkazů za heslem roboti nevidí (401) — ověřit až po vypnutí maintenance nebo po přechodu na doménu.
  Rychlá kontrola bez sítí: `curl -u jmeno:heslo -A facebookexternalhit/1.1 https://…/{id}` → HTML s `og:image`.

## Jak to funguje
- `git push` na `main` → Cloudflare sestaví a nasadí (1–2 min); jiná větev → náhledová verze.
- Vrácení verze: Deployments → vybrat starší → Rollback.
- Změna proměnné Workeru platí hned; změna Build variables až po novém buildu.
- Soubory `/assets/*` jdou přímo (bez Workeru, nepočítají se do limitu 100 000 požadavků/den); vše ostatní projde Workerem (heslo, náhledy pro roboty, bezpečnostní hlavičky).

## Později: přechod na vlastní doménu
1. Doménu přidat do Cloudflare (DNS) a v projektu Worker → Settings → Domains & Routes → Custom domain.
2. Supabase: Site URL = nová doména, Redirect URLs doplnit.
3. `vercel.json` nahradit přesměrováním `….vercel.app/*` → nová doména se zachováním cesty (staré odkazy a QR fungují dál); hlavičky z něj smazat i z testu `edgeHeaders`.
4. `src/lib/legal.ts` — odebrat Vercel ze `SUBPROCESSORS`; CLAUDE.md a docs aktualizovat.
