// Další sdílecí grafiky (Vlna 1, bod 3): program dne, souhrn dne, vítěz, konečné pořadí,
// hráč zápasu a nejlepší sestava. Stejný rám, palety a styly jako templates.tsx.
import type { CSSProperties } from 'react'
import { Trophy } from 'lucide-react'
import type { Team } from '../../hooks/useTeams'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { PlaceRow } from '../../lib/finalStandings'
import { placeLabel } from '../../lib/finalStandings'
import type { BestTeam, BestTeamEntry } from '../../lib/bestTeam'
import { CLAMP2, DISPLAY, Frame, Logo, PALETTES, PODIUM, fitSize, type Pal, type ShareFormat, type ShareStyle } from './templates'

interface Common {
  format: ShareFormat
  style?: ShareStyle
  photo?: string | null
  tournament: Tournament | null
  sponsors: Sponsor[]
}

const GOLD = '#f5b301'
const SUFFIX: Record<string, string> = { ot: 'PP', so: 'SN' }

/** Kruhová fotka hráče, jinak logo týmu. */
function Face({ avatar, team, size, pal }: { avatar?: string | null; team?: Team; size: number; pal: Pal }) {
  if (avatar) {
    return <img src={avatar} crossOrigin="anonymous" alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `${Math.max(3, size / 40)}px solid rgba(255,255,255,.9)`, boxShadow: pal.logoShadow, flexShrink: 0 }} />
  }
  return <Logo team={team} size={size} pal={pal} />
}

// ── Program dne / Souhrn dne ─────────────────────────────────────────────

export interface DayRow {
  key: string
  home?: Team
  away?: Team
  homeScore: number
  awayScore: number
  played: boolean
  time: string | null
  label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
}

/** Počet zápasů na jednu grafiku (víc zápasů = více stran). */
export const DAY_PER_PAGE = 8

