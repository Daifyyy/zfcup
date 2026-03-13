import { useState, useEffect, useRef, useCallback } from 'react'
import type { Tab } from '../../App'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Announcement } from '../../hooks/useAnnouncements'
import { calcGroupStandings } from '../../lib/standings'
import QRCode from '../ui/QRCode'

/* ── Constants ──────────────────────────────────────── */
const KIOSK_TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview',  label: 'Přehled',  icon: '🏠' },
  { key: 'results',   label: 'Výsledky', icon: '📋' },
  { key: 'standings', label: 'Tabulka',  icon: '📊' },
  { key: 'scorers',   label: 'Střelci',  icon: '⚽' },
  { key: 'bracket',   label: 'Pavouk',   icon: '🏆' },
]
const ROTATION_MS = 15_000

// TV font sizes using clamp(min, fluid, max)
const TV = {
  title:    'clamp(3.5rem, 6vw, 7rem)',
  heading:  'clamp(2rem, 3.5vw, 4.5rem)',
  sub:      'clamp(1.2rem, 2vw, 2.2rem)',
  body:     'clamp(1rem, 1.6vw, 1.7rem)',
  small:    'clamp(.8rem, 1.2vw, 1.2rem)',
  label:    'clamp(.7rem, 1vw, 1rem)',
  score:    'clamp(4rem, 9vw, 11rem)',
  pts:      'clamp(2rem, 4vw, 5rem)',
  goalBig:  'clamp(3rem, 6vw, 8rem)',
  rank:     'clamp(2rem, 4vw, 5rem)',
}

/* ── Helper ─────────────────────────────────────────── */
function useClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })), 10_000)
    return () => clearInterval(t)
  }, [])
  return time
}

/* ── TV Views ────────────────────────────────────────── */

