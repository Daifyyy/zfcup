import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  rounds: BracketRound[]
  slots: BracketSlot[]
  teams: Team[]
}

export default function Bracket({ rounds, slots, teams }: Props) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) : null

  if (!rounds.length) return <Empty icon="🏆" text="Pavouk není nastaven." />

  const sorted = [...rounds].sort((a, b) => a.position - b.position)
  const maxPos = Math.max(...sorted.map(r => r.position))

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Play-off</span>
      </div>

      {sorted.map(round => {
        const roundSlots = [...slots]
          .filter(s => s.round_id === round.id)
          .sort((a, b) => a.position - b.position)

        const isFinal = round.position === maxPos

        return (
          <div key={round.id} style={{ marginBottom: '2rem' }}>
            {/* Round header */}
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '1.25rem',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: isFinal ? 'var(--gold)' : 'var(--text)',
              padding: '.55rem 1rem',
              borderLeft: `5px solid ${isFinal ? 'var(--gold)' : 'var(--accent)'}`,
              background: isFinal ? 'rgba(217,119,6,.06)' : 'rgba(37,99,235,.04)',
              borderRadius: '0 8px 8px 0',
              marginBottom: '.9rem',
            }}>
              {round.name}
            </div>

            {/* Match cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {roundSlots.map(slot => {
                const hT = gt(slot.home_id)
                const aT = gt(slot.away_id)
                const hw = slot.played && slot.home_score > slot.away_score
                const aw = slot.played && slot.away_score > slot.home_score

                const winnerColor = isFinal ? 'var(--gold)' : 'var(--accent)'
                const winnerBg = isFinal ? 'rgba(217,119,6,.1)' : 'var(--accent-dim)'

                return (
                  <div
                    key={slot.id}
                    className="card"
                    style={{
                      padding: 'var(--pad-match)',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      alignItems: 'center',
                      gap: '1rem',
                      border: isFinal ? '1.5px solid rgba(217,119,6,.3)' : undefined,
                    }}
                  >
                    {/* Home team */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.55rem' }}>
                      <span style={{
                        fontWeight: hw ? 700 : 500,
                        fontSize: 'var(--fs-body)',
                        color: hw ? winnerColor : hT ? 'var(--text)' : 'var(--muted)',
                        fontStyle: hT ? 'normal' : 'italic',
                        background: hw ? winnerBg : 'transparent',
                        padding: hw ? '2px 8px' : '2px 0',
                        borderRadius: hw ? 5 : 0,
                        transition: 'background .15s',
                      }}>
                        {hT ? hT.name : 'TBD'}
                      </span>
                      {hT && <TeamLogo team={hT} size={32} />}
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: 'center', minWidth: 100 }}>
                      <div style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 'var(--fs-score)',
                        letterSpacing: '.1em',
                        lineHeight: 1,
                        color: slot.played ? 'var(--text)' : 'var(--muted)',
                      }}>
                        {slot.played ? `${slot.home_score} : ${slot.away_score}` : 'VS'}
                      </div>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '.6rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '.1em',
                        padding: '2px 7px',
                        borderRadius: 20,
                        marginTop: '.25rem',
                        background: slot.played ? 'rgba(22,163,74,.1)' : 'var(--border)',
                        color: slot.played ? 'var(--success)' : 'var(--muted)',
                      }}>
                        {slot.played ? '✓ Odehráno' : 'Plánováno'}
                      </span>
                    </div>

                    {/* Away team */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
                      {aT && <TeamLogo team={aT} size={32} />}
                      <span style={{
                        fontWeight: aw ? 700 : 500,
                        fontSize: 'var(--fs-body)',
                        color: aw ? winnerColor : aT ? 'var(--text)' : 'var(--muted)',
                        fontStyle: aT ? 'normal' : 'italic',
                        background: aw ? winnerBg : 'transparent',
                        padding: aw ? '2px 8px' : '2px 0',
                        borderRadius: aw ? 5 : 0,
                        transition: 'background .15s',
                      }}>
                        {aT ? aT.name : 'TBD'}
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