export function DayGraphic({ format, style = 'dark', photo, tournament, sponsors, mode, dayLabel, rows, page, pages }: Common & {
  mode: 'program' | 'summary'
  /** „Sobota 1. 11.“ nebo prázdné u jednodenního turnaje */
  dayLabel: string
  rows: DayRow[]
  page: number
  pages: number
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const rowH = story ? 136 : 80
  const logo = story ? 76 : 50
  const nameFont = story ? 38 : 29
  const kicker = [mode === 'program' ? 'Program' : 'Výsledky dne', dayLabel, pages > 1 ? `${page}/${pages}` : ''].filter(Boolean).join(' · ')
  const name: CSSProperties = { fontSize: nameFont, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker={kicker} sponsors={sponsors}>
      {rows.length === 0 && (
        <div style={{ fontSize: story ? 44 : 36, color: pal.muted, textAlign: 'center' }}>
          {mode === 'program' ? 'Program zatím není zveřejněný' : 'Zatím žádné odehrané zápasy'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 14 : 8 }}>
        {rows.map((r, i) => {
          const showScore = mode === 'summary' || r.played
          const homeWon = r.played && r.homeScore > r.awayScore
          const awayWon = r.played && r.awayScore > r.homeScore
          if (story) {
            // Na výšku: domácí a hosté pod sebou, skóre vpravo — dlouhé názvy se vejdou
            const side = (t: Team | undefined, score: number, won: boolean) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: r.played && !won ? .72 : 1 }}>
                <Logo team={t} size={54} pal={pal} />
                <div style={{ ...name, flex: 1, fontSize: 38 }}>{t?.name ?? 'Určí se'}</div>
                {showScore && (
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, lineHeight: 1, minWidth: 64, textAlign: 'center', padding: '4px 10px', borderRadius: 6, background: won ? pal.scoreA.bg : pal.scoreB.bg, color: won ? pal.scoreA.ink : pal.scoreB.ink }}>{score}</span>
                )}
              </div>
            )
            return (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '16px 22px', background: i % 2 ? pal.panel : pal.panelStrong, borderRadius: 12 }}>
                <div style={{ width: 140, flexShrink: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, lineHeight: 1 }}>{r.time || '—'}</div>
                  {r.label && <div style={{ fontSize: 20, color: pal.muted, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>}
                  {showScore && r.decidedIn && SUFFIX[r.decidedIn] && <div style={{ fontSize: 20, fontWeight: 800, color: pal.muted, letterSpacing: '.1em', marginTop: 4 }}>{SUFFIX[r.decidedIn]}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {side(r.home, r.homeScore, homeWon)}
                  {side(r.away, r.awayScore, awayWon)}
                </div>
              </div>
            )
          }
          return (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: story ? 18 : 14, height: rowH, padding: story ? '0 22px' : '0 16px', background: i % 2 ? pal.panel : pal.panelStrong, borderRadius: 12 }}>
              <div style={{ width: story ? 128 : 96, flexShrink: 0 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 44 : 32, lineHeight: 1 }}>{r.time || '—'}</div>
                {r.label && <div style={{ fontSize: story ? 20 : 15, color: pal.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, minWidth: 0, opacity: r.played && !homeWon ? .72 : 1 }}>
                <div style={{ ...name, textAlign: 'right' }}>{r.home?.name ?? 'Určí se'}</div>
                <Logo team={r.home} size={logo} pal={pal} />
              </div>
              <div style={{ width: story ? 168 : 128, flexShrink: 0, textAlign: 'center' }}>
                {showScore ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 58 : 44, lineHeight: 1 }}>
                    <span style={{ background: homeWon ? pal.scoreA.bg : pal.scoreB.bg, color: homeWon ? pal.scoreA.ink : pal.scoreB.ink, padding: '4px 12px', borderRadius: 6, minWidth: story ? 58 : 44 }}>{r.homeScore}</span>
                    <span style={{ background: awayWon ? pal.scoreA.bg : pal.scoreB.bg, color: awayWon ? pal.scoreA.ink : pal.scoreB.ink, padding: '4px 12px', borderRadius: 6, minWidth: story ? 58 : 44 }}>{r.awayScore}</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 40 : 30, color: pal.accent }}>VS</span>
                )}
                {showScore && r.decidedIn && SUFFIX[r.decidedIn] && (
                  <div style={{ fontSize: story ? 18 : 14, fontWeight: 800, color: pal.muted, letterSpacing: '.1em', marginTop: 2 }}>{SUFFIX[r.decidedIn]}</div>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, opacity: r.played && !awayWon ? .72 : 1 }}>
                <Logo team={r.away} size={logo} pal={pal} />
                <div style={name}>{r.away?.name ?? 'Určí se'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

// ── Vítěz turnaje ────────────────────────────────────────────────────────

export function ChampionGraphic({ format, style = 'dark', photo, tournament, sponsors, champion, runnerUp, finalScore }: Common & {
  champion?: Team
  runnerUp?: Team
  /** „3:2 PP“; u ligy chybí */
  finalScore?: string
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const logo = story ? 440 : 300
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} sponsors={sponsors}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: story ? 40 : 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: GOLD }}>
          <Trophy size={story ? 76 : 56} strokeWidth={2} />
          <span style={{ fontSize: story ? 40 : 32, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase' }}>Vítěz turnaje</span>
          <Trophy size={story ? 76 : 56} strokeWidth={2} />
        </div>
        <div style={{ position: 'relative', padding: story ? 26 : 18, borderRadius: '50%', background: `radial-gradient(circle, ${GOLD}55 0%, transparent 70%)` }}>
          <Logo team={champion} size={logo} pal={pal} />
        </div>
        <div style={{ ...CLAMP2, fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(champion?.name, story ? 150 : 112), lineHeight: .95, textTransform: 'uppercase', maxWidth: '100%' }}>
          {champion?.name}
        </div>
        {finalScore && runnerUp && (
          <div style={{ fontSize: story ? 38 : 30, color: pal.muted, fontWeight: 600 }}>
            Finále <span style={{ fontFamily: DISPLAY, fontWeight: 800, color: pal.ink, fontSize: '1.25em' }}>{finalScore}</span> proti {runnerUp.name}
          </div>
        )}
        {!finalScore && <div style={{ fontSize: story ? 36 : 28, color: pal.muted, fontWeight: 600 }}>Konečná tabulka · 1. místo</div>}
      </div>
    </Frame>
  )
}

// ── Konečné pořadí ───────────────────────────────────────────────────────

