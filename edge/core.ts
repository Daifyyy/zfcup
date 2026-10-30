// Serverová logika společná pro oba hostingy (do přepnutí běží souběžně):
//  - Vercel: middleware.ts (Edge Middleware)
//  - Cloudflare: edge/worker.ts (Worker se statickými soubory, wrangler.jsonc)
// 1) Maintenance režim (Basic Auth) — env MAINTENANCE=true; vždy první
// 2) Náhledy odkazů: robotům sociálních sítí vrátí na /{tournamentId} HTML s Open Graph
//    metadaty (SPA je bez JS nevidí). Obrázek vytváří aplikace organizátora (OgImageSync)
//    a ukládá do Storage — tady se nic nevykresluje (Cloudflare Free: 10 ms CPU na požadavek).
// Přihlašovací údaje maintenance režimu jsou jen v proměnných hostingu
// (MAINTENANCE_USER, MAINTENANCE_PASSWORD) — nikdy v kódu.
import { ogImagePublicUrl } from '../src/lib/og'

export interface EdgeEnv {
  MAINTENANCE?: string
  MAINTENANCE_USER?: string
  MAINTENANCE_PASSWORD?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

/**
 * Bezpečnostní hlavičky pro všechny odpovědi. Musí se shodovat s `vercel.json`
 * a `public/_headers` — hlídá test src/lib/__tests__/edgeHeaders.test.ts.
 * Nový externí zdroj (font, iframe, API) = doplnit CSP do všech tří.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://www.youtube.com https://www.youtube-nocookie.com; media-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
}
/** Soubory buildu mají v názvu otisk obsahu → smí se cachovat navždy. */
export const ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable'

const UUID_PATH = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i
const BOT_UA = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|googlebot|bingbot|applebot|pinterest|redditbot|embedly|vkshare|microsoftpreview/i

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Maintenance režim: odpověď 401/503, nebo undefined = pustit dál. */
export function maintenanceResponse(request: Request, env: EdgeEnv): Response | undefined {
  // velikost písmen a mezery nehrají roli (dashboard snadno uloží „True“)
  if (env.MAINTENANCE?.trim().toLowerCase() !== 'true') return undefined
  const user = env.MAINTENANCE_USER
  const pass = env.MAINTENANCE_PASSWORD
  // Bez nastavených údajů raději zavřít (fail closed), než web nechtěně otevřít
  if (!user || !pass) {
    return new Response('Web je v údržbě.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600' } })
  }
  const expected = 'Basic ' + btoa(`${user}:${pass}`)
  if (request.headers.get('authorization') === expected) return undefined
  return new Response('Přístup zakázán', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Turnajnik", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/** Krátký otisk verze náhledu (ETag / Last-Modified) pro ?v= — sítě si obrázky cachují podle adresy. */
function versionTag(res: Response): string {
  const raw = res.headers.get('etag') ?? res.headers.get('last-modified') ?? ''
  let h = 0
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Adresa obrázku náhledu: nahraný og.jpg turnaje, jinak výchozí obrázek aplikace. */
async function ogImageUrl(origin: string, base: string, id: string): Promise<string> {
  const fallback = `${origin}/og-default.png`
  try {
    const url = ogImagePublicUrl(base, id)
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok ? `${url}?v=${versionTag(res)}` : fallback
  } catch {
    return fallback
  }
}

/** Robot sociální sítě na /{uuid} → HTML s OG metadaty; jinak undefined (pustit na aplikaci). */
export async function ogResponse(request: Request, env: EdgeEnv): Promise<Response | undefined> {
  const url = new URL(request.url)
  const match = UUID_PATH.exec(url.pathname)
  if (!match || !BOT_UA.test(request.headers.get('user-agent') ?? '')) return undefined
  const base = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) return undefined
  const id = match[1].toLowerCase()
  try {
    // Soukromý turnaj RLS anonymu nevrátí → bez náhledu (aplikace ho pak ani nevytváří)
    const [res, image] = await Promise.all([
      fetch(`${base}/rest/v1/tournament?id=eq.${id}&select=name,subtitle,date,venue`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }),
      ogImageUrl(url.origin, base, id),
    ])
    if (!res.ok) return undefined
    const rows = (await res.json()) as { name: string; subtitle: string | null; date: string | null; venue: string | null }[]
    const t = rows[0]
    if (!t) return undefined
    return new Response(ogHtml(url.origin, id, t, image), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })
  } catch {
    return undefined
  }
}

export function ogHtml(origin: string, id: string, t: { name: string; subtitle: string | null; date: string | null; venue: string | null }, imageUrl: string): string {
  const title = escapeHtml(t.name)
  const desc = escapeHtml(
    [t.subtitle, t.date, t.venue].filter(Boolean).join(' · ') || 'Živé výsledky, tabulky, statistiky a program turnaje.',
  )
  const pageUrl = escapeHtml(`${origin}/${id}`)
  const image = escapeHtml(imageUrl)
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="cs_CZ">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${image}">
</head><body><a href="${pageUrl}">${title}</a></body></html>`
}
