import { useEffect, useState } from 'react'
import { calcGroupStandings } from '../../lib/standings'
import QRCode from '../ui/QRCode'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'

interface Props {
  tournament: Tournament | null
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  goals: Goal[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  onExit: () => void
}

// ── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#f0f4ff',
  col:     '#ffffff',
  hdr:     '#2563eb',
  text:    '#0f172a',
  muted:   '#64748b',
  accent:  '#2563eb',
  border:  'rgba(37,99,235,.1)',
  success: '#16a34a',
  gold:    '#d97706',
  bronze:  '#92400e',
}

// ── fluid sizes ───────────────────────────────────────────────────────────────
const S = {
  title:   'clamp(1.3rem, 2.2vw, 2.8rem)',
  section: 'clamp(.75rem, 1.1vw, 1.4rem)',
  body:    'clamp(.65rem, .95vw, 1.15rem)',
  small:   'clamp(.58rem, .78vw, .92rem)',
  score:   'clamp(.9rem, 1.4vw, 1.7rem)',
  pts:     'clamp(.9rem, 1.3vw, 1.6rem)',
  label:   'clamp(.52rem, .7vw, .82rem)',
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

// ── Standings + Scorers column ────────────────────────────────────────────────
function StandingsCol({ groups, matches, teams, players, goals }: {
  groups: Group[]; matches: Match[]; teams: Team[]; players: Player[]; goals: Goal[]
}) {
  const gt = (id: string) => teams.find(t => t.id === id)

  // Top 5 scorers
  const scorers = players
    .map(p => ({
      name: p.name,
      team: teams.find(t => t.id === p.team_id),
      total: goals.filter(g => g.player_id === p.id).reduce((s, g) => s + g.count, 0),
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return (
    <div style={{ padding: '.7rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', boxSizing: 'border-box' }}>
      {/* Group standings */}
      {groups.length === 0 ? (
        <div style={{ color: C.muted, fontSize: S.body }}>Žádné skupiny</div>
      ) : (
        groups.map(group => {
          const rows = calcGroupStandings(group, matches)
          return (
            <div key={group.id}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: S.section,
                letterSpacing: '.1em',
                color: C.accent,
                marginBottom: '.35rem',
                paddingBottom: '.2rem',
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
                        padding: '.15rem .28rem',
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
                        <td style={{ padding: '.18rem .28rem', textAlign: 'center', color: C.muted, fontSize: S.label }}>{i + 1}</td>
                        <td style={{ padding: '.18rem .28rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {team && <span style={{ width: 7, height: 7, borderRadius: '50%', background: team.color, flexShrink: 0, display: 'inline-block' }} />}
                            <span style={{ fontSize: S.body, fontWeight: isTop ? 700 : 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {team?.name ?? row.id}
                            </span>
                          </div>
                        </td>
                        {[row.played, row.w, row.d, row.l].map((v, j) => (
                          <td key={j} style={{ textAlign: 'center', padding: '.18rem .28rem', fontSize: S.label, color: C.muted }}>{v}</td>
                        ))}
                        <td style={{ textAlign: 'center', padding: '.18rem .28rem', fontSize: S.label, color: C.muted }}>{row.gf}:{row.ga}</td>
                        <td style={{ textAlign: 'center', padding: '.18rem .28rem' }}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.pts, color: isTop ? C.accent : C.text }}>
                            {row.pts}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}

      {/* Top scorers */}
      {scorers.length > 0 && (
        <div style={{ marginTop: 'auto', paddingTop: '.6rem', borderTop: `2px solid ${C.border}` }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: S.section,
            letterSpacing: '.1em',
            color: C.gold,
            marginBottom: '.4rem',
          }}>
            ⚽ Střelci
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
            {scorers.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.22rem .1rem' }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.pts, color: i === 0 ? C.gold : C.muted, width: 18, textAlign: 'center', flexShrink: 0 }}>
                  {i + 1}
                </span>
                {s.team && <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.team.color, flexShrink: 0, display: 'inline-block' }} />}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: S.body, fontWeight: i === 0 ? 700 : 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                  {s.team && (
                    <span style={{ fontSize: S.label, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.team.name}
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: i === 0 ? C.gold : C.accent, flexShrink: 0 }}>
                  {s.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Matches column (no scroll, compact) ───────────────────────────────────────
function MatchesCol({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tc = (id: string) => teams.find(t => t.id === id)?.color ?? '#94a3b8'

  if (!matches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Žádné zápasy
    </div>
  )

  // Group matches by round, sorted alphabetically
  const roundsMap: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Bez skupiny'
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  }
  const roundEntries = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))

  return (
    <div style={{ padding: '.6rem .9rem', display: 'flex', flexDirection: 'column', gap: '.55rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {roundEntries.map(([round, ms]) => (
        <div key={round} style={{ flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: S.label,
            letterSpacing: '.18em',
            color: C.muted,
            textTransform: 'uppercase',
            marginBottom: '.25rem',
            paddingBottom: '.18rem',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {round}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.22rem' }}>
            {ms.map(m => {
              const hw = m.played && m.home_score > m.away_score
              const aw = m.played && m.away_score > m.home_score
              return (
                <div key={m.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '.4rem',
                  padding: '.32rem .6rem',
                  borderRadius: 6,
                  background: m.played ? C.col : '#eff6ff',
                  border: `1px solid ${C.border}`,
                }}>
                  {/* Home */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.3rem', minWidth: 0 }}>
                    <span style={{
                      fontSize: S.body,
                      fontWeight: hw ? 700 : 400,
                      color: hw ? C.text : C.muted,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{tn(m.home_id)}</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tc(m.home_id), flexShrink: 0, display: 'inline-block' }} />
                  </div>

                  {/* Score / VS — same size whether played or not */}
                  <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(3.2rem, 5.5vw, 7rem)' }}>
                    <div>
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
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.muted, letterSpacing: '.06em' }}>VS</span>
                      )}
                      {m.scheduled_time && (
                        <div style={{ fontSize: S.label, color: m.played ? C.muted : C.accent, marginTop: 1, fontWeight: m.played ? 400 : 600 }}>
                          {m.scheduled_time}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Away */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tc(m.away_id), flexShrink: 0, display: 'inline-block' }} />
                    <span style={{
                      fontSize: S.body,
                      fontWeight: aw ? 700 : 400,
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

// ── Flat bracket column ───────────────────────────────────────────────────────
function FlatBracketCol({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => (id ? teams.find(t => t.id === id) : null)

  if (!rounds.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Pavouk není nastaven
    </div>
  )

  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  return (
    <div style={{ padding: '.7rem 1rem', display: 'flex', flexDirection: 'column', gap: '.9rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots]
          .filter(s => s.round_id === round.id)
          .sort((a, b) => a.position - b.position)

        const isFinal = /finále/i.test(round.name) && !/3/i.test(round.name)
        const isThird = /3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)

        const accentColor = isFinal ? C.gold : isThird ? C.bronze : C.accent
        const borderColor = isFinal ? 'rgba(217,119,6,.35)' : isThird ? 'rgba(146,64,14,.25)' : C.border

        return (
          <div key={round.id}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: S.section,
              letterSpacing: '.13em',
              color: accentColor,
              marginBottom: '.35rem',
              paddingBottom: '.2rem',
              borderBottom: `2px solid ${accentColor}`,
              display: 'flex', alignItems: 'center', gap: '.4rem',
            }}>
              {isFinal ? '🏆' : isThird ? '🥉' : '⚔️'} {round.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
              {roundSlots.map(slot => {
                const hT = gt(slot.home_id), aT = gt(slot.away_id)
                const hw = slot.played && slot.home_score > slot.away_score
                const aw = slot.played && slot.away_score > slot.home_score

                return (
                  <div key={slot.id} style={{
                    background: C.col,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: isFinal ? '0 2px 10px rgba(217,119,6,.12)' : isThird ? '0 2px 8px rgba(146,64,14,.08)' : '0 1px 4px rgba(37,99,235,.06)',
                  }}>
                    {/* Home row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '.35rem .7rem',
                      borderBottom: `1px solid ${borderColor}`,
                      background: hw ? (isFinal ? 'rgba(217,119,6,.1)' : isThird ? 'rgba(146,64,14,.07)' : 'rgba(37,99,235,.08)') : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {hT && <span style={{ width: 8, height: 8, borderRadius: '50%', background: hT.color, flexShrink: 0, display: 'inline-block' }} />}
                        <span style={{
                          fontSize: S.body,
                          fontWeight: hw ? 700 : 400,
                          color: hT ? (hw ? accentColor : C.text) : C.muted,
                          fontStyle: hT ? 'normal' : 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {hT?.name ?? 'TBD'}
                        </span>
                      </div>
                      {slot.played && (
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: hw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>
                          {slot.home_score}
                        </span>
                      )}
                    </div>
                    {/* Away row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '.35rem .7rem',
                      background: aw ? (isFinal ? 'rgba(217,119,6,.1)' : isThird ? 'rgba(146,64,14,.07)' : 'rgba(37,99,235,.08)') : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {aT && <span style={{ width: 8, height: 8, borderRadius: '50%', background: aT.color, flexShrink: 0, display: 'inline-block' }} />}
                        <span style={{
                          fontSize: S.body,
                          fontWeight: aw ? 700 : 400,
                          color: aT ? (aw ? accentColor : C.text) : C.muted,
                          fontStyle: aT ? 'normal' : 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {aT?.name ?? 'TBD'}
                        </span>
                      </div>
                      {slot.played && (
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: aw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>
                          {slot.away_score}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Scoreboard ───────────────────────────────────────────────────────────
export default function Scoreboard({ tournament, teams, players, groups, matches, goals, bracketRounds, bracketSlots, onExit }: Props) {
  const clock = useClock()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit])

  const cols = [
    { icon: '📊', label: 'Skupiny — tabulky & střelci' },
    { icon: '⚽', label: 'Zápasy — výsledky' },
    { icon: '🏆', label: 'Play-off' },
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
        <div style={{ background: C.col, borderRight: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '2px 0 8px rgba(37,99,235,.06)' }}>
          <StandingsCol groups={groups} matches={matches} teams={teams} players={players} goals={goals} />
        </div>
        <div style={{ background: '#f8faff', overflow: 'hidden' }}>
          <MatchesCol matches={matches} teams={teams} />
        </div>
        <div style={{ background: C.col, borderLeft: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '-2px 0 8px rgba(37,99,235,.06)' }}>
          <FlatBracketCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
        </div>
      </div>
    </div>
  )
}
