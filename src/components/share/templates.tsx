// Šablony sdílecích grafik (1080×1080 / 1080×1920). Renderují se mimo obrazovku
// a html-to-image z nich udělá PNG. Styly jsou inline, aby výstup nezávisel na
// okolním layoutu stránky. Barvy turnaje přes CSS proměnné (--brand…, theme.ts).
import type { CSSProperties, ReactNode } from 'react'
import type { Team } from '../../hooks/useTeams'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { StandingRow } from '../../lib/standings'
import { BRAND } from '../../lib/brand'
import { QRCodeSVG } from 'qrcode.react'
import { reachUrl } from '../../lib/partnerReach'
import { getSportDef } from '../../lib/sports'
import { getTitlePartner, sortByTier } from '../../lib/partners'
import type { SideEvents } from '../../lib/details'

export type ShareFormat = 'square' | 'story'
export const FORMAT_SIZE: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story:  { w: 1080, h: 1920 },
}

/** Vizuální styl grafiky (volba v okně sdílení). */
export type ShareStyle = 'dark' | 'brand' | 'light' | 'photo'
export const SHARE_STYLES: { value: ShareStyle; label: string }[] = [
  { value: 'dark', label: 'Tmavý' },
  { value: 'brand', label: 'Barvy turnaje' },
  { value: 'light', label: 'Světlý' },
  { value: 'photo', label: 'Foto' },
]
/** Výchozí styl: fotka turnaje → Foto, Výrazná → barvy turnaje, jinak tmavý. */
export function defaultShareStyle(tournament: Tournament | null): ShareStyle {
  if (tournament?.share_photo_url) return 'photo'
  return tournament?.brand_style === 'bold' ? 'brand' : 'dark'
}

export interface Pal {
  bg: string
  ink: string
  muted: string
  panel: string
  panelStrong: string
  line: string
  /** Popisek nad obsahem (kicker) */
  accent: string
  /** Svislý pruh vlevo */
  stripe: string
  scoreA: { bg: string; ink: string }
  scoreB: { bg: string; ink: string }
  diag: string
  logoShadow: string
}

// Sdílecí šablony mají vlastní paletu (výjimka z pravidla tokenů), barvu turnaje berou z --brand*.
export const PALETTES = {
  dark: {
    bg: 'linear-gradient(160deg, color-mix(in srgb, var(--brand) 24%, #070b14) 0%, color-mix(in srgb, var(--brand) 10%, #0b1220) 58%, #070b14 100%)',
    ink: '#f5f7fa',
    muted: 'rgba(226,232,240,.66)',
    panel: 'rgba(255,255,255,.05)',
    panelStrong: 'rgba(255,255,255,.1)',
    line: 'rgba(255,255,255,.09)',
    accent: 'var(--brand-on-dark)',
    stripe: 'var(--brand)',
    scoreA: { bg: 'var(--brand)', ink: 'var(--brand-ink)' },
    scoreB: { bg: 'rgba(255,255,255,.13)', ink: '#ffffff' },
    diag: 'rgba(255,255,255,.035)',
    logoShadow: '0 10px 40px rgba(0,0,0,.45)',
  },
  brand: {
    // tmavší odstíny barvy turnaje, aby bílý text měl kontrast i u světlé značky
    bg: 'linear-gradient(160deg, color-mix(in srgb, var(--brand) 60%, #000) 0%, color-mix(in srgb, var(--brand) 38%, #000) 100%)',
    ink: '#ffffff',
    muted: 'rgba(255,255,255,.74)',
    panel: 'rgba(0,0,0,.18)',
    panelStrong: 'rgba(0,0,0,.3)',
    line: 'rgba(255,255,255,.14)',
    accent: '#ffffff',
    stripe: 'var(--brand-2)',
    scoreA: { bg: '#ffffff', ink: '#0b1220' },
    scoreB: { bg: 'rgba(0,0,0,.38)', ink: '#ffffff' },
    diag: 'rgba(255,255,255,.06)',
    logoShadow: '0 10px 40px rgba(0,0,0,.4)',
  },
  light: {
    bg: 'linear-gradient(160deg, #ffffff 0%, #eef2f7 100%)',
    ink: '#0b1220',
    muted: 'rgba(11,18,32,.6)',
    panel: 'rgba(11,18,32,.04)',
    panelStrong: 'rgba(11,18,32,.08)',
    line: 'rgba(11,18,32,.1)',
    accent: 'color-mix(in srgb, var(--brand) 85%, #000)',
    stripe: 'var(--brand)',
    scoreA: { bg: 'var(--brand)', ink: 'var(--brand-ink)' },
    scoreB: { bg: '#0b1220', ink: '#ffffff' },
    diag: 'rgba(11,18,32,.03)',
    logoShadow: '0 8px 28px rgba(11,18,32,.16)',
  },
} as Record<ShareStyle, Pal>

