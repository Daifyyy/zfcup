// Do přepnutí hostingu jsou hlavičky na třech místech (vercel.json, public/_headers,
// edge/core.ts pro odpovědi Workeru) — test hlídá, že se nerozjedou.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ASSET_CACHE_CONTROL, SECURITY_HEADERS, maintenanceResponse, ogHtml, ogResponse } from '../../../edge/core'
import { ogImagePublicUrl, ogSignature } from '../og'

const root = process.cwd()

/** Jednoduchý parser public/_headers: { '/*': { Name: value } } */
function parseHeadersFile(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  let current: Record<string, string> | null = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) { current = out[line.trim()] = {}; continue }
    const i = line.indexOf(':')
    if (current && i > 0) current[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

describe('bezpečnostní hlavičky', () => {
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  const cf = parseHeadersFile(readFileSync(resolve(root, 'public/_headers'), 'utf8'))

  it('vercel.json = edge/core.ts', () => {
    const all = vercel.headers.find(h => h.source === '/(.*)')!
    expect(Object.fromEntries(all.headers.map(h => [h.key, h.value]))).toEqual(SECURITY_HEADERS)
    const assets = vercel.headers.find(h => h.source === '/assets/(.*)')!
    expect(assets.headers).toEqual([{ key: 'Cache-Control', value: ASSET_CACHE_CONTROL }])
  })

  it('public/_headers = edge/core.ts', () => {
    expect(cf['/*']).toEqual(SECURITY_HEADERS)
    expect(cf['/assets/*']).toEqual({ 'Cache-Control': ASSET_CACHE_CONTROL })
  })
})

describe('maintenance režim', () => {
  const req = (auth?: string) => new Request('https://x.test/', { headers: auth ? { authorization: auth } : {} })
  it('vypnutý → pustí dál', () => {
    expect(maintenanceResponse(req(), {})).toBeUndefined()
  })
  it('hodnota bez ohledu na velikost písmen', () => {
    expect(maintenanceResponse(req(), { MAINTENANCE: ' True ' })?.status).toBe(503)
    expect(maintenanceResponse(req(), { MAINTENANCE: 'FALSE' })).toBeUndefined()
  })
  it('bez údajů → 503 (fail closed)', () => {
    expect(maintenanceResponse(req(), { MAINTENANCE: 'true' })?.status).toBe(503)
  })
  it('špatné / správné heslo', () => {
    const env = { MAINTENANCE: 'true', MAINTENANCE_USER: 'u', MAINTENANCE_PASSWORD: 'p' }
    expect(maintenanceResponse(req(), env)?.status).toBe(401)
    expect(maintenanceResponse(req('Basic ' + btoa('u:x')), env)?.status).toBe(401)
    expect(maintenanceResponse(req('Basic ' + btoa('u:p')), env)).toBeUndefined()
  })
})

describe('náhled odkazu', () => {
  const id = 'adcb7982-5716-407a-9f27-6fbae02346cb'
  it('HTML escapuje a obsahuje obrázek', () => {
    const html = ogHtml('https://x.test', id, { name: 'A <b> & "C"', subtitle: null, date: '1. 6.', venue: null }, 'https://img.test/og.jpg?v=1')
    expect(html).toContain('A &lt;b&gt; &amp; &quot;C&quot;')
    expect(html).toContain('<meta property="og:image" content="https://img.test/og.jpg?v=1">')
    expect(html).toContain(`content="https://x.test/${id}"`)
  })
  it('člověk ani jiná cesta nedostane OG HTML', async () => {
    const env = { VITE_SUPABASE_URL: 'https://s.test', VITE_SUPABASE_ANON_KEY: 'k' }
    const human = new Request(`https://x.test/${id}`, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/130' } })
    expect(await ogResponse(human, env)).toBeUndefined()
    const other = new Request('https://x.test/moje', { headers: { 'user-agent': 'facebookexternalhit/1.1' } })
    expect(await ogResponse(other, env)).toBeUndefined()
  })
  it('veřejná adresa a podpis', () => {
    expect(ogImagePublicUrl('https://s.test/', id)).toBe(`https://s.test/storage/v1/object/public/team-logos/tournaments/${id}/share/og.jpg`)
    const t = { id, name: 'Cup', logo_url: null }
    const base = ogSignature(t, [])
    expect(ogSignature(t, [{ id: 's', logo_url: 'x', tier: 'partner', position: 0 }])).toBe(base)
    expect(ogSignature(t, [{ id: 's', logo_url: 'x', tier: 'title', position: 0 }])).not.toBe(base)
    expect(ogSignature({ ...t, name: 'Cup 2' }, [])).not.toBe(base)
  })
})

import { reachRedirect } from '../../../edge/core'
import { vi } from 'vitest'
import { buildReport, normalizeTarget } from '../partnerReach'

describe('QR akce partnera — přesměrování /r/{kód}', () => {
  const env = { VITE_SUPABASE_URL: 'https://s.test', VITE_SUPABASE_ANON_KEY: 'k' }
  it('jiná cesta → nic; známý kód → 302 na cíl; robot se nepočítá; neznámý → úvod', async () => {
    expect(await reachRedirect(new Request('https://x.test/moje'), env)).toBeUndefined()
    const calls: { body: string }[] = []
    const fetchMock = vi.fn(async (_u: string, init: RequestInit) => {
      calls.push({ body: String(init.body) })
      return new Response(JSON.stringify(JSON.parse(String(init.body)).p_code === 'abcd2345' ? 'https://partner.cz/akce' : null), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const ok = await reachRedirect(new Request('https://x.test/r/abcd2345?s=tv'), env)
    expect(ok?.status).toBe(302)
    expect(ok?.headers.get('location')).toBe('https://partner.cz/akce')
    expect(JSON.parse(calls[0].body)).toEqual({ p_code: 'abcd2345', p_source: 'tv', p_count: true })
    await reachRedirect(new Request('https://x.test/r/abcd2345?s=hack', { headers: { 'user-agent': 'WhatsApp/2.0' } }), env)
    expect(JSON.parse(calls[1].body)).toMatchObject({ p_source: 'other', p_count: false })
    const unknown = await reachRedirect(new Request('https://x.test/r/zzzz9999'), env)
    expect(unknown?.headers.get('location')).toBe('https://x.test/')
    vi.unstubAllGlobals()
  })
})

describe('report dosahu partnera', () => {
  it('součty skenů podle zdroje a hodin, spoty, návštěvy, minuty TV, období', () => {
    const r = buildReport([
      { sponsor_id: 'P', kind: 'scan', source: 'tv', hour: '2026-10-30T10:00:00Z', amount: 3 },
      { sponsor_id: 'P', kind: 'scan', source: 'social', hour: '2026-10-30T11:00:00Z', amount: 5 },
      { sponsor_id: 'P', kind: 'scan', source: 'tv', hour: '2026-10-30T11:00:00Z', amount: 1 },
      { sponsor_id: 'P', kind: 'tv_spot', source: '', hour: '2026-10-30T10:00:00Z', amount: 7 },
      { sponsor_id: null, kind: 'visit', source: '', hour: '2026-10-30T09:00:00Z', amount: 40 },
      { sponsor_id: null, kind: 'tv_minutes', source: '', hour: '2026-10-30T12:00:00Z', amount: 25 },
    ])
    const p = r.partners.get('P')!
    expect(p.scans).toBe(9)
    expect(p.scansBySource).toEqual([{ source: 'social', count: 5 }, { source: 'tv', count: 4 }])
    expect(p.scansByHour.map(h => h.count)).toEqual([3, 6])
    expect(p.tvSpots).toBe(7)
    expect([r.visits, r.tvMinutes, r.from, r.to]).toEqual([40, 25, '2026-10-30T09:00:00Z', '2026-10-30T12:00:00Z'])
  })
  it('cílová adresa: doplní https, odmítne nesmysl', () => {
    expect(normalizeTarget('www.partner.cz/akce')).toBe('https://www.partner.cz/akce')
    expect(normalizeTarget('javascript:alert(1)')).toBeNull()
    expect(normalizeTarget('ahoj')).toBeNull()
  })
})
