import { useEffect, useState } from 'react'
import { calcGroupStandings } from '../../lib/standings'
import QRCode from '../ui/QRCode'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'

interface Props {
  tournament: Tournament | null
  teams: Team[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  onExit: () => void
}

// ── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#f0f4ff',
  col:     '#ffffff',
  hdr:     '#2563eb',
  hdr2:    '#1d4ed8',
  text:    '#0f172a',
  muted:   '#64748b',
  accent:  '#2563eb',
  border:  'rgba(37,99,235,.1)',
  success: '#16a34a',
  gold:    '#d97706',
}

// ── fluid sizes ───────────────────────────────────────────────────────────────
const S = {
  title:   'clamp(1.3rem, 2.2vw, 2.8rem)',
  section: 'clamp(.9rem, 1.4vw, 1.8rem)',
  body:    'clamp(.78rem, 1.1vw, 1.35rem)',
  small:   'clamp(.65rem, .9vw, 1.05rem)',
  score:   'clamp(1.5rem, 3vw, 3.8rem)',
  pts:     'clamp(1.1rem, 1.8vw, 2.2rem)',
  label:   'clamp(.58rem, .8vw, .9rem)',
}

function useClock() {
  const fmt = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 10_000)
    return () => clearInterval(id)
  }, [])
  return t
}