// Foto: tmavé jako „dark“, panely průsvitně černé, aby text na fotce zůstal čitelný
PALETTES.photo = {
  ...PALETTES.dark,
  bg: 'linear-gradient(160deg, #0b1220 0%, #070b14 100%)',
  panel: 'rgba(0,0,0,.34)',
  panelStrong: 'rgba(0,0,0,.5)',
  line: 'rgba(255,255,255,.14)',
  scoreB: { bg: 'rgba(0,0,0,.55)', ink: '#ffffff' },
  diag: 'rgba(255,255,255,.04)',
  logoShadow: '0 10px 40px rgba(0,0,0,.55)',
}
/** Ztmavení fotky: nahoře (lišta) a dole (partneři) víc, uprostřed míň; jemný nádech barvy turnaje. */
const PHOTO_SHADE = 'linear-gradient(180deg, rgba(5,8,15,.82) 0%, rgba(5,8,15,.58) 30%, rgba(5,8,15,.62) 62%, rgba(5,8,15,.9) 100%), linear-gradient(150deg, color-mix(in srgb, var(--brand) 38%, transparent) 0%, transparent 55%)'

export const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"
export const BODY = "'Inter', system-ui, sans-serif"

/** Velikost písma podle délky textu — dlouhé názvy se zmenší, aby se vešly na 2 řádky. */
export function fitSize(text: string | undefined, base: number): number {
  const n = (text ?? '').length
  if (n <= 14) return base
  if (n <= 22) return Math.round(base * 0.84)
  if (n <= 32) return Math.round(base * 0.7)
  if (n <= 42) return Math.round(base * 0.6)
  return Math.round(base * 0.5)
}

/** Nejvýš 2 řádky, zbytek … */
export const CLAMP2: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

export function Logo({ team, size, pal }: { team?: Team; size: number; pal: Pal }) {
  if (!team) return <div style={{ width: size, height: size }} />
  if (team.logo_url) {
    return (
      <div style={{ width: size, height: size, flexShrink: 0, background: '#fff', borderRadius: size * 0.14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: pal.logoShadow }}>
        <img src={team.logo_url} crossOrigin="anonymous" alt="" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
      </div>
    )
  }
  const words = team.name.split(/\s+/).filter(Boolean)
  const ini = (words.length > 1 ? words[0][0] + words[1][0] : team.name.slice(0, 2)).toUpperCase()
  return (
    <div style={{ width: size, height: size, flexShrink: 0, background: team.color, borderRadius: size * 0.14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.42, boxShadow: pal.logoShadow }}>
      {ini}
    </div>
  )
}

