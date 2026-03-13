import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'

interface Props {
  rounds: BracketRound[]
  slots: BracketSlot[]
  teams: Team[]
}

export default function Bracket({ rounds, slots, teams }: Props) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) : null

  if (!rounds.length) return <Empty icon="🏆" text="Pavouk není nastaven." />

  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Pavouk</span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}>
          {sorted.map((round, ri) => {
            const roundSlots = [...slots]
              .filter(s => s.round_id === round.id)
              .sort((a, b) => a.position - b.position)
            const UNIT = 90
            const slotH = UNIT * Math.pow(2, ri)
            const isFinal = ri === sorted.length - 1

            return (
              <div key={round.id} style={{ display: 'flex' }}>
                {/* Round column */}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 172 }}>
                  <div style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '.77rem', letterSpacing: '.13em',
                    color: 'var(--muted)', textAlign: 'center',
                    padding: '0 6px .65rem',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>
                    {round.name}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {roundSlots.map(slot => {
                      const hT = gt(slot.home_id), aT = gt(slot.away_id)
                      const hw = slot.played && slot.home_score > slot.away_score
                      const aw = slot.played && slot.away_score > slot.home_score
                      return (
                        <div key={slot.id} style={{
                          display: 'flex', alignItems: 'center',
                          padding: '5px 6px', height: slotH,
                        }}>
                          <div style={{
                            background: 'var(--card)',
                            border: `1px solid ${isFinal ? 'rgba(217,119,6,.3)' : 'var(--border)'}`,
                            borderRadius: 9, overflow: 'hidden', width: 160,
                            boxShadow: 'var(--shadow-card)',
                          }}>
                            {/* Home row */}
                            <div style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '.4rem .68rem', fontSize: '.77rem', fontWeight: 500,
                              borderBottom: '1px solid var(--border)',
                              background: hw ? (isFinal ? 'rgba(217,119,6,.08)' : 'var(--accent-dim)') : 'transparent',
                              color: hw ? (isFinal ? 'var(--gold)' : 'var(--accent)') : hT ? 'var(--text)' : 'var(--muted)',
                            }}>
                              <span style={{ fontStyle: hT ? 'normal' : 'italic' }}>
                                {hT ? hT.name : 'TBD'}
                              </span>
                              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '.9rem', color: 'var(--muted)', marginLeft: 4 }}>
                                {slot.played ? slot.home_score : ''}
                              </span>
                            </div>
                            {/* Away row */}
                            <div style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '.4rem .68rem', fontSize: '.77rem', fontWeight: 500,
                              background: aw ? (isFinal ? 'rgba(217,119,6,.08)' : 'var(--accent-dim)') : 'transparent',
                              color: aw ? (isFinal ? 'var(--gold)' : 'var(--accent)') : aT ? 'var(--text)' : 'var(--muted)',
                            }}>
                              <span style={{ fontStyle: aT ? 'normal' : 'italic' }}>
                                {aT ? aT.name : 'TBD'}
                              </span>
                              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '.9rem', color: 'var(--muted)', marginLeft: 4 }}>
                                {slot.played ? slot.away_score : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Connector lines */}
                {ri < sorted.length - 1 && (
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    width: 24, flexShrink: 0,
                    minHeight: slotH * roundSlots.length,
                    paddingTop: 'calc(.65rem + 1px)',
                  }}>
                    {Array.from({ length: Math.ceil(roundSlots.length / 2) }, (_, p) => (
                      <div key={p} style={{ height: slotH * 2, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <div style={{ position: 'absolute', right: 0, top: '25%', height: '50%', width: 1, background: 'var(--border)' }} />
                        <div style={{ flex: 1, position: 'relative' }}>
                          <div style={{ position: 'absolute', right: 0, top: '50%', width: '100%', height: 1, background: 'var(--border)' }} />
                        </div>
                        <div style={{ flex: 1, position: 'relative' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
