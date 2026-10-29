// Šablony sdílecích grafik (1080×1080 / 1080×1920). Renderují se mimo obrazovku
// a html-to-image z nich udělá PNG. Styly jsou inline, aby výstup nezávisel na
// okolním layoutu stránky.
import type { CSSProperties, ReactNode } from 'react'
import type { Team } from '../../hooks/useTeams'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { StandingRow } from '../../lib/standings'
import { BRAND } from '../../lib/brand'
import { getSportDef } from '../../lib/sports'
import type { SideEvents } from '../../lib/details'

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

// Barvy karet a pódia (sdílecí šablony mají vlastní paletu — výjimka z pravidla tokenů)
const YELLOW = '#facc15'
const RED = '#dc2626'
const PODIUM = ['#f5b301', '#c3ccd8', '#cd7f32']

function CardShape({ kind, h = 26 }: { kind: 'yellow' | 'red' | 'yellow_red'; h?: number }) {
  const card = (c: string, ml = 0) => <span style={{ display: 'inline-block', width: h * 0.72, height: h, background: c, borderRadius: 3, marginLeft: ml, boxShadow: '0 2px 6px rgba(0,0,0,.35)' }} />
  return <span style={{ display: 'inline-flex', flexShrink: 0 }}>{kind === 'yellow_red' ? <>{card(YELLOW)}{card(RED, -8)}</> : card(kind === 'yellow' ? YELLOW : RED)}</span>
}

type EventLine = { key: string; mark: ReactNode; name: string; extra?: string }

/** Události jedné strany jako řádky: góly, asistence, karty, tresty (do limitu). */
function eventLines(side: SideEvents | undefined, tournament: Tournament | null, limit: number): EventLine[] {
  if (!side) return []
  const GoalIcon = getSportDef(tournament?.sport).GoalIcon
  const lines: EventLine[] = [
    ...side.goals.map(g => ({ key: `g${g.player.id}`, mark: <GoalIcon size={28} strokeWidth={2} />, name: g.player.name, extra: g.value > 1 ? `${g.value}×` : undefined })),
    ...side.assists.map(a => ({ key: `a${a.player.id}`, mark: <span style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--brand-2)', color: 'var(--brand-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 20 }}>A</span>, name: a.player.name, extra: a.value > 1 ? `${a.value}×` : undefined })),
    ...side.cards.map((c, i) => ({ key: `c${c.player.id}${i}`, mark: <CardShape kind={c.type} />, name: c.player.name })),
    ...side.penalties.map(p => ({ key: `p${p.player.id}`, mark: <span style={{ background: RED, color: '#fff', borderRadius: 4, padding: '0 6px', fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>{p.value}′</span>, name: p.player.name })),
  ]
  if (lines.length > limit) return [...lines.slice(0, limit - 1), { key: 'more', mark: <span />, name: `+ ${lines.length - limit + 1} další` }]
  return lines
}

function EventColumn({ lines, big }: { lines: EventLine[]; big?: boolean }) {
  if (!lines.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', width: '100%' }}>
      {lines.map(l => (
        <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: big ? 34 : 26, fontWeight: 600, maxWidth: '100%', color: INK }}>
          {l.mark}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{l.name}</span>
          {l.extra && <span style={{ color: MUTED, fontWeight: 700 }}>{l.extra}</span>}
        </div>
      ))}
    </div>
  )
}