/** Patička s partnery: generální partner jako „presented by“, ostatní v jedné řadě. */
function PartnerFooter({ sponsors, story }: { sponsors: Sponsor[]; story: boolean }) {
  const titleP = getTitlePartner(sponsors)
  const title = titleP?.logo_url ? titleP : null
  const others = sortByTier(sponsors).filter(s => s.logo_url && s.id !== title?.id)
  if (!title && !others.length) return null
  const shown = others.slice(0, story ? 5 : title ? 3 : 5)
  const label: CSSProperties = { fontSize: 18, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5b6678', whiteSpace: 'nowrap' }
  const titleBlock = title && (
    <div style={{ display: 'flex', flexDirection: story ? 'row' : 'column', alignItems: story ? 'center' : 'flex-start', gap: story ? 20 : 6, flexShrink: 0 }}>
      <span style={{ ...label, fontSize: story ? 18 : 14 }}>Presented by</span>
      <img src={title.logo_url} crossOrigin="anonymous" alt={title.name} style={{ height: story ? 92 : 64, maxWidth: story ? 320 : 240, objectFit: 'contain' }} />
      {/* QR akce generálního partnera (modul partner_reach) — sken se počítá jako „Grafiky na sítích“ */}
      {title.reach && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <QRCodeSVG value={reachUrl(title.reach.code, 'social')} size={story ? 96 : 72} fgColor="#0b1220" bgColor="#ffffff" />
          {title.reach.cta && <span style={{ fontSize: story ? 18 : 15, fontWeight: 700, color: '#0b1220', maxWidth: story ? 260 : 180, lineHeight: 1.25 }}>{title.reach.cta}</span>}
        </div>
      )}
    </div>
  )
  const othersBlock = shown.length > 0 && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: story ? 'center' : 'flex-start', gap: 34, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
      {shown.map(p => (
        <img key={p.id} src={p.logo_url} crossOrigin="anonymous" alt={p.name} style={{ height: 54, maxWidth: 150, objectFit: 'contain', flexShrink: 0 }} />
      ))}
    </div>
  )
  if (story) {
    return (
      <footer style={{ position: 'relative', background: '#fff', textShadow: 'none', padding: '30px 72px 34px 88px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {titleBlock}
        {othersBlock}
      </footer>
    )
  }
  return (
    <footer style={{ position: 'relative', background: '#fff', textShadow: 'none', padding: '22px 72px 22px 88px', display: 'flex', alignItems: 'center', gap: 30 }}>
      {titleBlock}
      {title && othersBlock && <div style={{ width: 2, height: 58, background: '#e2e8f0', flexShrink: 0 }} />}
      {othersBlock}
    </footer>
  )
}

/** Společný rám: kompaktní lišta turnaje, popisek, obsah, partneři. */
export function Frame({ format, style, photo, tournament, kicker, kickerAlign = 'left', sponsors, showHeader = true, children }: {
  format: ShareFormat
  style: ShareStyle
  /** Fotka na pozadí (jen styl Foto) */
  photo?: string | null
  tournament: Tournament | null
  kicker?: string
  kickerAlign?: 'left' | 'center'
  sponsors: Sponsor[]
  /** false = šablona si název turnaje vykreslí sama (grafika turnaje) */
  showHeader?: boolean
  children: ReactNode
}) {
  const { w, h } = FORMAT_SIZE[format]
  const pal = PALETTES[style]
  const story = format === 'story'
  const meta = [tournament?.date, tournament?.venue].filter(Boolean).join(' · ')
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: pal.bg, color: pal.ink, fontFamily: BODY, display: 'flex', flexDirection: 'column', textShadow: style === 'photo' && photo ? '0 2px 14px rgba(0,0,0,.7)' : undefined }}>
      {style === 'photo' && photo && (
        <>
          <img src={photo} crossOrigin="anonymous" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: PHOTO_SHADE }} />
        </>
      )}
      {/* diagonální akcent + pruh značky */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent 0 62%, ${pal.diag} 62% 76%, transparent 76%)` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: pal.stripe }} />
      <div style={{ position: 'absolute', top: story ? 66 : 56, right: 72, fontSize: 18, fontWeight: 700, letterSpacing: '.1em', color: pal.muted }}>{BRAND.name}</div>

      {showHeader && (
        <header style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, padding: `${story ? 60 : 50}px 240px 0 88px` }}>
          {tournament?.logo_url && (
            <div style={{ width: 78, height: 78, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: pal.logoShadow }}>
              <img src={tournament.logo_url} crossOrigin="anonymous" alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 36, lineHeight: 1.05, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tournament?.name}</div>
            {meta && <div style={{ fontSize: 21, color: pal.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>}
          </div>
        </header>
      )}

      <main style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px 0 88px' }}>
        {kicker && (
          <div style={{ display: 'flex', justifyContent: kickerAlign === 'center' ? 'center' : 'flex-start', marginBottom: story ? 54 : 34 }}>
            <span style={{ fontSize: story ? 32 : 28, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: pal.accent, whiteSpace: 'nowrap' }}>{kicker}</span>
          </div>
        )}
        {children}
      </main>

      <PartnerFooter sponsors={sponsors} story={story} />
    </div>
  )
}

// Barvy karet a pódia
const YELLOW = '#facc15'
export const RED = '#dc2626'
export const PODIUM = ['#f5b301', '#c3ccd8', '#cd7f32']

function CardShape({ kind, h = 26 }: { kind: 'yellow' | 'red' | 'yellow_red'; h?: number }) {
  const card = (c: string, ml = 0) => <span style={{ display: 'inline-block', width: h * 0.72, height: h, background: c, borderRadius: 3, marginLeft: ml, boxShadow: '0 2px 6px rgba(0,0,0,.35)' }} />
  return <span style={{ display: 'inline-flex', flexShrink: 0 }}>{kind === 'yellow_red' ? <>{card(YELLOW)}{card(RED, -8)}</> : card(kind === 'yellow' ? YELLOW : RED)}</span>
}

type EventLine = { key: string; mark: ReactNode; name: string; extra?: string }

/** Události jedné strany jako řádky: góly, asistence, karty, tresty (do limitu). */
function eventLines(side: SideEvents | undefined, tournament: Tournament | null, limit: number, pal: Pal): EventLine[] {
  if (!side) return []
  const GoalIcon = getSportDef(tournament?.sport).GoalIcon
  const lines: EventLine[] = [
    ...side.goals.map(g => ({ key: `g${g.player.id}`, mark: <GoalIcon size={28} strokeWidth={2} />, name: g.player.name, extra: g.value > 1 ? `${g.value}×` : undefined })),
    ...side.assists.map(a => ({ key: `a${a.player.id}`, mark: <span style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${pal.accent}`, color: pal.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 20 }}>A</span>, name: a.player.name, extra: a.value > 1 ? `${a.value}×` : undefined })),
    ...side.cards.map((c, i) => ({ key: `c${c.player.id}${i}`, mark: <CardShape kind={c.type} />, name: c.player.name })),
    ...side.penalties.map(p => ({ key: `p${p.player.id}`, mark: <span style={{ background: RED, color: '#fff', borderRadius: 4, padding: '0 6px', fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>{p.value}′</span>, name: p.player.name })),
  ]
  if (lines.length > limit) return [...lines.slice(0, limit - 1), { key: 'more', mark: <span />, name: `+ ${lines.length - limit + 1} další` }]
  return lines
}

