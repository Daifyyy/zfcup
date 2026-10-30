// Vercel Edge Middleware — logika je společná s Cloudflare Workerem (edge/core.ts).
// Hlavičky na Vercelu dává vercel.json.
import { maintenanceResponse, ogResponse } from './edge/core'

declare const process: { env: Record<string, string | undefined> }

export default async function middleware(request: Request): Promise<Response | undefined> {
  const env = process.env
  return maintenanceResponse(request, env) ?? (await ogResponse(request, env))
}