export function FinalStandingsGraphic({ format, style = 'dark', photo, tournament, sponsors, rows }: Common & { rows: PlaceRow[] }) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const top = rows.filter(r => r.from <= 3 && r.from === r.to).slice(0, 3)
  const rest = rows.filter(r => !top.includes(r)).slice(0, story ? 10 : 5)
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker="Konečné pořadí" sponsors={sponsors}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 20 : 12 }}>
        {top.map((r, i) => {
          const big = i === 0
          const h = story ? (big ? 200 : 168) : (big ? 140 : 112)
          return (
            <div key={r.team.id} style={{ display: 'flex', alignItems: 'center', gap: 26, height: h, paddingRight: 30, background: big ? pal.panelStrong : pal.panel, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ width: 110, alignSelf: 'stretch', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PODIUM[i], color: '#0b1220', fontFamily: DISPLAY, fontWeight: 800, fontSize: big ? 84 : 66, clipPath: 'polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)' }}>{r.from}.</div>
              <Logo team={r.team} size={h - 40} pal={pal} />
              <div style={{ flex: 1, minWidth: 0, ...CLAMP2, fontFamily: DISPLAY, fontWeight: 800, fontSize: big ? (story ? 70 : 56) : (story ? 56 : 44), lineHeight: 1, textTransform: 'uppercase' }}>{r.team.name}</div>
              {big && <Trophy size={story ? 84 : 64} color={GOLD} strokeWidth={2} style={{ flexShrink: 0 }} />}
            </div>
          )
        })}
        {rest.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
            {rest.map(r => (
              <div key={r.team.id} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: story ? '14px 30px 14px 0' : '9px 30px 9px 0', borderBottom: `1px solid ${pal.line}` }}>
                <div style={{ width: 110, flexShrink: 0, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 42 : 34, color: pal.muted, whiteSpace: 'nowrap' }}>{placeLabel(r)}</div>
                <Logo team={r.team} size={story ? 64 : 48} pal={pal} />
                <div style={{ flex: 1, minWidth: 0, fontSize: story ? 38 : 30, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.team.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  )
}

// ── Hráč zápasu ──────────────────────────────────────────────────────────

export function MvpGraphic({ format, style = 'dark', photo, tournament, sponsors, name, number, avatar, team, goals, assists, label, home, away, homeScore, awayScore, decidedIn }: Common & {
  name: string
  number?: number | null
  avatar?: string | null
  team?: Team
  goals: number
  assists: number
  label: string
  home?: Team
  away?: Team
  homeScore: number
  awayScore: number
  decidedIn?: 'regulation' | 'ot' | 'so' | null
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const face = story ? 460 : 300
  const stat = (v: number, l: string) => (
    <div style={{ padding: story ? '22px 40px' : '14px 30px', background: pal.panelStrong, borderRadius: 14, textAlign: 'center', borderTop: `6px solid ${pal.stripe}` }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 96 : 70, lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: story ? 24 : 20, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: pal.muted, marginTop: 6 }}>{l}</div>
    </div>
  )
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker={`Hráč zápasu · ${label}`} kickerAlign="center" sponsors={sponsors}>
      <div style={{ display: 'flex', flexDirection: story ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: story ? 44 : 56, textAlign: story ? 'center' : 'left' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Face avatar={avatar} team={team} size={face} pal={pal} />
          {number != null && (
            <div style={{ position: 'absolute', right: -8, bottom: 8, background: pal.scoreA.bg, color: pal.scoreA.ink, fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 72 : 52, lineHeight: 1, padding: '8px 18px', borderRadius: 10, boxShadow: pal.logoShadow }}>{number}</div>
          )}
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: story ? 'center' : 'flex-start', gap: story ? 26 : 18 }}>
          <div style={{ ...CLAMP2, fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(name, story ? 130 : 96), lineHeight: .95, textTransform: 'uppercase' }}>{name}</div>
          {team && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: story ? 36 : 28, fontWeight: 600, color: pal.muted }}>
              <Logo team={team} size={story ? 56 : 44} pal={pal} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: story ? 760 : 420 }}>{team.name}</span>
            </div>
          )}
          {(goals > 0 || assists > 0) && (
            <div style={{ display: 'flex', gap: 16 }}>
              {goals > 0 && stat(goals, goals === 1 ? 'gól' : goals < 5 ? 'góly' : 'gólů')}
              {assists > 0 && stat(assists, assists === 1 ? 'asistence' : 'asistence')}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: story ? 70 : 40, fontSize: story ? 32 : 26, fontWeight: 700 }}>
        <Logo team={home} size={story ? 56 : 44} pal={pal} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: story ? 300 : 280 }}>{home?.name}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '1.5em', padding: '0 10px' }}>{homeScore}:{awayScore}{decidedIn && SUFFIX[decidedIn] ? ` ${SUFFIX[decidedIn]}` : ''}</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: story ? 300 : 280 }}>{away?.name}</span>
        <Logo team={away} size={story ? 56 : 44} pal={pal} />
      </div>
    </Frame>
  )
}