function EventColumn({ lines, big, pal }: { lines: EventLine[]; big?: boolean; pal: Pal }) {
  if (!lines.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', width: '100%' }}>
      {lines.map(l => (
        <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: big ? 30 : 26, fontWeight: 600, maxWidth: '100%', color: pal.ink }}>
          {l.mark}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{l.name}</span>
          {l.extra && <span style={{ color: pal.muted, fontWeight: 700 }}>{l.extra}</span>}
        </div>
      ))}
    </div>
  )
}

export function MatchGraphic({ format, style = 'dark', photo, tournament, sponsors, home, away, homeScore, awayScore, label, decidedIn, live, upcoming, time, events }: {
  format: ShareFormat
  style?: ShareStyle
  photo?: string | null
  tournament: Tournament | null
  sponsors: Sponsor[]
  home?: Team
  away?: Team
  homeScore: number
  awayScore: number
  label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
  live?: boolean
  upcoming?: boolean
  time?: string | null
  events?: { home: SideEvents; away: SideEvents }
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const hasEvents = !!events && [events.home, events.away].some(e => e.goals.length + e.assists.length + e.cards.length + e.penalties.length > 0)
  const logo = story ? (hasEvents ? 180 : 300) : (hasEvents ? 180 : 250)
  const limit = 4
  const suffix = decidedIn === 'ot' ? 'po prodloužení' : decidedIn === 'so' ? 'po nájezdech' : ''
  const scoreFont = story ? (hasEvents ? 200 : 230) : hasEvents ? 170 : 200
  const scoreW = story ? (hasEvents ? 220 : 250) : hasEvents ? 186 : 214
  const nameBase = story ? 66 : 50
  const team = (t: Team | undefined, won: boolean, side?: SideEvents) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: hasEvents ? 18 : 26, width: story ? 860 : 320 }}>
      <Logo team={t} size={logo} pal={pal} />
      <div style={{ ...CLAMP2, fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(t?.name, nameBase), lineHeight: 1, textAlign: 'center', textTransform: 'uppercase', opacity: won || upcoming ? 1 : .7 }}>{t?.name ?? 'Určí se'}</div>
      {hasEvents && <EventColumn lines={eventLines(side, tournament, limit, pal)} big={story} pal={pal} />}
    </div>
  )
  const status = upcoming ? (time ? `Výkop ${time}` : 'Brzy') : live ? 'Živě' : 'Konec'
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker={`${upcoming ? 'Hrajeme' : live ? 'Průběžný stav' : 'Výsledek'} · ${label}`} kickerAlign="center" sponsors={sponsors}>
      <div style={{ display: 'flex', alignItems: story || !hasEvents ? 'center' : 'flex-start', justifyContent: 'space-between', flexDirection: story ? 'column' : 'row', gap: story ? (hasEvents ? 34 : 46) : 0 }}>
        {team(home, homeScore >= awayScore, events?.home)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, flexShrink: 0, marginTop: story || !hasEvents ? 0 : logo / 2 - scoreFont / 2 - 14 }}>
          {upcoming ? (
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 190 : 160, lineHeight: 1, color: pal.accent }}>VS</div>
          ) : (
            <div style={{ display: 'flex' }}>
              {[homeScore, awayScore].map((v, i) => {
                const c = i === 0 ? pal.scoreA : pal.scoreB
                return (
                  <div key={i} style={{
                    fontFamily: DISPLAY, fontWeight: 800, fontSize: scoreFont, lineHeight: 1, width: scoreW, textAlign: 'center', padding: '16px 0',
                    background: c.bg, color: c.ink,
                    // podpisový motiv platformy — diagonální řez mezi skóre
                    clipPath: i === 0 ? 'polygon(0 0, 100% 0, calc(100% - 30px) 100%, 0 100%)' : 'polygon(30px 0, 100% 0, 100% 100%, 0 100%)',
                    margin: i === 0 ? '0 -8px 0 0' : '0 0 0 -8px',
                  }}>{v}</div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: story ? 32 : 26, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: live ? RED : pal.muted }}>
            {live && <span style={{ width: 16, height: 16, borderRadius: '50%', background: RED }} />}
            {status}{suffix && !live && !upcoming && ` · ${suffix}`}
          </div>
        </div>
        {team(away, awayScore >= homeScore, events?.away)}
      </div>
    </Frame>
  )
}

export function TableGraphic({ format, style = 'dark', photo, tournament, sponsors, groupName, rows, teams, allowDraws }: {
  format: ShareFormat
  style?: ShareStyle
  photo?: string | null
  tournament: Tournament | null
  sponsors: Sponsor[]
  groupName: string
  rows: StandingRow[]
  teams: Team[]
  allowDraws: boolean
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const max = story ? 14 : 8
  const list = rows.slice(0, max)
  // málo týmů = větší řádky, ať tabulka vyplní plochu
  const rowH = Math.min(story ? 130 : 116, Math.floor((story ? 1300 : 640) / Math.max(list.length, 1)))
  const nameFont = rowH >= 100 ? 40 : 36
  const cell: CSSProperties = { width: 86, textAlign: 'center', fontSize: 30, color: pal.muted, fontVariantNumeric: 'tabular-nums' }
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker={`Tabulka · ${groupName}`} sponsors={sponsors}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px 14px', fontSize: 22, fontWeight: 700, letterSpacing: '.12em', color: pal.muted, textTransform: 'uppercase' }}>
        <div style={{ width: 60 }}>#</div>
        <div style={{ flex: 1 }}>Tým</div>
        <div style={{ ...cell, fontSize: 22 }}>Z</div>
        <div style={{ ...cell, fontSize: 22, width: 120 }}>Skóre</div>
        <div style={{ ...cell, fontSize: 22, width: 100 }}>B</div>
      </div>
      {list.map((r, i) => {
        const t = teams.find(x => x.id === r.id)
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', height: rowH, padding: '0 24px', background: i === 0 ? pal.panelStrong : i % 2 ? 'transparent' : pal.panel, borderLeft: `8px solid ${i === 0 ? pal.stripe : 'transparent'}` }}>
            <div style={{ width: 52, fontFamily: DISPLAY, fontWeight: 800, fontSize: 40 }}>{i + 1}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
              <Logo team={t} size={rowH - 26} pal={pal} />
              <div style={{ fontSize: nameFont, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t?.name}</div>
            </div>
            <div style={cell}>{r.played}</div>
            <div style={{ ...cell, width: 120 }}>{r.gf}:{r.ga}</div>
            <div style={{ ...cell, width: 100, fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, color: pal.ink }}>{r.pts}</div>
          </div>
        )
      })}
      {!allowDraws && <div style={{ fontSize: 20, color: pal.muted, marginTop: 14, paddingLeft: 24 }}>Bez remíz — zápasy rozhoduje prodloužení / nájezdy</div>}
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
export function LeadersGraphic({ format, style = 'dark', photo, tournament, sponsors, title, unit, rows }: {
  format: ShareFormat
  style?: ShareStyle
  photo?: string | null
  tournament: Tournament | null
  sponsors: Sponsor[]
  title: string
  /** Popisek hodnoty, např. „gólů“ */
  unit?: string
  rows: LeaderRow[]
}) {
  const pal = PALETTES[style]
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
    ? <img src={r.avatar} crossOrigin="anonymous" alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,.85)', boxShadow: pal.logoShadow, flexShrink: 0 }} />
    : <Logo team={r.team} size={size} pal={pal} />
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker={title} sponsors={sponsors}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 22 : 14 }}>
        {top.map((r, i) => {
          const big = i === 0
          const h = story ? (big ? 190 : 160) : (big ? 150 : 124)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, height: h, padding: '0 30px 0 0', background: big ? pal.panelStrong : pal.panel, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ width: 96, alignSelf: 'stretch', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PODIUM[i], color: '#0b1220', fontFamily: DISPLAY, fontWeight: 800, fontSize: big ? 84 : 68, clipPath: 'polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)' }}>{i + 1}</div>
              {face(r, h - 44)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: big ? 50 : 42, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                {r.team && <div style={{ fontSize: 26, color: pal.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.team.name}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {value(r, big ? 104 : 84)}
                {unit && !r.cards && <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: pal.muted }}>{unit}</div>}
              </div>
            </div>
          )
        })}
        {rest.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {rest.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '10px 30px 10px 0', borderBottom: `1px solid ${pal.line}` }}>
                <div style={{ width: 96, flexShrink: 0, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, color: pal.muted }}>{i + 4}</div>
                <Logo team={r.team} size={52} pal={pal} />
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

