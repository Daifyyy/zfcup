import { Trophy } from 'lucide-react'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'
import { SectionHeader } from '../ui/Card'
import { isPlacementRound } from '../../lib/history'
import { useDetail } from '../../lib/TournamentDataContext'

interface Props {
  rounds: BracketRound[]
  slots: BracketSlot[]
  teams: Team[]
}

const DECIDED_IN_BADGE: Record<string, string> = { ot: 'PP', so: 'SN' }


function SlotCard({ slot, teams, isFinal }: { slot: BracketSlot; teams: Map<string, Team>; isFinal: boolean }) {
  const { openMatch } = useDetail()
  const hT = slot.home_id ? teams.get(slot.home_id) : undefined
  const aT = slot.away_id ? teams.get(slot.away_id) : undefined
  const hw = slot.played && slot.home_score > slot.away_score
  const aw = slot.played && slot.away_score > slot.home_score
  const decided = slot.played && slot.decided_in ? DECIDED_IN_BADGE[slot.decided_in] : undefined

  const row = (team: Team | undefined, score: number, won: boolean, lost: boolean) => (
    <div className={`brk-team${won ? ' brk-team--won' : ''}${lost ? ' brk-team--lost' : ''}`}>
      {team ? <TeamLogo team={team} size={26} /> : <span className="brk-team__ph" />}
      <span className="brk-team__name">{team?.name ?? 'Určí se'}</span>
      <span className="brk-team__score">{slot.played ? score : ''}</span>
    </div>
  )

  const cls = `brk-slot${isFinal ? ' brk-slot--final' : ''}`
  const body = (
    <>
      {row(hT, slot.home_score, hw, aw)}
      {row(aT, slot.away_score, aw, hw)}
      <div className="brk-slot__meta">
        <span>{slot.played ? 'Konec' : slot.scheduled_time || 'Termín upřesníme'}</span>
        {decided && <span className="brk-slot__ot">{decided}</span>}
      </div>
    </>
  )
  // Detail jen u slotu, kde už je aspoň jeden tým
  if (!hT && !aT) return <div className={cls}>{body}</div>
  return (
    <button type="button" className={`${cls} brk-slot--link`} onClick={() => openMatch(slot.id)} aria-label={`Detail zápasu ${hT?.name ?? 'Určí se'} – ${aT?.name ?? 'Určí se'}`}>
      {body}
    </button>
  )
}

export default function Bracket({ rounds, slots, teams }: Props) {
  const teamById = new Map(teams.map(t => [t.id, t]))

  if (!rounds.length) return <Empty text="Play-off pavouk bude zveřejněn po skončení základní části." />

  const sorted = [...rounds].sort((a, b) => a.position - b.position)
  const maxPos = Math.max(...sorted.map(r => r.position))
  const finalRound = sorted.find(r => r.position === maxPos)
  const mainRounds = sorted.filter(r => r.position === maxPos || !isPlacementRound(r.name))
  const placementRounds = sorted.filter(r => r.position !== maxPos && isPlacementRound(r.name))
  const finalSlot = finalRound ? slots.find(s => s.round_id === finalRound.id) : undefined
  const champion = finalSlot?.played
    ? teamById.get((finalSlot.home_score > finalSlot.away_score ? finalSlot.home_id : finalSlot.away_id) ?? '')
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader title="Play-off" />

      {champion && (
        <div className="brk-champion">
          <Trophy size={28} />
          <TeamLogo team={champion} size={44} />
          <div>
            <div className="brk-champion__label">Vítěz turnaje</div>
            <div className="brk-champion__name">{champion.name}</div>
          </div>
        </div>
      )}

      <div className="brk">
        {mainRounds.map(round => {
          const roundSlots = slots.filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
          const isFinal = round.position === maxPos
          return (
            <section key={round.id} className="brk-col">
              <h3 className={`brk-col__title${isFinal ? ' brk-col__title--final' : ''}`}>{round.name}</h3>
              <div className="brk-col__slots">
                {roundSlots.map(slot => <SlotCard key={slot.id} slot={slot} teams={teamById} isFinal={isFinal} />)}
              </div>
            </section>
          )
        })}
      </div>

      {placementRounds.length > 0 && (
        <div className="brk-placement">
          <h3 className="brk-placement__title">Zápasy o umístění</h3>
          <div className="brk-placement__grid">
            {placementRounds.map(round => {
              const roundSlots = slots.filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
              return (
                <section key={round.id} className="brk-col">
                  <h3 className="brk-col__title">{round.name}</h3>
                  <div className="brk-col__slots" style={{ justifyContent: 'flex-start' }}>
                    {roundSlots.map(slot => <SlotCard key={slot.id} slot={slot} teams={teamById} isFinal={false} />)}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