function TvOverview({ tournament, teams, matches, groups, announcements }: {
  tournament: Tournament | null; teams: Team[]; matches: Match[]; groups: Group[]; announcements: Announcement[]
}) {
  const played = matches.filter(m => m.played).length
  const stats = [
    { label: 'Týmů',     value: teams.length,   icon: '👥', accent: true  },
    { label: 'Zápasů',   value: matches.length, icon: '📋', accent: false },
    { label: 'Odehráno', value: played,          icon: '✅', accent: true  },
    { label: 'Skupin',   value: groups.length,  icon: '🏆', accent: false },
  ]
  return (
    <div style={{ padding: '3vw 4vw', height: '100%', display: 'flex', flexDirection: 'column', gap: '2.5vw' }}>
      {/* Tournament name */}
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.title, letterSpacing: '.05em', lineHeight: 1, color: '#0f172a' }}>
          {tournament?.name || 'Turnaj'}
        </div>
        {[tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).length > 0 && (
          <div style={{ fontSize: TV.sub, color: '#64748b', marginTop: '.4rem' }}>
            {[tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1.5vw' }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: 20,
            padding: '2.5vw 2vw', textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          }}>
            <div style={{ fontSize: TV.sub, marginBottom: '.5vw' }}>{s.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.pts, color: s.accent ? '#2563eb' : '#0f172a', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.label, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.14em', marginTop: '.4vw' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {tournament?.description && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '2vw 2.5vw', fontSize: TV.body, color: '#64748b', lineHeight: 1.75 }}>
          {tournament.description}
        </div>
      )}

      {/* Announcements */}
      {announcements.slice(0, 3).map(a => (
        <div key={a.id} style={{ background: '#fff', borderRadius: 16, padding: '1.5vw 2vw', display: 'flex', gap: '1.5vw', alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <span style={{ fontSize: TV.sub, flexShrink: 0 }}>{a.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: TV.body }}>{a.title}</div>
            {a.body && <div style={{ fontSize: TV.small, color: '#64748b', marginTop: '.3vw' }}>{a.body}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function TvResults({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tc = (id: string) => teams.find(t => t.id === id)?.color ?? '#94a3b8'

  const rounds: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Zápasy'
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(m)
  }

  if (!matches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: TV.pts, marginBottom: '1rem' }}>📋</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading }}>Žádné zápasy</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '2.5vw 4vw', display: 'flex', flexDirection: 'column', gap: '2.5vw', overflowY: 'auto', height: '100%' }}>
      {Object.entries(rounds).map(([round, ms]) => (
        <div key={round}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: TV.sub, letterSpacing: '.15em', color: '#64748b',
            textTransform: 'uppercase', marginBottom: '1.2vw',
            paddingBottom: '.7vw', borderBottom: '3px solid #e2e8f0',
          }}>{round}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.8vw' }}>
            {ms.map(m => {
              const hw = m.played && m.home_score > m.away_score
              const aw = m.played && m.away_score > m.home_score
              return (
                <div key={m.id} style={{
                  background: '#fff', borderRadius: 18,
                  padding: '1.8vw 2.5vw',
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center', gap: '2vw',
                  boxShadow: '0 4px 20px rgba(0,0,0,.07)',
                }}>
                  {/* Home */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.2vw' }}>
                    <span style={{ fontWeight: hw ? 800 : 500, fontSize: TV.sub, color: hw ? '#0f172a' : '#64748b', textAlign: 'right' }}>{tn(m.home_id)}</span>
                    <div style={{ width: '1.2vw', height: '1.2vw', minWidth: 14, minHeight: 14, borderRadius: '50%', background: tc(m.home_id), flexShrink: 0 }} />
                  </div>
                  {/* Score */}
                  <div style={{ textAlign: 'center', minWidth: '14vw' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.score, letterSpacing: '.08em', lineHeight: 1, color: m.played ? '#0f172a' : '#94a3b8' }}>
                      {m.played ? `${m.home_score}:${m.away_score}` : 'VS'}
                    </div>
                    <div style={{
                      display: 'inline-block', marginTop: '.3vw',
                      fontSize: TV.small, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '.1em',
                      padding: '.3vw 1vw', borderRadius: 40,
                      background: m.played ? 'rgba(22,163,74,.12)' : '#f1f5f9',
                      color: m.played ? '#16a34a' : '#94a3b8',
                    }}>
                      {m.played ? '✓ Odehráno' : m.scheduled_time || 'Plánováno'}
                    </div>
                  </div>
                  {/* Away */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vw' }}>
                    <div style={{ width: '1.2vw', height: '1.2vw', minWidth: 14, minHeight: 14, borderRadius: '50%', background: tc(m.away_id), flexShrink: 0 }} />
                    <span style={{ fontWeight: aw ? 800 : 500, fontSize: TV.sub, color: aw ? '#0f172a' : '#64748b' }}>{tn(m.away_id)}</span>
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

function TvStandings({ groups, matches, teams }: { groups: Group[]; matches: Match[]; teams: Team[] }) {
  const gt = (id: string) => teams.find(t => t.id === id)

  if (!groups.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: TV.pts, marginBottom: '1rem' }}>📊</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading }}>Žádné skupiny</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '2.5vw 4vw', display: 'flex', flexDirection: 'column', gap: '3vw', overflowY: 'auto', height: '100%' }}>
      {groups.map(group => {
        const rows = calcGroupStandings(group, matches)
        const headers = ['#', 'Tým', 'Z', 'V', 'R', 'P', 'Skóre', '+/−', 'Body']
        return (
          <div key={group.id} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
            <div style={{ padding: '1.5vw 2.5vw', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', display: 'flex', alignItems: 'center', gap: '1.5vw' }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading, letterSpacing: '.08em', color: '#fff' }}>{group.name}</span>
              <span style={{ fontSize: TV.small, color: 'rgba(255,255,255,.7)' }}>{group.team_ids.length} týmů</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {headers.map((h, i) => (
                    <th key={h} style={{
                      padding: '1vw 1.5vw', color: '#94a3b8',
                      fontSize: TV.label, textTransform: 'uppercase', letterSpacing: '.12em',
                      textAlign: i <= 1 ? 'left' : 'center',
                      fontWeight: 700, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const team = gt(row.id)
                  const isTop = i === 0
                  const rankColor = i === 0 ? '#d97706' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#94a3b8'
                  const gdColor = row.gd > 0 ? '#16a34a' : row.gd < 0 ? '#dc2626' : '#94a3b8'
                  return (
                    <tr key={row.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none', background: isTop ? 'rgba(37,99,235,.04)' : 'transparent' }}>
                      <td style={{ textAlign: 'center', padding: '1.2vw 1.5vw' }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.rank, color: rankColor, lineHeight: 1 }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '1.2vw 1.5vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
                          {team && <div style={{ width: '1.4vw', height: '1.4vw', minWidth: 14, minHeight: 14, borderRadius: '50%', background: team.color, flexShrink: 0 }} />}
                          <span style={{ fontWeight: 700, fontSize: TV.body }}>{team?.name ?? row.id}</span>
                        </div>
                      </td>
                      {[row.played, row.w, row.d, row.l].map((v, j) => (
                        <td key={j} style={{ textAlign: 'center', padding: '1.2vw 1.5vw', fontSize: TV.body, color: '#64748b' }}>{v}</td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '1.2vw 1.5vw', fontSize: TV.body, color: '#64748b' }}>{row.gf}:{row.ga}</td>
                      <td style={{ textAlign: 'center', padding: '1.2vw 1.5vw', fontSize: TV.body, color: gdColor, fontWeight: 700 }}>
                        {row.gd > 0 ? '+' : ''}{row.gd}
                      </td>
                      <td style={{ textAlign: 'center', padding: '1.2vw 1.5vw' }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.pts, color: '#2563eb', lineHeight: 1 }}>{row.pts}</span>
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

function TvScorers({ goals, players, teams }: { goals: Goal[]; players: Player[]; teams: Team[] }) {
  const agg: Record<string, number> = {}
  for (const g of goals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count

  const scorers = Object.entries(agg)
    .map(([pid, goals]) => {
      const player = players.find(p => p.id === pid)
      if (!player || goals === 0) return null
      const team = teams.find(t => t.id === player.team_id)
      return { id: pid, name: player.name, teamName: team?.name ?? '', teamColor: team?.color ?? '#94a3b8', goals }
    })
    .filter(Boolean)
    .sort((a, b) => b!.goals - a!.goals)
    .slice(0, 10) as { id: string; name: string; teamName: string; teamColor: string; goals: number }[]

  if (!scorers.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: TV.pts, marginBottom: '1rem' }}>⚽</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading }}>Žádní střelci</div>
      </div>
    </div>
  )

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ padding: '2.5vw 4vw', display: 'flex', flexDirection: 'column', gap: '1vw', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading, letterSpacing: '.06em', marginBottom: '.5vw', color: '#0f172a' }}>
        Střelci
      </div>
      {scorers.map((sc, i) => (
        <div key={sc.id} style={{
          background: '#fff', borderRadius: 16,
          padding: '1.2vw 2vw',
          display: 'grid', gridTemplateColumns: '5vw 1fr auto',
          alignItems: 'center', gap: '1.5vw',
          boxShadow: i < 3 ? '0 4px 20px rgba(0,0,0,.09)' : '0 2px 8px rgba(0,0,0,.05)',
          borderLeft: i === 0 ? '6px solid #d97706' : i === 1 ? '6px solid #94a3b8' : i === 2 ? '6px solid #b45309' : '6px solid transparent',
        }}>
          <div style={{ textAlign: 'center' }}>
            {i < 3
              ? <span style={{ fontSize: TV.sub }}>{medals[i]}</span>
              : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.rank, color: '#94a3b8', lineHeight: 1 }}>{i + 1}</span>
            }
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: TV.sub, color: '#0f172a' }}>{sc.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.8vw', marginTop: '.3vw' }}>
              <div style={{ width: '1vw', height: '1vw', minWidth: 10, minHeight: 10, borderRadius: '50%', background: sc.teamColor }} />
              <span style={{ fontSize: TV.small, color: '#64748b' }}>{sc.teamName}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.8vw', paddingRight: '1vw' }}>
            <span style={{ fontSize: TV.sub }}>⚽</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.goalBig, color: i === 0 ? '#d97706' : '#2563eb', lineHeight: 1 }}>{sc.goals}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function TvBracket({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) : null
  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  if (!sorted.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: TV.pts, marginBottom: '1rem' }}>🏆</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading }}>Pavouk není nastaven</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '2.5vw 4vw', overflowX: 'auto', height: '100%' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading, letterSpacing: '.06em', marginBottom: '2vw', color: '#0f172a' }}>Pavouk</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '1.5vw', minWidth: 'max-content' }}>
        {sorted.map((round, ri) => {
          const rSlots = [...slots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
          const UNIT = 160
          const slotH = UNIT * Math.pow(2, ri)
          const isFinal = ri === sorted.length - 1
          return (
            <div key={round.id} style={{ display: 'flex' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '16vw', maxWidth: 300 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.sub, letterSpacing: '.13em', color: '#64748b', textAlign: 'center', padding: '0 .5vw 1vw', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                  {round.name}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {rSlots.map(slot => {
                    const hT = gt(slot.home_id), aT = gt(slot.away_id)
                    const hw = slot.played && slot.home_score > slot.away_score
                    const aw = slot.played && slot.away_score > slot.home_score
                    return (
                      <div key={slot.id} style={{ display: 'flex', alignItems: 'center', padding: '.5vw', height: slotH }}>
                        <div style={{
                          background: '#fff', borderRadius: 14, overflow: 'hidden', width: '100%',
                          border: `2px solid ${isFinal ? 'rgba(217,119,6,.5)' : '#e2e8f0'}`,
                          boxShadow: '0 4px 20px rgba(0,0,0,.1)',
                        }}>
                          {[{ team: hT, score: slot.home_score, win: hw }, { team: aT, score: slot.away_score, win: aw }].map((row, ri2) => (
                            <div key={ri2} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '1vw 1.2vw',
                              borderBottom: ri2 === 0 ? '1px solid #e2e8f0' : 'none',
                              background: row.win ? (isFinal ? 'rgba(217,119,6,.1)' : 'rgba(37,99,235,.08)') : 'transparent',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '.6vw' }}>
                                {row.team && <div style={{ width: '1vw', height: '1vw', minWidth: 10, minHeight: 10, borderRadius: '50%', background: row.team.color }} />}
                                <span style={{ fontSize: TV.body, fontWeight: row.win ? 800 : 500, color: row.team ? '#0f172a' : '#94a3b8', fontStyle: row.team ? 'normal' : 'italic' }}>
                                  {row.team?.name ?? 'TBD'}
                                </span>
                              </div>
                              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.sub, color: row.win ? (isFinal ? '#d97706' : '#2563eb') : '#94a3b8' }}>
                                {slot.played ? row.score : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {ri < sorted.length - 1 && (
                <div style={{ width: '2vw', minWidth: 20, display: 'flex', flexDirection: 'column', paddingTop: 'calc(1.5vw + 2px)' }}>
                  {Array.from({ length: Math.ceil(rSlots.length / 2) }, (_, p) => (
                    <div key={p} style={{ height: slotH * 2, flex: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', right: 0, top: '25%', height: '50%', width: 2, background: '#cbd5e1' }} />
                      <div style={{ position: 'absolute', right: 0, top: '25%', width: '100%', height: 2, background: '#cbd5e1' }} />
                      <div style={{ position: 'absolute', right: 0, top: '75%', width: '100%', height: 2, background: '#cbd5e1' }} />
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

/* ── Main KioskMode ─────────────────────────────────── */
interface Props {
  tournament: Tournament | null
  teams: Team[]; players: Player[]; groups: Group[]
  matches: Match[]; goals: Goal[]
  bracketRounds: BracketRound[]; bracketSlots: BracketSlot[]
  announcements: Announcement[]
  onExit: () => void
}

export default function KioskMode({ tournament, teams, players, groups, matches, goals, bracketRounds, bracketSlots, announcements, onExit }: Props) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [barKey, setBarKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const clock = useClock()
  const tab = KIOSK_TABS[idx].key

  const advance = useCallback(() => { setIdx(i => (i + 1) % KIOSK_TABS.length); setBarKey(k => k + 1) }, [])

  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(advance, ROTATION_MS)
    return () => clearTimeout(timerRef.current)
  }, [idx, paused, advance])

  useEffect(() => {
    document.documentElement.requestFullscreen().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onExit])

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-kiosk-ctrl]')) return
    clearTimeout(timerRef.current)
    setPaused(p => !p)
  }

  const goTo = (i: number) => { clearTimeout(timerRef.current); setIdx(i); setBarKey(k => k + 1); setPaused(false) }

  return (
    <div onClick={handleClick} style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: '#eef2ff', cursor: paused ? 'pointer' : 'default', userSelect: 'none' }}>
      <style>{`
        @keyframes kioskBar { from { width:0% } to { width:100% } }
      `}</style>

      {/* ── Progress bar ── */}
      <div style={{ height: 5, background: 'rgba(255,255,255,.3)', flexShrink: 0, position: 'relative' }}>
        <div key={paused ? 'p' : `b${barKey}`} style={{
          position: 'absolute', left: 0, top: 0, height: '100%', background: '#60a5fa',
          animation: paused ? 'none' : `kioskBar ${ROTATION_MS}ms linear forwards`,
          width: paused ? '0%' : undefined,
        }} />
      </div>

      {/* ── Header ── */}
      <div style={{ background: '#1e3a8a', flexShrink: 0, padding: '1.2vw 3vw', display: 'flex', alignItems: 'center', gap: '2vw' }}>
        <span style={{ fontSize: 'clamp(1.5rem,3vw,3rem)' }}>⚽</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading, letterSpacing: '.05em', color: '#fff', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tournament?.name || 'Turnaj'}
          </div>
          {tournament?.subtitle && (
            <div style={{ fontSize: TV.small, color: 'rgba(255,255,255,.65)', marginTop: '.2vw' }}>{tournament.subtitle}</div>
          )}
        </div>

        {/* Tab pills */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.6vw', flexWrap: 'nowrap' }}>
          {KIOSK_TABS.map((t, i) => (
            <button key={t.key} onClick={e => { e.stopPropagation(); goTo(i) }} style={{
              background: i === idx ? 'rgba(255,255,255,.2)' : 'transparent',
              color: i === idx ? '#fff' : 'rgba(255,255,255,.5)',
              border: `2px solid ${i === idx ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.15)'}`,
              borderRadius: 40, padding: '.4vw 1.2vw',
              fontSize: TV.label, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.08em',
              cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', gap: '.4vw',
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Clock */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.heading, color: '#fff', letterSpacing: '.05em', flexShrink: 0 }}>
          {clock}
        </div>

        {/* Pause + exit */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.8vw', alignItems: 'center', flexShrink: 0 }}>
          {paused && (
            <span style={{ fontSize: TV.small, color: 'rgba(255,255,255,.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>⏸ Pauza</span>
          )}
          <button onClick={e => { e.stopPropagation(); onExit() }} style={{
            background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)',
            borderRadius: 10, color: 'rgba(255,255,255,.7)',
            fontSize: TV.small, fontWeight: 700, padding: '.5vw 1.2vw',
            cursor: 'pointer', transition: 'all .15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,.4)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}
          >
            ✕ Ukončit
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'overview'  && <TvOverview tournament={tournament} teams={teams} matches={matches} groups={groups} announcements={announcements} />}
        {tab === 'results'   && <TvResults matches={matches} teams={teams} />}
        {tab === 'standings' && <TvStandings groups={groups} matches={matches} teams={teams} />}
        {tab === 'scorers'   && <TvScorers goals={goals} players={players} teams={teams} />}
        {tab === 'bracket'   && <TvBracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: '#1e293b', flexShrink: 0, padding: '1vw 3vw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2vw' }}>
        {/* Nav dots */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.6vw', alignItems: 'center' }}>
          {KIOSK_TABS.map((t, i) => (
            <div key={i} onClick={e => { e.stopPropagation(); goTo(i) }} style={{
              width: i === idx ? '3vw' : '1vw', height: '1vw',
              minWidth: i === idx ? 28 : 10, minHeight: 10,
              maxWidth: i === idx ? 50 : 18, maxHeight: 18,
              borderRadius: 10,
              background: i === idx ? '#60a5fa' : 'rgba(255,255,255,.25)',
              transition: 'all .35s', cursor: 'pointer',
            }} />
          ))}
          <span style={{ fontSize: TV.small, color: 'rgba(255,255,255,.5)', marginLeft: '.5vw', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '.1em' }}>
            {KIOSK_TABS[idx].label}
          </span>
        </div>

        <div style={{ fontSize: TV.small, color: 'rgba(255,255,255,.4)', textAlign: 'center' }}>
          {paused ? 'Klikni pro pokračování' : `Přepne za ${ROTATION_MS / 1000}s · Klik = pauza`}
        </div>

        {/* QR */}
        <div data-kiosk-ctrl style={{ display: 'flex', alignItems: 'center', gap: '1.2vw' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: TV.sub, color: '#fff', letterSpacing: '.1em' }}>Sdílet</div>
            <div style={{ fontSize: TV.small, color: 'rgba(255,255,255,.5)' }}>Naskenuj QR kód</div>
          </div>
          <QRCode size={64} />
        </div>
      </div>
    </div>
  )
}