export function MatchGraphic({ format, tournament, sponsors, home, away, homeScore, awayScore, label, decidedIn, live, events }: {
  format: ShareFormat
  tournament: Tournament | null
  sponsors: Sponsor[]
  home?: Team
  away?: Team
  homeScore: number
  awayScore: number
  label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
  live?: boolean
  events?: { home: SideEvents; away: SideEvents }
}) {
  const story = format === 'story'
  const hasEvents = !!events && [events.home, events.away].some(e => e.goals.length + e.assists.length + e.cards.length + e.penalties.length > 0)
  const logo = story ? (hasEvents ? 220 : 300) : (hasEvents ? 170 : 230)
  const limit = story ? 6 : 4
  const suffix = decidedIn === 'ot' ? 'po prodloužení' : decidedIn === 'so' ? 'po nájezdech' : ''
  const team = (t: Team | undefined, won: boolean, side?: SideEvents) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: hasEvents ? 20 : 28, width: story ? 760 : 330 }}>
      <Logo team={t} size={logo} />
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1, textAlign: 'center', textTransform: 'uppercase', opacity: won ? 1 : .72 }}>{t?.name ?? '—'}</div>
      {hasEvents && <EventColumn lines={eventLines(side, tournament, limit)} big={story} />}
    </div>
  )
  return (
    <Frame format={format} tournament={tournament} kicker={`${live ? 'Průběžný stav' : 'Výsledek'} · ${label}`} sponsors={sponsors}>
      <div style={{ display: 'flex', alignItems: story || !hasEvents ? 'center' : 'flex-start', justifyContent: 'space-between', flexDirection: story ? 'column' : 'row', gap: story ? 44 : 0 }}>
        {team(home, homeScore >= awayScore, events?.home)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, marginTop: story || !hasEvents ? 0 : logo / 2 - 100 }}>
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
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: live ? RED : MUTED }}>{live ? 'Živě' : 'Konec'}{suffix && !live && ` · ${suffix}`}</div>
        </div>
        {team(away, awayScore >= homeScore, events?.away)}
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

export interface LeaderRow {
  name: string
  team?: Team
  avatar?: string | null
  /** Hlavní hodnota (číslo nebo „12′“) */
  value: string
  /** Karty (Disciplína) — místo čísla se ukážou kartičky */
  cards?: { yellow: number; yellowRed: number; red: number }
}

/** Žebříček (střelci, asistence, body, karty, tresty): TOP 3 na pódiu, pak další řádky. */
export function LeadersGraphic({ format, tournament, sponsors, title, unit, rows }: {
  format: ShareFormat
  tournament: Tournament | null
  sponsors: Sponsor[]
  title: string
  /** Popisek hodnoty, např. „gólů“ */
  unit?: string
  rows: LeaderRow[]
}) {
  const story = format === 'story'
  const top = rows.slice(0, 3)
  const rest = rows.slice(3, story ? 10 : 5)
  const value = (r: LeaderRow, size: number) => r.cards ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {([['yellow', r.cards.yellow], ['yellow_red', r.cards.yellowRed], ['red', r.cards.red]] as const).filter(([, n]) => n > 0).map(([k, n]) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CardShape kind={k} h={size * 0.5} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.55 }}>{n}</span>
        </span>
      ))}
    </div>
  ) : <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1 }}>{r.value}</div>
  const face = (r: LeaderRow, size: number) => r.avatar
    ? <img src={r.avatar} crossOrigin="anonymous" alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,.85)', flexShrink: 0 }} />
    : <Logo team={r.team} size={size} />
  return (
    <Frame format={format} tournament={tournament} kicker={title} sponsors={sponsors}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 22 : 14 }}>
        {top.map((r, i) => {
          const big = i === 0
          const h = story ? (big ? 190 : 160) : (big ? 150 : 124)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, height: h, padding: '0 30px 0 0', background: big ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.05)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ width: 96, alignSelf: 'stretch', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PODIUM[i], color: '#0b1220', fontFamily: DISPLAY, fontWeight: 800, fontSize: big ? 84 : 68, clipPath: 'polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)' }}>{i + 1}</div>
              {face(r, h - 44)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: big ? 50 : 42, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                {r.team && <div style={{ fontSize: 26, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.team.name}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {value(r, big ? 104 : 84)}
                {unit && !r.cards && <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: MUTED }}>{unit}</div>}
              </div>
            </div>
          )
        })}
        {rest.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {rest.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '10px 30px 10px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ width: 96, flexShrink: 0, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, color: MUTED }}>{i + 4}</div>
                <Logo team={r.team} size={52} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 32, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ flexShrink: 0 }}>{value(r, 48)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  )
}