/** Pozvánka / přehled turnaje: název jako hlavní prvek, čísla + QR kód na živé výsledky. */
export function TournamentGraphic({ format, style = 'dark', photo, tournament, sponsors, teamCount, matchCount, goalCount, url }: {
  format: ShareFormat
  style?: ShareStyle
  photo?: string | null
  tournament: Tournament | null
  sponsors: Sponsor[]
  teamCount: number
  matchCount: number
  goalCount: number
  url: string
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const meta = [tournament?.date, tournament?.venue].filter(Boolean).join(' · ')
  const tile = (value: number, label: string) => (
    <div style={{ flex: 1, padding: story ? '34px 20px' : '24px 16px', background: pal.panel, borderRadius: 14, textAlign: 'center', borderTop: `6px solid ${pal.stripe}` }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 110 : 84, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: pal.muted, marginTop: 8 }}>{label}</div>
    </div>
  )
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} sponsors={sponsors} showHeader={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 64 : 38 }}>
        <div style={{ display: 'flex', flexDirection: story ? 'column' : 'row', alignItems: story ? 'flex-start' : 'center', gap: story ? 40 : 34 }}>
          {tournament?.logo_url && (
            <div style={{ width: story ? 220 : 170, height: story ? 220 : 170, background: '#fff', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: pal.logoShadow }}>
              <img src={tournament.logo_url} crossOrigin="anonymous" alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: story ? 32 : 26, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: pal.accent }}>Turnaj</div>
            <div style={{ ...CLAMP2, fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(tournament?.name, story ? 118 : 92), lineHeight: .95, textTransform: 'uppercase', marginTop: 8 }}>{tournament?.name}</div>
            {meta && <div style={{ fontSize: story ? 32 : 26, color: pal.muted, marginTop: 14 }}>{meta}</div>}
          </div>
        </div>
        {tournament?.subtitle && (
          <div style={{ ...CLAMP2, fontSize: story ? 40 : 30, fontWeight: 600, lineHeight: 1.25 }}>{tournament.subtitle}</div>
        )}
        <div style={{ display: 'flex', gap: 20 }}>
          {tile(teamCount, 'týmů')}
          {tile(matchCount, 'zápasů')}
          {tile(goalCount, 'gólů')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ background: '#fff', padding: 14, borderRadius: 14, lineHeight: 0, boxShadow: pal.logoShadow }}>
            <QRCodeSVG value={url} size={story ? 240 : 170} fgColor="#0b1220" bgColor="#ffffff" />
          </div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 70 : 56, lineHeight: 1, textTransform: 'uppercase' }}>Sleduj živě</div>
            <div style={{ fontSize: 26, color: pal.muted, marginTop: 10 }}>výsledky, tabulky a statistiky — naskenuj kód</div>
          </div>
        </div>
      </div>
    </Frame>
  )
}

