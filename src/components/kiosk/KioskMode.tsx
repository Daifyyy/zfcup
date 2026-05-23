import { useState, useEffect, useRef, useCallback } from 'react'
import { calcGroupStandings } from '../../lib/standings'
import { TeamLogo } from '../ui/TeamLogo'
import QRCode from '../ui/QRCode'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Announcement } from '../../hooks/useAnnouncements'

/* ── Palette ───────────────────────────────────────────── */
const C = {
  bg:      '#f0f4ff',
  col:     '#ffffff',
  hdr:     '#1e3a8a',
  text:    '#0f172a',
  muted:   '#64748b',
  accent:  '#2563eb',
  border:  'rgba(37,99,235,.1)',
  success: '#16a34a',
  gold:    '#d97706',
  bronze:  '#92400e',
}

/* ── Fluid sizes (Scoreboard-quality scale) ─────────────── */
const S = {
  title:   'clamp(1.3rem, 2.2vw, 2.8rem)',
  section: 'clamp(.75rem, 1.1vw, 1.4rem)',
  body:    'clamp(.65rem, .95vw, 1.15rem)',
  small:   'clamp(.58rem, .78vw, .92rem)',
  score:   'clamp(.9rem, 1.4vw, 1.7rem)',
  pts:     'clamp(.9rem, 1.3vw, 1.6rem)',
  label:   'clamp(.52rem, .7vw, .82rem)',
}

/* ── Views config ──────────────────────────────────────── */
type KioskView = 'matches' | 'table' | 'bracket'
const ALL_VIEWS: { key: KioskView; label: string; icon: string }[] = [
  { key: 'matches', label: 'Zápasy',  icon: '⚽' },
  { key: 'table',   label: 'Tabulka', icon: '📊' },
  { key: 'bracket', label: 'Pavouk',  icon: '🏆' },
]
const ROTATION_MS = 15_000

/* ── Clock hook ────────────────────────────────────────── */
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

/* ── Sub-components for KioskMatches ───────────────────── */

function GroupMatchesSubCol({ groupName, matches, teams }: { groupName: string; matches: Match[]; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#94a3b8', logo_url: null }
  return (
    <div style={{ padding: '.4rem .5rem', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden', gap: '.18rem' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.section, letterSpacing: '.12em', color: C.accent, paddingBottom: '.15rem', borderBottom: `2px solid ${C.border}`, flexShrink: 0 }}>
        {groupName}
      </div>
      {matches.map(m => {
        const hw = m.played && m.home_score > m.away_score
        const aw = m.played && m.away_score > m.home_score
        return (
          <div key={m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', alignItems: 'center', gap: '.2rem', padding: '.1rem .3rem', borderRadius: 4, background: m.played ? C.col : '#eff6ff', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ fontSize: S.label, color: m.played ? C.muted : C.accent, fontWeight: m.played ? 400 : 700, flexShrink: 0, minWidth: '3em', textAlign: 'center' }}>
              {m.scheduled_time || ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(m.home_id)}</span>
              <TeamLogo team={tt(m.home_id)} size={14} />
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.2rem, 3.5vw, 5rem)' }}>
              {m.played
                ? <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.text, letterSpacing: '.06em', lineHeight: 1 }}>{m.home_score}:{m.away_score}</span>
                : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.muted, letterSpacing: '.06em' }}>VS</span>
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem', minWidth: 0, overflow: 'hidden' }}>
              <TeamLogo team={tt(m.away_id)} size={14} />
              <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(m.away_id)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatchCell({ match, teams }: { match: Match; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id)
  const hw = match.played && match.home_score > match.away_score
  const aw = match.played && match.away_score > match.home_score
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '.18rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', minWidth: 0 }}>
        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(match.home_id)}</span>
        {tt(match.home_id) && <TeamLogo team={tt(match.home_id)!} size={14} />}
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '3em' }}>
        {match.played
          ? <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.text, letterSpacing: '.06em' }}>{match.home_score}:{match.away_score}</span>
          : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.small, color: C.muted }}>VS</span>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem', minWidth: 0 }}>
        {tt(match.away_id) && <TeamLogo team={tt(match.away_id)!} size={14} />}
        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(match.away_id)}</span>
      </div>
    </div>
  )
}

