import { useEffect, useState } from 'react'
import { calcGroupStandings } from '../../lib/standings'
import QRCode from '../ui/QRCode'
import { TeamLogo } from '../ui/TeamLogo'
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Group standings — shrinkable */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '.6rem .8rem .2rem', display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
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
                  marginBottom: '.25rem',
                  paddingBottom: '.15rem',
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
                          textTransform: 'uppercase', letterSpacing: '.08em',
                          color: C.muted,
                          textAlign: i <= 1 ? 'left' : 'center',
                          padding: '.1rem .22rem',
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
                          <td style={{ padding: '.12rem .22rem', textAlign: 'center', color: C.muted, fontSize: S.label }}>{i + 1}</td>
                          <td style={{ padding: '.12rem .22rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {team && <TeamLogo team={team} size={16} />}
                              <span style={{ fontSize: S.body, fontWeight: isTop ? 700 : 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {team?.name ?? row.id}
                              </span>
                            </div>
                          </td>
                          {[row.played, row.w, row.d, row.l].map((v, j) => (
                            <td key={j} style={{ textAlign: 'center', padding: '.12rem .22rem', fontSize: S.label, color: C.muted }}>{v}</td>
                          ))}
                          <td style={{ textAlign: 'center', padding: '.12rem .22rem', fontSize: S.label, color: C.muted }}>{row.gf}:{row.ga}</td>
                          <td style={{ textAlign: 'center', padding: '.12rem .22rem' }}>
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
      </div>

      {/* Top scorers — always visible at bottom, not pushed by standings */}
      {scorers.length > 0 && (
        <div style={{ flexShrink: 0, padding: '.4rem .8rem .6rem', borderTop: `2px solid ${C.border}` }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: S.section,
            letterSpacing: '.1em',
            color: C.gold,
            marginBottom: '.3rem',
          }}>
            ⚽ Střelci
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
            {scorers.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.15rem .05rem' }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.pts, color: i === 0 ? C.gold : C.muted, width: 16, textAlign: 'center', flexShrink: 0 }}>
                  {i + 1}
                </span>
                {s.team && <TeamLogo team={s.team} size={16} />}
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

// ── Single-group matches sub-column ───────────────────────────────────────────
function GroupMatchesSubCol({ groupName, matches, teams }: { groupName: string; matches: Match[]; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#94a3b8', logo_url: null }

  return (
    <div style={{ padding: '.5rem .65rem', display: 'flex', flexDirection: 'column', gap: '.3rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: S.section,
        letterSpacing: '.12em',
        color: C.accent,
        marginBottom: '.2rem',
        paddingBottom: '.15rem',
        borderBottom: `2px solid ${C.border}`,
      }}>
        {groupName}
      </div>
      {matches.map(m => {
        const hw = m.played && m.home_score > m.away_score
        const aw = m.played && m.away_score > m.home_score
        return (
          <div key={m.id} style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto 1fr',
            alignItems: 'center',
            gap: '.28rem',
            padding: '.26rem .4rem',
            borderRadius: 5,
            background: m.played ? C.col : '#eff6ff',
            border: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            {/* Čas */}
            <div style={{ fontSize: S.label, color: m.played ? C.muted : C.accent, fontWeight: m.played ? 400 : 700, flexShrink: 0, minWidth: '3.2em', textAlign: 'center' }}>
              {m.scheduled_time || ''}
            </div>
            {/* Home */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.25rem', minWidth: 0 }}>
              <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tn(m.home_id)}
              </span>
              <TeamLogo team={tt(m.home_id)} size={16} />
            </div>
            {/* Skóre */}
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.4rem, 4vw, 5.5rem)' }}>
              {m.played ? (
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.text, letterSpacing: '.06em', lineHeight: 1 }}>
                  {m.home_score}:{m.away_score}
                </span>
              ) : (
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.muted, letterSpacing: '.06em' }}>VS</span>
              )}
            </div>
            {/* Away */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem', minWidth: 0 }}>
              <TeamLogo team={tt(m.away_id)} size={16} />
              <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tn(m.away_id)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Playoff matches sub-column (po odehrání skupin) ────────────────────────────
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
    <div style={{ padding: '.5rem .8rem', display: 'flex', flexDirection: 'column', gap: '.5rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        const isFinal = /finále/i.test(round.name) && !/3/i.test(round.name)
        const isThird = /3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)
        const accentColor = isFinal ? C.gold : isThird ? C.bronze : C.accent
        return (
          <div key={round.id} style={{ flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: S.label,
              letterSpacing: '.16em',
              color: accentColor,
              textTransform: 'uppercase',
              marginBottom: '.2rem',
              paddingBottom: '.14rem',
              borderBottom: `1px solid ${accentColor}`,
            }}>
              {isFinal ? '🏆' : isThird ? '🥉' : '⚔️'} {round.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
              {roundSlots.map(s => {
                const hT = gt(s.home_id), aT = gt(s.away_id)
                const hw = s.played && s.home_score > s.away_score
                const aw = s.played && s.away_score > s.home_score
                return (
                  <div key={s.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '.3rem',
                    padding: '.26rem .5rem',
                    borderRadius: 5,
                    background: s.played ? C.col : '#eff6ff',
                    border: `1px solid ${isFinal ? 'rgba(217,119,6,.3)' : isThird ? 'rgba(146,64,14,.2)' : C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.25rem', minWidth: 0 }}>
                      <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? accentColor : hT ? C.muted : C.muted, fontStyle: hT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tn(s.home_id)}
                      </span>
                      {hT && <TeamLogo team={hT} size={16} />}
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.4rem, 4vw, 5.5rem)' }}>
                      {s.played ? (
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: accentColor, letterSpacing: '.06em', lineHeight: 1 }}>
                          {s.home_score}:{s.away_score}
                        </span>
                      ) : (
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: S.score, color: C.muted }}>VS</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem', minWidth: 0 }}>
                      {aT && <TeamLogo team={aT} size={16} />}
                      <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? accentColor : aT ? C.muted : C.muted, fontStyle: aT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tn(s.away_id)}
                      </span>
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

// ── Matches column — 2 skupiny nebo playoff ────────────────────────────────────
function MatchesCol({ matches, teams, groups, bracketRounds, bracketSlots }: {
  matches: Match[]
  teams: Team[]
  groups: Group[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
}) {
  const groupMatches = matches.filter(m => m.group_id !== null)
  const allGroupMatchesPlayed = groups.length > 0 && groupMatches.length > 0 && groupMatches.every(m => m.played)
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  if (allGroupMatchesPlayed) {
    return <PlayoffMatchesSubCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
  }

  if (!groupMatches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Žádné zápasy
    </div>
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(sortedGroups.length, 2)}, 1fr)`,
      height: '100%',
      overflow: 'hidden',
    }}>
      {sortedGroups.map((group, i) => {
        const gMatches = groupMatches.filter(m => m.group_id === group.id)
        return (
          <div key={group.id} style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : 'none', overflow: 'hidden', height: '100%' }}>
            <GroupMatchesSubCol groupName={group.name} matches={gMatches} teams={teams} />
          </div>
        )
      })}
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
                        {hT && <TeamLogo team={hT} size={18} />}
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
                        {aT && <TeamLogo team={aT} size={18} />}
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
        gridTemplateColumns: '27% 51% 22%',
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
        gridTemplateColumns: '27% 51% 22%',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <div style={{ background: C.col, borderRight: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '2px 0 8px rgba(37,99,235,.06)' }}>
          <StandingsCol groups={groups} matches={matches} teams={teams} players={players} goals={goals} />
        </div>
        <div style={{ background: '#f8faff', overflow: 'hidden' }}>
          <MatchesCol matches={matches} teams={teams} groups={groups} bracketRounds={bracketRounds} bracketSlots={bracketSlots} />
        </div>
        <div style={{ background: C.col, borderLeft: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '-2px 0 8px rgba(37,99,235,.06)' }}>
          <FlatBracketCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
        </div>
      </div>
    </div>
  )
}
