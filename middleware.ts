// Vercel Edge Middleware
// 1) Maintenance režim (Basic Auth) — env MAINTENANCE=true
// 2) Náhledy odkazů: robotům sociálních sítí vrátí na /{tournamentId}
//    HTML s Open Graph metadaty (SPA je bez JS nevidí). Lidé jdou dál na aplikaci.

// Přihlašovací údaje maintenance režimu jsou jen v env proměnných Vercelu
// (MAINTENANCE_USER, MAINTENANCE_PASSWORD) — nikdy v kódu.

const UUID_PATH = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i
const BOT_UA = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|googlebot|bingbot|applebot|pinterest|redditbot|embedly|vkshare/i

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

async function ogResponse(url: URL, id: string): Promise<Response | undefined> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) return undefined
  const res = await fetch(`${base}/rest/v1/tournament?id=eq.${id}&select=name,subtitle,date,venue`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return undefined
  const rows = (await res.json()) as { name: string; subtitle: string | null; date: string | null; venue: string | null }[]
  const t = rows[0]
  if (!t) return undefined

  const title = escapeHtml(t.name)
  const desc = escapeHtml(
    [t.subtitle, t.date, t.venue].filter(Boolean).join(' · ') || 'Živé výsledky, tabulky, statistiky a program turnaje.',
  )
  const pageUrl = escapeHtml(`${url.origin}/${id}`)
  const image = escapeHtml(`${url.origin}/api/og?id=${id}`)
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8">
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
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (process.env.MAINTENANCE === 'true') {
    const user = process.env.MAINTENANCE_USER
    const pass = process.env.MAINTENANCE_PASSWORD
    // Bez nastavených údajů raději zavřít (fail closed), než web nechtěně otevřít
    if (!user || !pass) {
      return new Response('Web je v údržbě.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600' } })
    }
    const auth = request.headers.get('authorization')
    const expected = 'Basic ' + btoa(`${user}:${pass}`)
    if (auth !== expected) {
      return new Response('Přístup zakázán', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Turnajnik", charset="UTF-8"' },
      })
    }
  }

  const url = new URL(request.url)
  const match = UUID_PATH.exec(url.pathname)
  if (match && BOT_UA.test(request.headers.get('user-agent') ?? '')) {
    try {
      return await ogResponse(url, match[1])
    } catch {
      return undefined
    }
  }
  return undefined
}
