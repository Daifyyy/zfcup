// Šablony sdílecích grafik (1080×1080 / 1080×1920). Renderují se mimo obrazovku
// a html-to-image z nich udělá PNG. Styly jsou inline, aby výstup nezávisel na
// okolním layoutu stránky.
import type { CSSProperties, ReactNode } from 'react'
import type { Team } from '../../hooks/useTeams'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { StandingRow } from '../../lib/standings'
import { BRAND } from '../../lib/brand'

export type ShareFormat = 'square' | 'story'
export const FORMAT_SIZE: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story:  { w: 1080, h: 1920 },
}

const INK = '#f5f7fa'
const MUTED = 'rgba(226,232,240,.62)'
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"
const BODY = "'Inter', system-ui, sans-serif"

function Logo({ team, size }: { team?: Team; size: number }) {
  if (!team) return <div style={{ width: size, height: size }} />
  if (team.logo_url) {
    return (
      <div style={{ width: size, height: size, background: '#fff', borderRadius: size * 0.14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.45)' }}>
        <img src={team.logo_url} crossOrigin="anonymous" alt="" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
      </div>
    )
  }
  const words = team.name.split(/\s+/).filter(Boolean)
  const ini = (words.length > 1 ? words[0][0] + words[1][0] : team.name.slice(0, 2)).toUpperCase()
  return (
    <div style={{ width: size, height: size, background: team.color, borderRadius: size * 0.14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.42 }}>
      {ini}
    </div>
  )
}

/** Společný rám: záhlaví turnaje, obsah, pruh partnerů. */
function Frame({ format, tournament, kicker, sponsors, children }: {
  format: ShareFormat
  tournament: Tournament | null
  kicker: string
  sponsors: Sponsor[]
  children: ReactNode
}) {
  const { w, h } = FORMAT_SIZE[format]
  const partners = sponsors.filter(s => s.logo_url).slice(0, format === 'story' ? 8 : 5)
  const root: CSSProperties = {
    width: w, height: h, position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(160deg, #0b1220 0%, #111a2e 55%, #0b1220 100%)',
    color: INK, fontFamily: BODY, display: 'flex', flexDirection: 'column',
  }
  return (
    <div style={root}>
      {/* diagonální akcent */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 0 62%, rgba(255,255,255,.035) 62% 74%, transparent 74%)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: 'var(--brand)' }} />

      <header style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 28, padding: '64px 72px 0 88px' }}>
        {tournament?.logo_url && (
          <div style={{ width: 120, height: 120, background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={tournament.logo_url} crossOrigin="anonymous" alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--brand-2)' }}>{kicker}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 68, lineHeight: .95, textTransform: 'uppercase', marginTop: 6 }}>{tournament?.name}</div>
          {(tournament?.date || tournament?.venue) && (
            <div style={{ fontSize: 26, color: MUTED, marginTop: 10 }}>{[tournament?.date, tournament?.venue].filter(Boolean).join(' · ')}</div>
          )}
        </div>
      </header>

      <main style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px 0 88px' }}>
        {children}
      </main>

      <footer style={{ position: 'relative', background: '#fff', color: '#0b1220', padding: partners.length ? '26px 72px 26px 88px' : '20px 72px 20px 88px', display: 'flex', alignItems: 'center', gap: 32 }}>
        {partners.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 36, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            {partners.map(p => (
              <img key={p.id} src={p.logo_url} crossOrigin="anonymous" alt={p.name} style={{ height: 64, maxWidth: 190, objectFit: 'contain' }} />
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 700, letterSpacing: '.08em', color: '#5b6678', whiteSpace: 'nowrap' }}>{BRAND.name}</div>
      </footer>
    </div>
  )
}

export function MatchGraphic({ format, tournament, sponsors, home, away, homeScore, awayScore, label, decidedIn }: {
  format: ShareFormat
  tournament: Tournament | null
  sponsors: Sponsor[]
  home?: Team
  away?: Team
  homeScore: number
  awayScore: number
  label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
}) {
  const logo = format === 'story' ? 300 : 230
  const suffix = decidedIn === 'ot' ? 'po prodloužení' : decidedIn === 'so' ? 'po nájezdech' : ''
  const team = (t: Team | undefined, won: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, width: 330 }}>
      <Logo team={t} size={logo} />
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1, textAlign: 'center', textTransform: 'uppercase', opacity: won ? 1 : .72 }}>{t?.name ?? '—'}</div>
    </div>
  )
  return (
    <Frame format={format} tournament={tournament} kicker={`Výsledek · ${label}`} sponsors={sponsors}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: format === 'story' ? 'column' : 'row', gap: format === 'story' ? 56 : 0 }}>
        {team(home, homeScore >= awayScore)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[homeScore, awayScore].map((v, i) => (
              <div key={i} style={{
                fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, lineHeight: 1, width: 190, textAlign: 'center', padding: '14px 0',
                background: i === 0 ? 'var(--brand)' : '#1c2740', color: '#fff',
                // podpisový motiv platformy — diagonální řez mezi skóre
                clipPath: i === 0 ? 'polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%)' : 'polygon(28px 0, 100% 0, 100% 100%, 0 100%)',
                margin: i === 0 ? '0 -14px 0 0' : '0 0 0 -14px',
              }}>{v}</div>
            ))}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: MUTED }}>Konec{suffix && ` · ${suffix}`}</div>
        </div>
        {team(away, awayScore >= homeScore)}
      </div>
    </Frame>
  )
}

