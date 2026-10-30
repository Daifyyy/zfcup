// Cloudflare Worker se statickými soubory (konfigurace wrangler.jsonc).
// Soubory /assets/* jdou přímo ze statických souborů (Worker se nespouští — šetří
// limit 100 000 požadavků/den); hlavičky jim dává public/_headers.
// Všechno ostatní projde tudy: maintenance → náhledy pro roboty → aplikace (SPA).
// _headers se na odpovědi Workeru neuplatní → hlavičky přidáváme tady.
import { maintenanceResponse, ogResponse, SECURITY_HEADERS, type EdgeEnv } from './core'

interface Env extends EdgeEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

function withSecurityHeaders(res: Response): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v)
  return out
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Na Cloudflare je údržba výchozí: chybějící MAINTENANCE = zavřeno. První nasazení po
    // importu z GitHubu proběhne dřív, než se zadají proměnné — web nesmí být ani chvíli otevřený.
    // Otevřít = výslovně MAINTENANCE=false.
    const blocked = maintenanceResponse(request, { ...env, MAINTENANCE: env.MAINTENANCE ?? 'true' })
    if (blocked) return withSecurityHeaders(blocked)
    const og = await ogResponse(request, env)
    if (og) return withSecurityHeaders(og)
    // not_found_handling: single-page-application → neznámé cesty vrátí index.html
    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}