// ── Standings column ──────────────────────────────────────────────────────────
function StandingsCol({ groups, matches, teams }: { groups: Group[]; matches: Match[]; teams: Team[] }) {
  const gt = (id: string) => teams.find(t => t.id === id)

  if (!groups.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: S.body }}>
      Žádné skupiny
    </div>
  )

  return (
    <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
      {groups.map(group => {
        const rows = calcGroupStandings(group, matches)
        return (
          <div key={group.id}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: S.section,
              letterSpacing: '.1em',
              color: C.accent,
              marginBottom: '.5rem',
              paddingBottom: '.3rem',
              borderBottom: `1px solid ${C.border}`,
            }}>
              {group.name}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Tým', 'Z', 'V', 'R', 'P', 'Sk', 'B'].map((h, i) => (
                    <th key={h} style={{
                      fontSize: S.label,
                      textTransform: 'uppercase', letterSpacing: '.1em',
                      color: C.muted,
                      textAlign: i <= 1 ? 'left' : 'center',
                      padding: '.2rem .35rem',
                      fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const team = gt(row.id)
                  const isTop = i === 0
                  return (
                    <tr key={row.id} style={{ background: isTop ? 'rgba(59,130,246,.1)' : 'transparent' }}>
                      <td style={{ padding: '.28rem .35rem', textAlign: 'center', color: C.muted, fontSize: S.small }}>{i + 1}</td>
                      <td style={{ padding: '.28rem .35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {team && <span style={{ width: 8, height: 8, borderRadius: '50%', background: team.color, flexShrink: 0, display: 'inline-block' }} />}
                          <span style={{
                            fontSize: S.body, fontWeight: isTop ? 700 : 500,
                            color: C.text,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {team?.name ?? row.id}
                          </span>
                        </div>
                      </td>
                      {[row.played, row.w, row.d, row.l].map((v, j) => (
                        <td key={j} style={{ textAlign: 'center', padding: '.28rem .35rem', fontSize: S.small, color: C.muted }}>{v}</td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '.28rem .35rem', fontSize: S.small, color: C.muted }}>{row.gf}:{row.ga}</td>
                      <td style={{ textAlign: 'center', padding: '.28rem .35rem' }}>
                        <span style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: S.pts,
                          color: isTop ? C.accent : C.text,
                        }}>{row.pts}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ── Matches column ────────────────────────────────────────────────────────────
function MatchesCol({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tc = (id: string) => teams.find(t => t.id === id)?.color ?? '#94a3b8'

  if (!matches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: S.body }}>
      Žádné zápasy
    </div>
  )

  const rounds: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Bez skupiny'
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(m)
  }

  return (
    <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
      {Object.entries(rounds).map(([round, ms]) => (
        <div key={round}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: S.label,
            letterSpacing: '.18em',
            color: C.muted,
            textTransform: 'uppercase',
            marginBottom: '.4rem',
            paddingBottom: '.25rem',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {round}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
            {ms.map(m => {
              const hw = m.played && m.home_score > m.away_score
              const aw = m.played && m.away_score > m.home_score
              return (
                <div key={m.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '.5rem',
                  padding: '.4rem .7rem',
                  borderRadius: 8,
                  background: m.played ? C.col : '#eff6ff',
                  border: `1px solid ${C.border}`,
                  boxShadow: '0 1px 3px rgba(37,99,235,.06)',
                }}>
                  {/* Home */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.4rem', minWidth: 0 }}>
                    <span style={{
                      fontSize: S.body, fontWeight: hw ? 700 : 400,
                      color: hw ? C.text : C.muted,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{tn(m.home_id)}</span>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: tc(m.home_id), flexShrink: 0, display: 'inline-block' }} />
                  </div>

                  {/* Score / VS */}
                  <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(4rem, 7vw, 9rem)' }}>
                    {m.played ? (
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: S.score,
                        color: C.text,
                        letterSpacing: '.06em',
                        lineHeight: 1,
                      }}>
                        {m.home_score}:{m.away_score}
                      </span>
                    ) : (
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.section, color: C.muted }}>VS</div>
                        {m.scheduled_time && (
                          <div style={{ fontSize: S.small, color: C.accent, marginTop: 2 }}>{m.scheduled_time}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Away */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: tc(m.away_id), flexShrink: 0, display: 'inline-block' }} />
                    <span style={{
                      fontSize: S.body, fontWeight: aw ? 700 : 400,
                      color: aw ? C.text : C.muted,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{tn(m.away_id)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Bracket column ────────────────────────────────────────────────────────────
function BracketCol({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => (id ? teams.find(t => t.id === id) : null)

  if (!rounds.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: S.body }}>
      Pavouk není nastaven
    </div>
  )

  const sorted = [...rounds].sort((a, b) => a.position - b.position)
  const UNIT = 58

  return (
    <div style={{ padding: '1rem 1rem', overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
        {sorted.map((round, ri) => {
          const roundSlots = [...slots]
            .filter(s => s.round_id === round.id)
            .sort((a, b) => a.position - b.position)
          const slotH = UNIT * Math.pow(2, ri)
          const isFinal = ri === sorted.length - 1

          return (
            <div key={round.id} style={{ display: 'flex' }}>
              {/* Round column */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 150 }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: S.label,
                  letterSpacing: '.14em',
                  color: C.muted,
                  textAlign: 'center',
                  paddingBottom: '.35rem',
                  borderBottom: `1px solid ${C.border}`,
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                }}>
                  {round.name}
                </div>
                {roundSlots.map(slot => {
                  const hT = gt(slot.home_id), aT = gt(slot.away_id)
                  const hw = slot.played && slot.home_score > slot.away_score
                  const aw = slot.played && slot.away_score > slot.home_score
                  const sides = [
                    { team: hT, score: slot.home_score, win: hw },
                    { team: aT, score: slot.away_score, win: aw },
                  ]
                  return (
                    <div key={slot.id} style={{ display: 'flex', alignItems: 'center', height: slotH, padding: '4px 3px' }}>
                      <div style={{
                        background: C.col,
                        border: `1px solid ${isFinal ? 'rgba(245,158,11,.35)' : C.border}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                        width: 144,
                      }}>
                        {sides.map((side, si) => (
                          <div key={si} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '.3rem .55rem',
                            borderBottom: si === 0 ? `1px solid ${C.border}` : 'none',
                            background: side.win
                              ? (isFinal ? 'rgba(217,119,6,.1)' : 'rgba(37,99,235,.1)')
                              : 'transparent',
                          }}>
                            <span style={{
                              fontSize: S.small,
                              color: side.team
                                ? (side.win ? (isFinal ? C.gold : C.accent) : C.text)
                                : C.muted,
                              fontStyle: side.team ? 'normal' : 'italic',
                              fontWeight: side.win ? 700 : 400,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 95,
                            }}>
                              {side.team?.name ?? 'TBD'}
                            </span>
                            {slot.played && (
                              <span style={{
                                fontFamily: "'Bebas Neue', sans-serif",
                                fontSize: S.body,
                                color: side.win ? (isFinal ? C.gold : C.accent) : C.muted,
                                marginLeft: 5,
                              }}>
                                {side.score}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Connector lines */}
              {ri < sorted.length - 1 && (
                <div style={{ width: 20, flexShrink: 0 }}>
                  {Array.from({ length: Math.ceil(roundSlots.length / 2) }, (_, p) => (
                    <div key={p} style={{ height: slotH * 2, position: 'relative' }}>
                      <div style={{ position: 'absolute', right: 0, top: '25%', height: '50%', width: 1, background: 'rgba(37,99,235,.2)' }} />
                      <div style={{ position: 'absolute', right: 0, top: '50%', width: '100%', height: 1, background: 'rgba(37,99,235,.2)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Scoreboard ───────────────────────────────────────────────────────────
export default function Scoreboard({ tournament, teams, groups, matches, bracketRounds, bracketSlots, onExit }: Props) {
  const clock = useClock()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit])

  const cols = [
    { icon: '📊', label: 'Skupiny — tabulky' },
    { icon: '⚽', label: 'Zápasy — rozpis & výsledky' },
    { icon: '🏆', label: 'Play-off — pavouk' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      color: C.text,
    }}>
      {/* ── top header bar ── */}
      <div style={{
        height: 'clamp(48px, 6vh, 72px)',
        background: C.hdr,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 1.5rem',
        gap: '1.5rem',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: S.title,
          letterSpacing: '.1em',
          color: '#ffffff',
          flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: '0 1px 4px rgba(0,0,0,.2)',
        }}>
          {tournament?.name || 'Firemní turnaj'}
        </span>

        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: S.title,
          color: '#bfdbfe',
          letterSpacing: '.1em',
          flexShrink: 0,
        }}>
          {clock}
        </span>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.9)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Sdílet</div>
            <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.5)' }}>naskenuj QR</div>
          </div>
          <QRCode size={48} />
        </div>

        <button
          onClick={onExit}
          style={{
            background: 'rgba(255,255,255,.15)',
            border: '1px solid rgba(255,255,255,.35)',
            borderRadius: 8,
            color: '#ffffff',
            fontSize: S.label,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            padding: '.35rem .9rem',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '.4rem',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.28)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.15)' }}
        >
          ✕ Zavřít
        </button>
      </div>

      {/* ── column sub-headers ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '27% 46% 27%',
        borderBottom: `2px solid ${C.border}`,
        background: '#eff6ff',
        flexShrink: 0,
      }}>
        {cols.map(({ icon, label }, i) => (
          <div key={i} style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: S.label,
            letterSpacing: '.16em',
            color: C.accent,
            textTransform: 'uppercase',
            padding: '.42rem 1.2rem',
            borderLeft: i > 0 ? `1px solid rgba(37,99,235,.15)` : 'none',
          }}>
            {icon} {label}
          </div>
        ))}
      </div>

      {/* ── 3-column content ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '27% 46% 27%',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <div style={{ background: C.col, borderRight: `1px solid ${C.border}`, overflowY: 'auto', boxShadow: '2px 0 8px rgba(37,99,235,.06)' }}>
          <StandingsCol groups={groups} matches={matches} teams={teams} />
        </div>
        <div style={{ background: '#f8faff', overflowY: 'auto' }}>
          <MatchesCol matches={matches} teams={teams} />
        </div>
        <div style={{ background: C.col, borderLeft: `1px solid ${C.border}`, overflow: 'auto', boxShadow: '-2px 0 8px rgba(37,99,235,.06)' }}>
          <BracketCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
        </div>
      </div>
    </div>
  )
}
