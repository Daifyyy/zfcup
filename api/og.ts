// Vercel Edge Function: náhledový obrázek turnaje pro sdílení odkazu
// (Open Graph — WhatsApp, Facebook, Teams, LinkedIn…). 1200×630 px.
// GET /api/og?id={tournamentId}
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

interface TournamentRow {
  name: string
  subtitle: string | null
  date: string | null
  venue: string | null
  logo_url: string | null
  brand_primary?: string | null
  sport?: string | null
}

interface SponsorRow { name: string; logo_url: string | null; tier?: string | null; position: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function rest<T>(path: string): Promise<T | null> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) return null
  return res.json() as Promise<T>
}

type Node = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node =>
  ({ type, props: { style: { display: 'flex', ...style }, children, ...extra } })

export default async function handler(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const rows = UUID.test(id)
    ? await rest<TournamentRow[]>(`tournament?id=eq.${id}&select=name,subtitle,date,venue,logo_url,brand_primary,sport`)
    : null
  const t = rows?.[0]
  // Sloupec tier existuje až po migraci 08 — při chybě zkusit bez něj
  const sponsors = t
    ? (await rest<SponsorRow[]>(`sponsors?tournament_id=eq.${id}&select=name,logo_url,tier,position&order=position`))
      ?? (await rest<SponsorRow[]>(`sponsors?tournament_id=eq.${id}&select=name,logo_url,position&order=position`))
      ?? []
    : []
  const title = sponsors.find(s => s.tier === 'title' && s.logo_url)

  const brand = t?.brand_primary && /^#[0-9a-f]{6}$/i.test(t.brand_primary) ? t.brand_primary : '#1d4ed8'
  const name = t?.name ?? 'Turnaj'
  const meta = [t?.date, t?.venue].filter(Boolean).join('  ·  ')
  const sport = t?.sport === 'hockey' ? 'HOKEJ' : 'FOTBAL'

  const tree = h('div', {
    width: '100%', height: '100%', background: 'linear-gradient(150deg, #0b1220 0%, #141d2e 60%, #0b1220 100%)',
    color: '#fff', fontFamily: 'sans-serif', flexDirection: 'column', position: 'relative',
  }, [
    h('div', { position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: brand }),
    h('div', { flex: 1, alignItems: 'center', gap: 48, padding: '0 80px 0 100px' }, [
      t?.logo_url
        ? h('div', { width: 240, height: 240, background: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
            h('img', { width: 200, height: 200, objectFit: 'contain' }, undefined, { src: t.logo_url, width: 200, height: 200 }))
        : null,
      h('div', { flexDirection: 'column', flex: 1, minWidth: 0 }, [
        h('div', { fontSize: 28, fontWeight: 700, letterSpacing: 6, color: brand === '#1d4ed8' ? '#7aa7ff' : '#ffffff', opacity: 0.9 }, `${sport} · ŽIVÉ VÝSLEDKY`),
        h('div', { fontSize: name.length > 28 ? 64 : 84, fontWeight: 800, lineHeight: 1, marginTop: 16, textTransform: 'uppercase' }, name),
        t?.subtitle ? h('div', { fontSize: 34, color: 'rgba(255,255,255,.7)', marginTop: 14 }, t.subtitle) : null,
        meta ? h('div', { fontSize: 30, color: 'rgba(255,255,255,.7)', marginTop: 22 }, meta) : null,
      ].filter(Boolean)),
    ].filter(Boolean)),
    title
      ? h('div', { background: '#fff', color: '#0b1220', alignItems: 'center', gap: 24, padding: '22px 100px', fontSize: 24, fontWeight: 700, letterSpacing: 4 }, [
          h('div', {}, 'PRESENTED BY'),
          h('img', { height: 64, objectFit: 'contain' }, undefined, { src: title.logo_url!, height: 64 }),
        ])
      : h('div', { height: 12, background: brand }),
  ])

  return new ImageResponse(tree as never, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  })
}
