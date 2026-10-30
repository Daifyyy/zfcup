// Vercel Edge Middleware — logika je společná s Cloudflare Workerem (edge/core.ts).
// Hlavičky na Vercelu dává vercel.json.
import { maintenanceResponse, ogResponse, reachRedirect } from './edge/core'

declare const process: { env: Record<string, string | undefined> }

export default async function middleware(request: Request): Promise<Response | undefined> {
  const env = process.env
  return maintenanceResponse(request, env) ?? (await reachRedirect(request, env)) ?? (await ogResponse(request, env))
}