export function TableGraphic({ format, tournament, sponsors, groupName, rows, teams, allowDraws }: {
  format: ShareFormat
  tournament: Tournament | null
  sponsors: Sponsor[]
  groupName: string
  rows: StandingRow[]
  teams: Team[]
  allowDraws: boolean
}) {
  const max = format === 'story' ? 14 : 8
  const list = rows.slice(0, max)
  const rowH = format === 'story' ? 96 : Math.min(82, Math.floor(620 / Math.max(list.length, 1)))
  const cell: CSSProperties = { width: 86, textAlign: 'center', fontSize: 30, color: MUTED, fontVariantNumeric: 'tabular-nums' }
  return (
    <Frame format={format} tournament={tournament} kicker={`Tabulka · ${groupName}`} sponsors={sponsors}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px 14px', fontSize: 22, fontWeight: 700, letterSpacing: '.12em', color: MUTED, textTransform: 'uppercase' }}>
        <div style={{ width: 60 }}>#</div>
        <div style={{ flex: 1 }}>Tým</div>
        <div style={{ ...cell, fontSize: 22 }}>Z</div>
        <div style={{ ...cell, fontSize: 22, width: 120 }}>Skóre</div>
        <div style={{ ...cell, fontSize: 22, width: 100 }}>B</div>
      </div>
      {list.map((r, i) => {
        const t = teams.find(x => x.id === r.id)
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', height: rowH, padding: '0 24px', background: i % 2 ? 'transparent' : 'rgba(255,255,255,.04)', borderLeft: i === 0 ? '8px solid var(--brand)' : '8px solid transparent' }}>
            <div style={{ width: 52, fontFamily: DISPLAY, fontWeight: 800, fontSize: 40 }}>{i + 1}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
              <Logo team={t} size={rowH - 26} />
              <div style={{ fontSize: 36, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t?.name}</div>
            </div>
            <div style={cell}>{r.played}</div>
            <div style={{ ...cell, width: 120 }}>{r.gf}:{r.ga}</div>
            <div style={{ ...cell, width: 100, fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, color: INK }}>{r.pts}</div>
          </div>
        )
      })}
      {!allowDraws && <div style={{ fontSize: 20, color: MUTED, marginTop: 14, paddingLeft: 24 }}>Bez remíz — zápasy rozhoduje prodloužení / nájezdy</div>}
    </Frame>
  )
}

export function ScorersGraphic({ format, tournament, sponsors, title, rows }: {
  format: ShareFormat
  tournament: Tournament | null
  sponsors: Sponsor[]
  title: string
  rows: { name: string; team?: Team; value: number }[]
}) {
  const list = rows.slice(0, format === 'story' ? 10 : 5)
  return (
    <Frame format={format} tournament={tournament} kicker={title} sponsors={sponsors}>
      {list.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, padding: i === 0 ? '26px 28px' : '18px 28px', marginBottom: 10, background: i === 0 ? 'var(--brand)' : 'rgba(255,255,255,.05)', borderRadius: 12 }}>
          <div style={{ width: 56, fontFamily: DISPLAY, fontWeight: 800, fontSize: i === 0 ? 64 : 48, opacity: i === 0 ? 1 : .7 }}>{i + 1}</div>
          <Logo team={r.team} size={i === 0 ? 100 : 76} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: i === 0 ? 46 : 36, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
            {r.team && <div style={{ fontSize: 24, color: i === 0 ? 'rgba(255,255,255,.8)' : MUTED }}>{r.team.name}</div>}
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: i === 0 ? 110 : 76, lineHeight: 1 }}>{r.value}</div>
        </div>
      ))}
    </Frame>
  )
}