function LeagueMatchesCol({ matches, teams, numPitches = 2 }: { matches: Match[]; teams: Team[]; numPitches?: number }) {
  const slotsMap = new Map<string, Match[]>()
  for (const m of [...matches].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
    const key = m.scheduled_time ?? ''
    if (!slotsMap.has(key)) slotsMap.set(key, [])
    slotsMap.get(key)!.push(m)
  }
  const sortedSlots = [...slotsMap.entries()]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '.3rem .55rem', gap: '.18rem', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '0 .4rem', flexShrink: 0 }}>
        <div style={{ minWidth: '3.1em', flexShrink: 0 }} />
        {'ABCD'.slice(0, numPitches).split('').map((letter, i) => (
          <div key={letter} style={{ display: 'contents' }}>
            {i > 0 && <div style={{ width: 1, flexShrink: 0 }} />}
            <div style={{ flex: 1, textAlign: 'center', fontSize: S.label, color: C.accent, fontWeight: 700, letterSpacing: '.08em' }}>HŘIŠTĚ {letter}</div>
          </div>
        ))}
      </div>
      {sortedSlots.map(([time, slotMatches], si) => {
        const allPlayed = slotMatches.every(m => m.played)
        return (
          <div key={time || si} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.15rem .4rem', borderRadius: 5, background: allPlayed ? C.col : '#eff6ff', border: `1px solid ${C.border}`, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: S.label, color: allPlayed ? C.muted : C.accent, fontWeight: allPlayed ? 400 : 700, flexShrink: 0, minWidth: '3.1em', textAlign: 'center' }}>{time || '—'}</div>
            {'ABCD'.slice(0, numPitches).split('').map((letter, i) => (
              <div key={letter} style={{ display: 'contents' }}>
                {i > 0 && <div style={{ width: 1, alignSelf: 'stretch', background: C.border, flexShrink: 0 }} />}
                {slotMatches[i] ? <MatchCell match={slotMatches[i]} teams={teams} /> : <div style={{ flex: 1 }} />}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function PlayoffMatchesSubCol({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) ?? null : null
  const tn = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? 'TBD' : 'TBD'
  const sorted = [...rounds].sort((a, b) => a.position - b.position)
  if (!sorted.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Play-off není nastaven
    </div>
  )
  return (
    <div style={{ padding: '.5rem .8rem', display: 'flex', flexDirection: 'column', gap: '.4rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        const isFinal = /finále/i.test(round.name) && !/3/i.test(round.name)
        const isThird = /3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)
        const accentColor = isFinal ? C.gold : isThird ? C.bronze : C.accent
        return (
          <div key={round.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.label, letterSpacing: '.16em', color: accentColor, textTransform: 'uppercase', marginBottom: '.2rem', paddingBottom: '.14rem', borderBottom: `1px solid ${accentColor}` }}>
              {isFinal ? '🏆' : isThird ? '🥉' : '⚔️'} {round.name}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '.15rem', overflow: 'hidden' }}>
              {roundSlots.map(s => {
                const hT = gt(s.home_id), aT = gt(s.away_id)
                const hw = s.played && s.home_score > s.away_score
                const aw = s.played && s.away_score > s.home_score
                return (
                  <div key={s.id} style={{ flex: 1, minHeight: 0, borderRadius: 5, background: s.played ? C.col : '#eff6ff', border: `1px solid ${isFinal ? 'rgba(217,119,6,.3)' : isThird ? 'rgba(146,64,14,.2)' : C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {s.scheduled_time && !s.played && (
                      <div style={{ fontSize: S.label, color: C.muted, padding: '.1rem .5rem 0', fontWeight: 600 }}>🕐 {s.scheduled_time}</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '.3rem', padding: '.26rem .5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.25rem', minWidth: 0 }}>
                        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? accentColor : C.muted, fontStyle: hT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(s.home_id)}</span>
                        {hT && <TeamLogo team={hT} size={16} />}
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.4rem, 4vw, 5.5rem)' }}>
                        {s.played
                          ? <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: accentColor, letterSpacing: '.06em', lineHeight: 1 }}>{s.home_score}:{s.away_score}</span>
                          : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.muted }}>VS</span>
                        }
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem', minWidth: 0 }}>
                        {aT && <TeamLogo team={aT} size={16} />}
                        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? accentColor : C.muted, fontStyle: aT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(s.away_id)}</span>
                      </div>
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

/* ── View A: Zápasy ─────────────────────────────────────── */
function KioskMatches({ tournament, teams, groups, matches, bracketRounds, bracketSlots }: {
  tournament: Tournament | null; teams: Team[]; groups: Group[]
  matches: Match[]; bracketRounds: BracketRound[]; bracketSlots: BracketSlot[]
}) {
  const isLeague = tournament?.format === 'league'
  const groupMatches = matches.filter(m => m.group_id !== null)
  const allGroupMatchesPlayed = groups.length > 0 && groupMatches.length > 0 && groupMatches.every(m => m.played)
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  if (allGroupMatchesPlayed) {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <PlayoffMatchesSubCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
      </div>
    )
  }

  if (!groupMatches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.section }}>
      Žádné zápasy
    </div>
  )

  if (isLeague) {
    return <LeagueMatchesCol matches={groupMatches} teams={teams} numPitches={tournament?.num_pitches ?? 2} />
  }

  const numCols = sortedGroups.length <= 3 ? sortedGroups.length : Math.ceil(sortedGroups.length / 2)
  const columns: Group[][] = Array.from({ length: numCols }, () => [])
  sortedGroups.forEach((g, i) => columns[i % numCols].push(g))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, 1fr)`, height: '100%', overflow: 'hidden' }}>
      {columns.map((colGroups, colIdx) => (
        <div key={colIdx} style={{ borderLeft: colIdx > 0 ? `1px solid ${C.border}` : 'none', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {colGroups.map((group, gi) => {
            const gMatches = groupMatches.filter(m => m.group_id === group.id)
            return (
              <div key={group.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', borderTop: gi > 0 ? `2px solid ${C.border}` : 'none' }}>
                <GroupMatchesSubCol groupName={group.name} matches={gMatches} teams={teams} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ── View B: Tabulka (standings + scorers) ──────────────── */
function KioskTable({ tournament, teams, players, groups, matches, goals, bracketGoals }: {
  tournament: Tournament | null; teams: Team[]; players: Player[]; groups: Group[]
  matches: Match[]; goals: Goal[]; bracketGoals: BracketGoal[]
}) {
  const gt = (id: string) => teams.find(t => t.id === id)
  const isLeague = tournament?.format === 'league'

  const leagueRowStyle = (i: number) => {
    if (i < 2) return { bg: 'rgba(22,163,74,.10)',  borderLeft: '3px solid rgba(22,163,74,.6)',   numColor: '#15803d' }
    if (i < 6) return { bg: 'rgba(245,158,11,.10)', borderLeft: '3px solid rgba(245,158,11,.55)', numColor: '#b45309' }
    return          { bg: 'transparent',             borderLeft: '3px solid transparent',          numColor: C.muted }
  }

  // Top 10 scorers — aggregate group goals + bracket_goals
  const scorers = players
    .map(p => ({
      id: p.id,
      name: p.name,
      team: teams.find(t => t.id === p.team_id),
      total:
        goals.filter(g => g.player_id === p.id).reduce((s, g) => s + g.count, 0) +
        bracketGoals.filter(g => g.player_id === p.id).reduce((s, g) => s + g.count, 0),
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', height: '100%', overflow: 'hidden' }}>
      {/* Left: Standings */}
      <div style={{ borderRight: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '.6rem .8rem .2rem' }}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {groups.length === 0 ? (
            <div style={{ color: C.muted, fontSize: S.body, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Žádné skupiny</div>
          ) : (
            groups.map(group => {
              const rows = calcGroupStandings(group, matches)
              return (
                <div key={group.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: '.25rem', paddingBottom: '.18rem', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.section, letterSpacing: '.1em', color: C.accent, lineHeight: 1.15 }}>
                      {group.name}
                    </div>
                    {isLeague && (
                      <div style={{ display: 'flex', gap: '.7rem', marginTop: '.18rem' }}>
                        <span style={{ fontSize: S.label, color: '#15803d', fontWeight: 600 }}>■ 1–2 → SF</span>
                        <span style={{ fontSize: S.label, color: '#b45309', fontWeight: 600 }}>■ 3–6 → QF</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['#', 'Tým', 'Z', 'V', 'R', 'P', 'Sk', 'B'].map((h, i) => (
                            <th key={h} style={{ fontSize: S.label, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted, textAlign: i <= 1 ? 'left' : 'center', padding: '.1rem .22rem', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const team = gt(row.id)
                          const ls = isLeague ? leagueRowStyle(i) : null
                          const rowBg = ls ? ls.bg : i === 0 ? 'rgba(59,130,246,.1)' : 'transparent'
                          const numColor = ls ? ls.numColor : C.muted
                          const bold = isLeague ? i < 6 : i === 0
                          return (
                            <tr key={row.id} style={{ background: rowBg }}>
                              <td style={{ padding: '.12rem .22rem', paddingLeft: ls ? 0 : '.22rem', textAlign: 'center', fontSize: S.label, borderLeft: ls?.borderLeft }}>
                                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.pts, color: numColor, lineHeight: 1 }}>{i + 1}</span>
                              </td>
                              <td style={{ padding: '.12rem .22rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {team && <TeamLogo team={team} size={16} />}
                                  <span style={{ fontSize: S.body, fontWeight: bold ? 700 : 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {team?.name ?? row.id}
                                  </span>
                                </div>
                              </td>
                              {[row.played, row.w, row.d, row.l].map((v, j) => (
                                <td key={j} style={{ textAlign: 'center', padding: '.12rem .22rem', fontSize: S.label, color: C.muted }}>{v}</td>
                              ))}
                              <td style={{ textAlign: 'center', padding: '.12rem .22rem', fontSize: S.label, color: C.muted }}>{row.gf}:{row.ga}</td>
                              <td style={{ textAlign: 'center', padding: '.12rem .22rem' }}>
                                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.pts, color: numColor !== C.muted ? numColor : i === 0 ? C.accent : C.text }}>
                                  {row.pts}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right: Scorers */}
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '.6rem .8rem .4rem' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.section, letterSpacing: '.1em', color: C.gold, marginBottom: '.3rem', flexShrink: 0 }}>
          ⚽ Střelci
        </div>
        {scorers.length === 0 ? (
          <div style={{ color: C.muted, fontSize: S.body, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>Žádní střelci</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.22rem', flex: 1, overflow: 'hidden' }}>
            {scorers.map((sc, i) => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.3rem .5rem', borderRadius: 6, background: i < 3 ? (i === 0 ? 'rgba(217,119,6,.08)' : 'rgba(148,163,184,.07)') : 'transparent', borderLeft: i === 0 ? `3px solid ${C.gold}` : i === 1 ? '3px solid #94a3b8' : i === 2 ? `3px solid ${C.bronze}` : '3px solid transparent' }}>
                <div style={{ width: '2em', textAlign: 'center', flexShrink: 0 }}>
                  {i < 3
                    ? <span style={{ fontSize: S.body }}>{medals[i]}</span>
                    : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.pts, color: C.muted, lineHeight: 1 }}>{i + 1}</span>
                  }
                </div>
                {sc.team && <TeamLogo team={sc.team} size={18} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: S.body, fontWeight: i < 3 ? 700 : 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.name}</div>
                  {sc.team && <div style={{ fontSize: S.label, color: C.muted }}>{sc.team.name}</div>}
                </div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: i === 0 ? C.gold : C.accent, flexShrink: 0, lineHeight: 1 }}>{sc.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── View C: Pavouk ─────────────────────────────────────── */
function KioskBracket({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) ?? null : null
  const tn = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? 'TBD' : 'TBD'
  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  if (!sorted.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.section }}>
      Pavouk není nastaven
    </div>
  )

  return (
    <div style={{ padding: '.7rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '.7rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        const isFinal = /finále/i.test(round.name) && !/3/i.test(round.name)
        const isThird = /3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)
        const accentColor = isFinal ? C.gold : isThird ? C.bronze : C.accent
        const borderColor = isFinal ? 'rgba(217,119,6,.35)' : isThird ? 'rgba(146,64,14,.25)' : C.border

        return (
          <div key={round.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.section, letterSpacing: '.13em', color: accentColor, marginBottom: '.3rem', paddingBottom: '.2rem', borderBottom: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
              {isFinal ? '🏆' : isThird ? '🥉' : '⚔️'} {round.name}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '.5rem', overflow: 'hidden' }}>
              {roundSlots.map(slot => {
                const hT = gt(slot.home_id), aT = gt(slot.away_id)
                const hw = slot.played && slot.home_score > slot.away_score
                const aw = slot.played && slot.away_score > slot.home_score
                return (
                  <div key={slot.id} style={{ flex: 1, minWidth: 0, background: slot.played ? C.col : '#eff6ff', border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden', boxShadow: isFinal ? '0 2px 10px rgba(217,119,6,.12)' : '0 1px 4px rgba(37,99,235,.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {slot.scheduled_time && !slot.played && (
                      <div style={{ fontSize: S.label, color: C.muted, padding: '.2rem .7rem 0', fontWeight: 600 }}>🕐 {slot.scheduled_time}</div>
                    )}
                    {/* Home row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem .7rem', borderBottom: `1px solid ${borderColor}`, background: hw ? (isFinal ? 'rgba(217,119,6,.1)' : 'rgba(37,99,235,.08)') : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {hT && <TeamLogo team={hT} size={18} />}
                        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hT ? (hw ? accentColor : C.text) : C.muted, fontStyle: hT ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hT?.name ?? 'TBD'}</span>
                      </div>
                      {slot.played && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: hw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>{slot.home_score}</span>}
                    </div>
                    {/* Away row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem .7rem', background: aw ? (isFinal ? 'rgba(217,119,6,.1)' : 'rgba(37,99,235,.08)') : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {aT && <TeamLogo team={aT} size={18} />}
                        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aT ? (aw ? accentColor : C.text) : C.muted, fontStyle: aT ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aT?.name ?? 'TBD'}</span>
                      </div>
                      {slot.played && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: aw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>{slot.away_score}</span>}
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

/* ── Sub-header labels ───────────────────────────────────── */
const VIEW_SUBHEADERS: Record<KioskView, { icon: string; label: string }> = {
  matches: { icon: '⚽', label: 'Zápasy — výsledky' },
  table:   { icon: '📊', label: 'Tabulka & střelci' },
  bracket: { icon: '🏆', label: 'Play-off — pavouk' },
}

/* ── Main KioskMode ─────────────────────────────────────── */
interface Props {
  tournament: Tournament | null
  teams: Team[]; players: Player[]; groups: Group[]
  matches: Match[]; goals: Goal[]; bracketGoals: BracketGoal[]
  bracketRounds: BracketRound[]; bracketSlots: BracketSlot[]
  announcements: Announcement[]
  onExit: () => void
  onScoreboard: () => void
}

export default function KioskMode({ tournament, teams, players, groups, matches, goals, bracketGoals, bracketRounds, bracketSlots, onExit, onScoreboard }: Props) {
  const bracketActive = bracketSlots.some(s => s.home_id != null || s.away_id != null)
  const effectiveViews = bracketActive ? ALL_VIEWS : ALL_VIEWS.filter(v => v.key !== 'bracket')

  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [barKey, setBarKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const clock = useClock()

  const currentView = effectiveViews[idx % effectiveViews.length]

  const advance = useCallback(() => {
    setIdx(i => (i + 1) % effectiveViews.length)
    setBarKey(k => k + 1)
  }, [effectiveViews.length])

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

  const goTo = (i: number) => {
    clearTimeout(timerRef.current)
    setIdx(i)
    setBarKey(k => k + 1)
    setPaused(false)
  }

  const subhdr = VIEW_SUBHEADERS[currentView.key]

  return (
    <div onClick={handleClick} style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: C.bg, cursor: paused ? 'pointer' : 'default', userSelect: 'none', fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      <style>{`@keyframes kioskBar { from { width:0% } to { width:100% } }`}</style>

      {/* ── Progress bar ── */}
      <div style={{ height: 4, background: 'rgba(255,255,255,.3)', flexShrink: 0, position: 'relative' }}>
        <div key={paused ? 'p' : `b${barKey}`} style={{
          position: 'absolute', left: 0, top: 0, height: '100%', background: '#60a5fa',
          animation: paused ? 'none' : `kioskBar ${ROTATION_MS}ms linear forwards`,
          width: paused ? '0%' : undefined,
        }} />
      </div>

      {/* ── Header ── */}
      <div style={{ background: C.hdr, flexShrink: 0, padding: '.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.title, letterSpacing: '.08em', color: '#fff', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tournament?.name || 'Turnaj'}
          </div>
          {tournament?.subtitle && (
            <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.6)', marginTop: '.1rem' }}>{tournament.subtitle}</div>
          )}
        </div>

        {/* Tab pills */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.5rem' }}>
          {effectiveViews.map((v, i) => (
            <button type="button" key={v.key} onClick={e => { e.stopPropagation(); goTo(i) }} style={{
              background: i === idx ? 'rgba(255,255,255,.2)' : 'transparent',
              color: i === idx ? '#fff' : 'rgba(255,255,255,.5)',
              border: `2px solid ${i === idx ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.15)'}`,
              borderRadius: 40, padding: '.3rem 1rem',
              fontSize: S.label, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.08em',
              cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', gap: '.35rem',
            }}>
              <span>{v.icon}</span> {v.label}
            </button>
          ))}
        </div>

        {/* Clock */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.title, color: '#bfdbfe', letterSpacing: '.08em', flexShrink: 0 }}>
          {clock}
        </div>

        {/* Controls */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.7rem', alignItems: 'center', flexShrink: 0 }}>
          {paused && (
            <span style={{ fontSize: S.label, color: 'rgba(255,255,255,.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>⏸ Pauza</span>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); onScoreboard() }} style={{ background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', borderRadius: 8, color: 'rgba(255,255,255,.7)', fontSize: S.label, fontWeight: 700, padding: '.35rem 1rem', cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,.3)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}>
            📋 Tabule
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onExit() }} style={{ background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', borderRadius: 8, color: 'rgba(255,255,255,.7)', fontSize: S.label, fontWeight: 700, padding: '.35rem 1rem', cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,.4)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}>
            ✕ Ukončit
          </button>
        </div>
      </div>

      {/* ── Sub-header ── */}
      <div style={{ background: '#eff6ff', borderBottom: `2px solid ${C.border}`, padding: '.32rem 1.5rem', flexShrink: 0 }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.label, letterSpacing: '.16em', color: C.accent, textTransform: 'uppercase' }}>
          {subhdr.icon} {subhdr.label}
        </span>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: currentView.key === 'table' ? C.col : '#f8faff' }}>
        {currentView.key === 'matches' && (
          <KioskMatches tournament={tournament} teams={teams} groups={groups} matches={matches} bracketRounds={bracketRounds} bracketSlots={bracketSlots} />
        )}
        {currentView.key === 'table' && (
          <KioskTable tournament={tournament} teams={teams} players={players} groups={groups} matches={matches} goals={goals} bracketGoals={bracketGoals} />
        )}
        {currentView.key === 'bracket' && (
          <KioskBracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: '#1e293b', flexShrink: 0, padding: '.8rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
        {/* Nav dots */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          {effectiveViews.map((v, i) => (
            <div key={v.key} onClick={e => { e.stopPropagation(); goTo(i) }} style={{ width: i === idx ? '2.5rem' : '.8rem', height: '.8rem', minWidth: i === idx ? 28 : 10, minHeight: 10, maxWidth: i === idx ? 44 : 16, maxHeight: 16, borderRadius: 10, background: i === idx ? '#60a5fa' : 'rgba(255,255,255,.25)', transition: 'all .35s', cursor: 'pointer' }} />
          ))}
          <span style={{ fontSize: S.label, color: 'rgba(255,255,255,.5)', marginLeft: '.4rem', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '.1em' }}>
            {currentView.label}
          </span>
        </div>

        <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.4)', textAlign: 'center' }}>
          {paused ? 'Klikni pro pokračování' : `Přepne za ${ROTATION_MS / 1000}s · Klik = pauza`}
        </div>

        {/* QR */}
        <div data-kiosk-ctrl style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.body, color: '#fff', letterSpacing: '.1em' }}>Sdílet</div>
            <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.5)' }}>Naskenuj QR kód</div>
          </div>
          <QRCode size={52} />
        </div>
      </div>
    </div>
  )
}
