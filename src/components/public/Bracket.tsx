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

            {/* Match cards — stacked team rows, works on any screen width */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {roundSlots.map(slot => {
                const hT = gt(slot.home_id)
                const aT = gt(slot.away_id)
                const hw = slot.played && slot.home_score > slot.away_score
                const aw = slot.played && slot.away_score > slot.home_score

                const winnerColor = isFinal ? 'var(--gold)' : 'var(--accent)'
                const winnerBg   = isFinal ? 'rgba(217,119,6,.1)' : 'var(--accent-dim)'
                const borderColor = isFinal ? 'rgba(217,119,6,.3)' : 'var(--border)'

                return (
                  <div
                    key={slot.id}
                    className="card"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      border: isFinal ? '1.5px solid rgba(217,119,6,.3)' : undefined,
                    }}
                  >
                    {/* Home row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '.55rem',
                      padding: '.55rem 1rem',
                      borderBottom: `1px solid ${borderColor}`,
                      background: hw ? winnerBg : 'transparent',
                    }}>
                      {hT && <TeamLogo team={hT} size={28} />}
                      <span style={{
                        flex: 1, minWidth: 0,
                        fontWeight: hw ? 700 : 500,
                        fontSize: 'var(--fs-body)',
                        color: hw ? winnerColor : hT ? 'var(--text)' : 'var(--muted)',
                        fontStyle: hT ? 'normal' : 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {hT ? hT.name : 'TBD'}
                      </span>
                      {slot.played && (
                        <span style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: 'var(--fs-score)',
                          color: hw ? winnerColor : 'var(--muted)',
                          flexShrink: 0, marginLeft: '.3rem',
                        }}>
                          {slot.home_score}
                        </span>
                      )}
                    </div>

                    {/* Away row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '.55rem',
                      padding: '.55rem 1rem',
                      background: aw ? winnerBg : 'transparent',
                    }}>
                      {aT && <TeamLogo team={aT} size={28} />}
                      <span style={{
                        flex: 1, minWidth: 0,
                        fontWeight: aw ? 700 : 500,
                        fontSize: 'var(--fs-body)',
                        color: aw ? winnerColor : aT ? 'var(--text)' : 'var(--muted)',
                        fontStyle: aT ? 'normal' : 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {aT ? aT.name : 'TBD'}
                      </span>
                      {slot.played && (
                        <span style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: 'var(--fs-score)',
                          color: aw ? winnerColor : 'var(--muted)',
                          flexShrink: 0, marginLeft: '.3rem',
                        }}>
                          {slot.away_score}
                        </span>
                      )}
                    </div>

                    {/* Status badge */}
                    <div style={{ padding: '.25rem 1rem', background: 'rgba(0,0,0,.02)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      {slot.scheduled_time && !slot.played && (
                        <span style={{ fontSize: '.62rem', color: 'var(--accent)', fontWeight: 700 }}>
                          {slot.scheduled_time}
                        </span>
                      )}
                      <span style={{
                        fontSize: '.6rem', fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '.1em', padding: '2px 7px', borderRadius: 20,
                        background: slot.played ? 'rgba(22,163,74,.1)' : 'var(--border)',
                        color: slot.played ? 'var(--success)' : 'var(--muted)',
                      }}>
                        {slot.played ? '✓ Odehráno' : 'Plánováno'}
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