// ── Nejlepší sestava ─────────────────────────────────────────────────────

/** Rozestavení: řady odshora (útok → obrana), brankář zvlášť dole. */
function formation(n: number): number[] {
  if (n <= 2) return [n]
  if (n === 4) return [2, 2]
  if (n === 5) return [3, 2]
  return [Math.ceil(n / 2), Math.floor(n / 2)]
}

export function BestTeamGraphic({ format, style = 'dark', photo, tournament, sponsors, title, team, hockey }: Common & {
  /** „Tým turnaje“ / „Tým kola · 5. kolo“ */
  title: string
  team: BestTeam
  hockey: boolean
}) {
  const pal = PALETTES[style]
  const story = format === 'story'
  const card = story ? 150 : 112
  const lines = formation(team.field.length)
  // nejlepší hráči vpředu
  let i = 0
  const rows = lines.map(c => team.field.slice(i, (i += c)))
  const statText = (e: BestTeamEntry) => {
    if (e.keeper) return `${(e.keeper.against / e.keeper.games).toFixed(1).replace('.', ',')} obdržených / zápas`
    return [e.goals ? `${e.goals} G` : '', e.assists ? `${e.assists} A` : '', e.mvp ? `${e.mvp}× MVP` : ''].filter(Boolean).join(' · ')
  }
  const Player = ({ e }: { e: BestTeamEntry }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: story ? 300 : 230, gap: 8, textAlign: 'center' }}>
      <Face avatar={e.player.avatar_url} team={e.team} size={card} pal={pal} />
      <div style={{ ...CLAMP2, fontSize: story ? 34 : 26, fontWeight: 800, lineHeight: 1.1, maxWidth: '100%' }}>{e.player.name}</div>
      <div style={{ fontSize: story ? 22 : 17, color: pal.muted, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.team?.name}</div>
      {statText(e) && <div style={{ fontSize: story ? 22 : 17, fontWeight: 800, color: pal.accent, letterSpacing: '.04em' }}>{statText(e)}</div>}
    </div>
  )
  return (
    <Frame format={format} style={style} photo={photo} tournament={tournament} kicker={title} sponsors={sponsors}>
      <div style={{
        position: 'relative', flex: story ? undefined : 1, minHeight: story ? 1180 : 0, maxHeight: story ? undefined : 720,
        border: `3px solid ${pal.line}`, borderRadius: hockey ? 120 : 18, background: pal.panel,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: story ? '40px 20px' : '18px 10px', overflow: 'hidden',
      }}>
        {/* čáry hřiště */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 3, background: pal.line }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: story ? 260 : 180, height: story ? 260 : 180, marginLeft: story ? -130 : -90, marginTop: story ? -130 : -90, border: `3px solid ${pal.line}`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 0, width: story ? 420 : 320, height: story ? 110 : 64, marginLeft: story ? -210 : -160, border: `3px solid ${pal.line}`, borderBottom: 'none' }} />
        {rows.map((r, ri) => (
          <div key={ri} style={{ position: 'relative', display: 'flex', justifyContent: 'space-evenly' }}>
            {r.map(e => <Player key={e.player.id} e={e} />)}
          </div>
        ))}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          {team.goalkeeper ? <Player e={team.goalkeeper} /> : <div style={{ fontSize: 22, color: pal.muted }}>Brankář neurčen</div>}
        </div>
      </div>
    </Frame>
  )
}