/** Rozměr náhledu odkazu (Open Graph — WhatsApp, Facebook, Teams, LinkedIn…). */
export const OG_SIZE = { w: 1200, h: 630 }

/**
 * Náhled odkazu na turnaj 1200×630. Vytváří se v prohlížeči organizátora a nahrává
 * do Storage (OgImageSync) — server ho jen odkáže v og:image, nic nevykresluje.
 */
export function OgGraphic({ tournament, sponsors }: { tournament: Tournament | null; sponsors: Sponsor[] }) {
  const pal = PALETTES.dark
  const { w, h } = OG_SIZE
  const meta = [tournament?.date, tournament?.venue].filter(Boolean).join(' · ')
  const titleP = getTitlePartner(sponsors)
  const sport = getSportDef(tournament?.sport).label
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: pal.bg, color: pal.ink, fontFamily: BODY, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent 0 62%, ${pal.diag} 62% 76%, transparent 76%)` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: pal.stripe }} />
      <div style={{ position: 'absolute', top: 40, right: 60, fontSize: 20, fontWeight: 700, letterSpacing: '.1em', color: pal.muted }}>{BRAND.name}</div>

      <main style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 48, padding: '0 70px 0 96px' }}>
        {tournament?.logo_url && (
          <div style={{ width: 230, height: 230, background: '#fff', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: pal.logoShadow }}>
            <img src={tournament.logo_url} crossOrigin="anonymous" alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: pal.accent, whiteSpace: 'nowrap' }}>{sport} · Živé výsledky</div>
          <div style={{ ...CLAMP2, fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(tournament?.name, tournament?.logo_url ? 92 : 104), lineHeight: .95, textTransform: 'uppercase', marginTop: 12 }}>{tournament?.name}</div>
          {tournament?.subtitle && <div style={{ fontSize: 30, fontWeight: 600, marginTop: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tournament.subtitle}</div>}
          {meta && <div style={{ fontSize: 28, color: pal.muted, marginTop: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>}
        </div>
      </main>

      {titleP?.logo_url ? (
        <footer style={{ position: 'relative', background: '#fff', padding: '18px 70px 18px 96px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5b6678', whiteSpace: 'nowrap' }}>Presented by</span>
          <img src={titleP.logo_url} crossOrigin="anonymous" alt={titleP.name} style={{ height: 60, maxWidth: 300, objectFit: 'contain' }} />
        </footer>
      ) : (
        <div style={{ position: 'relative', height: 12, background: pal.stripe }} />
      )}
    </div>
  )
}
