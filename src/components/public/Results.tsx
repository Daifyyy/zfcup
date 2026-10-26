import { useEffect, useState } from 'react'
import { Clock, Gavel, Share2 } from 'lucide-react'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import type { Referee } from '../../hooks/useReferees'
import Empty from '../ui/Empty'
import { getSportDef } from '../../lib/sports'
import { getMatchState } from '../../lib/matchState'
import { Card, SectionHeader } from '../ui/Card'
import { Segmented } from '../ui/Tabs'
import { MatchRow } from '../ui/MatchRow'
import { MatchStatusBadge } from '../ui/Badge'
import type { Sponsor } from '../../hooks/useSponsors'
import { ShareMatchDialog } from '../share/lazy'

interface Props {
  matches: Match[]
  teams: Team[]
  tournament?: Tournament | null
  referees?: Referee[]
  sponsors?: Sponsor[]
  showToast?: (msg: string) => void
}

type StatusFilter = 'all' | 'played' | 'upcoming'

const PITCH_LETTERS = 'ABCDEFGH'

export default function Results({ matches, teams, tournament, referees = [], sponsors = [], showToast }: Props) {
  const [teamFilter, setTeamFilter] = useState('all')
  const [shareId, setShareId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const sportDef = getSportDef(tournament?.sport)
  const isLeague = tournament?.format === 'league'
  const teamById = new Map(teams.map(t => [t.id, t]))
  const refName = (m: Match) => m.referee_id ? referees.find(r => r.id === m.referee_id)?.name : undefined

  if (!matches.length) return <Empty text="Rozpis zápasů zatím nebyl zveřejněn." />

  const filtered = matches
    .filter(m => teamFilter === 'all' || m.home_id === teamFilter || m.away_id === teamFilter)
    .filter(m => statusFilter === 'all' || (statusFilter === 'played' ? m.played : !m.played))

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  // Liga: sekce po časových slotech (souběžné zápasy na více hřištích).
  // Skupiny: sekce po kolech/skupinách.
  const sections: { key: string; title: React.ReactNode; subtitle?: string; items: Match[] }[] = []
  if (isLeague) {
    const map = new Map<string, Match[]>()
    for (const m of [...filtered].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
      const key = m.scheduled_time || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    for (const [time, items] of map) {
      sections.push({
        key: time,
        title: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.45rem' }}><Clock size={16} />{time}</span>,
        subtitle: items.length >= 2 ? items.map((_, i) => `${sportDef.terms.pitchLabel} ${PITCH_LETTERS[i] ?? i + 1}`).join(' · ') : undefined,
        items,
      })
    }
  } else {
    const map: Record<string, Match[]> = {}
    for (const m of filtered) {
      const r = m.round || 'Bez skupiny'
      ;(map[r] ??= []).push(m)
    }
    for (const [round, items] of Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'cs'))) {
      items.sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
      sections.push({ key: round, title: round, items })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <SectionHeader
        title="Zápasy"
        subtitle={`${matches.filter(m => m.played).length} z ${matches.length} odehráno`}
        actions={
          <>
            <Segmented
              value={statusFilter}
              onChange={setStatusFilter}
              items={[
                { value: 'all', label: 'Vše' },
                { value: 'upcoming', label: 'Program' },
                { value: 'played', label: 'Výsledky' },
              ]}
            />
            <select
              className="field-input field-select"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{ fontSize: '.8rem', padding: '.4rem 1.8rem .4rem .65rem', width: 'auto', minWidth: 150 }}
              aria-label="Filtr týmu"
            >
              <option value="all">Všechny týmy</option>
              {sortedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        }
      />

      {sections.map(sec => (
        <Card
          key={sec.key}
          padded={false}
          title={sec.title}
          actions={sec.subtitle ? <span style={{ fontSize: '.72rem', color: 'var(--ink-muted)' }}>{sec.subtitle}</span> : undefined}
        >
          {sec.items.map((m, i) => {
            const ref = refName(m)
            const pitch = isLeague && sec.items.length >= 2 ? `${sportDef.terms.pitchLabel} ${PITCH_LETTERS[i] ?? i + 1}` : null
            const state = getMatchState(m, tournament)
            return (
              <MatchRow
                key={m.id}
                home={teamById.get(m.home_id)}
                away={teamById.get(m.away_id)}
                homeScore={m.home_score}
                awayScore={m.away_score}
                state={state}
                decidedIn={m.decided_in}
                logoSize={30}
                trailing={state === 'final' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                    <MatchStatusBadge state={state} decidedIn={m.decided_in} />
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon" title="Sdílet grafiku výsledku" onClick={() => setShareId(m.id)}>
                      <Share2 size={15} />
                    </button>
                  </span>
                ) : undefined}
                meta={isLeague ? (pitch ?? m.scheduled_time) : (m.scheduled_time || '—')}
                sub={ref ? <span><Gavel size={12} />{ref}</span> : undefined}
              />
            )
          })}
        </Card>
      ))}

      {shareId && (() => {
        const m = matches.find(x => x.id === shareId)
        if (!m) return null
        return (
          <ShareMatchDialog
            tournament={tournament ?? null}
            sponsors={sponsors}
            home={teamById.get(m.home_id)}
            away={teamById.get(m.away_id)}
            homeScore={m.home_score}
            awayScore={m.away_score}
            label={m.round || (isLeague ? 'Liga' : 'Zápas')}
            decidedIn={m.decided_in}
            onClose={() => setShareId(null)}
            showToast={showToast}
          />
        )
      })()}

      {sections.length === 0 && (
        <Empty text={teamFilter !== 'all' ? 'Tento tým nemá v tomto výběru žádné zápasy.' : 'Žádné zápasy v tomto výběru.'} />
      )}
    </div>
  )
}
