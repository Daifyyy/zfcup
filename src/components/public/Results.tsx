import { useState } from 'react'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  matches: Match[]
  teams: Team[]
  tournament?: Tournament | null
}

// Sdílený layout jednoho zápasu
function MatchRow({ m, teams }: { m: Match; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#94a3b8', logo_url: null }
  const hw = m.played && m.home_score > m.away_score
  const aw = m.played && m.away_score > m.home_score
  return (
    <div className="card match-grid">
      <div className="match-col-time">{m.scheduled_time || ''}</div>
      <div className="match-col-home">
        <TeamLogo team={tt(m.home_id)} size={32} />
        <span className="match-team-name" style={{
          fontWeight: hw ? 700 : 500, fontSize: 'var(--fs-body)',
          color: hw ? 'var(--accent)' : aw ? 'var(--muted)' : 'var(--text)',
          background: hw ? 'var(--accent-dim)' : 'transparent',
          padding: hw ? '2px 8px' : '2px 0', borderRadius: hw ? 5 : 0,
        }}>{tn(m.home_id)}</span>
        <span className="match-score-side" style={{ color: hw ? 'var(--accent)' : 'var(--muted)' }}>
          {m.played ? m.home_score : ''}
        </span>
      </div>
      <div className="match-col-score">
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'var(--fs-score)', letterSpacing: '.1em', lineHeight: 1, color: m.played ? 'var(--text)' : 'var(--muted)' }}>
          {m.played ? `${m.home_score} : ${m.away_score}` : 'VS'}
        </div>
      </div>
      <div className="match-col-away">
        <TeamLogo team={tt(m.away_id)} size={32} />
        <span className="match-team-name" style={{
          fontWeight: aw ? 700 : 500, fontSize: 'var(--fs-body)',
          color: aw ? 'var(--accent)' : hw ? 'var(--muted)' : 'var(--text)',
          background: aw ? 'var(--accent-dim)' : 'transparent',
          padding: aw ? '2px 8px' : '2px 0', borderRadius: aw ? 5 : 0,
        }}>{tn(m.away_id)}</span>
        <span className="match-score-side" style={{ color: aw ? 'var(--accent)' : 'var(--muted)' }}>
          {m.played ? m.away_score : ''}
        </span>
      </div>
      <div className="match-col-badge">
        <span style={{
          fontSize: '.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em',
          padding: '2px 6px', borderRadius: 20,
          background: m.played ? 'rgba(22,163,74,.1)' : 'var(--border)',
          color: m.played ? 'var(--success)' : 'var(--muted)', whiteSpace: 'nowrap',
        }}>
          {m.played ? '✓' : '—'}
        </span>
      </div>
    </div>
  )
}

const SECTION_HEADER = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: '1.1rem',
  letterSpacing: '.15em',
  color: 'var(--text)',
  textTransform: 'uppercase' as const,
  fontWeight: 700,
  margin: '1.6rem 0 .75rem',
  padding: '.5rem 1rem',
  borderLeft: '5px solid var(--accent)',
  background: 'rgba(37,99,235,.04)',
  borderRadius: '0 8px 8px 0',
}

export default function Results({ matches, teams, tournament }: Props) {
  const [teamFilter, setTeamFilter] = useState('all')
  const isLeague = tournament?.format === 'league'

  if (!matches.length) return <Empty icon="📋" text="Žádné zápasy." />

  // Filtr týmu
  const filtered = teamFilter === 'all'
    ? matches
    : matches.filter(m => m.home_id === teamFilter || m.away_id === teamFilter)

  // Seřazené týmy pro dropdown
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  if (isLeague) {
    // Liga mód: skupiny dle scheduled_time; každý slot = 2 zápasy na 2 hřištích
    const slotsMap = new Map<string, Match[]>()
    for (const m of [...filtered].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
      const key = m.scheduled_time ?? '—'
      if (!slotsMap.has(key)) slotsMap.set(key, [])
      slotsMap.get(key)!.push(m)
    }
    const slots = [...slotsMap.entries()]

    return (
      <div>
        <div className="sec-head">
          <span className="sec-title">Zápasy</span>
          <select
            className="field-input field-select"
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            style={{ fontSize: '.78rem', padding: '.3rem .6rem', minWidth: 140 }}
          >
            <option value="all">Všechny týmy</option>
            {sortedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {slots.map(([time, ms]) => (
          <div key={time}>
            {/* Záhlaví slotu s hřišti */}
            <div style={SECTION_HEADER}>
              🕐 {time}
              {ms.length >= 2 && (
                <span style={{ fontSize: '.65rem', fontWeight: 400, letterSpacing: '.06em', marginLeft: '.6rem', color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif" }}>
                  Hřiště A &amp; Hřiště B
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', marginBottom: '.5rem' }}>
              {ms.map((m, i) => (
                <div key={m.id} style={{ position: 'relative' }}>
                  <MatchRow m={m} teams={teams} />
                  {/* Badge hřiště */}
                  {ms.length >= 2 && (
                    <span style={{
                      position: 'absolute', top: '50%', right: '2.8rem', transform: 'translateY(-50%)',
                      fontSize: '.58rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: i === 0 ? 'rgba(37,99,235,.12)' : 'rgba(16,185,129,.12)',
                      color: i === 0 ? 'var(--accent)' : '#065f46',
                      letterSpacing: '.06em', whiteSpace: 'nowrap',
                    }}>
                      H{i === 0 ? 'A' : 'B'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Skupinový / standardní mód: skupiny dle round
  const roundsMap: Record<string, Match[]> = {}
  for (const m of filtered) {
    const r = m.round || 'Bez skupiny'
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  }
  const rounds = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Zápasy</span>
        <select
          className="field-input field-select"
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          style={{ fontSize: '.78rem', padding: '.3rem .6rem', minWidth: 140 }}
        >
          <option value="all">Všechny týmy</option>
          {sortedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {rounds.map(([round, ms]) => (
        <div key={round}>
          <div style={SECTION_HEADER}>{round}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', marginBottom: '.5rem' }}>
            {ms.map(m => <MatchRow key={m.id} m={m} teams={teams} />)}
          </div>
        </div>
      ))}

      {rounds.length === 0 && teamFilter !== 'all' && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: 'var(--fs-body)' }}>
          Tento tým nemá žádné zápasy.
        </div>
      )}
    </div>
  )
}
