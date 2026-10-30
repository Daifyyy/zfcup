// Detail zápasu → Hlasování diváků o hráči zápasu (modul fan_vote, migrace 23).
// Divák klikne na hráče (jeden hlas na zařízení, lze změnit); výsledky TOP 5 se obnovují.
import { useState } from 'react'
import { Vote } from 'lucide-react'
import type { MatchDetail } from '../../lib/details'
import type { TournamentData } from '../../lib/TournamentDataContext'
import { useModule } from '../../lib/ModulesContext'
import { useFanVotes } from '../../hooks/useFanVotes'
import { castVote, myVote, voteOpen, VOTE_MESSAGES } from '../../lib/fanVote'
import { TeamLogo } from '../ui/TeamLogo'

export default function FanVoteSection({ md, data }: { md: MatchDetail; data: TournamentData }) {
  const on = useModule('fan_vote')
  const state = voteOpen(md, data.tournament)
  const { results, refetch } = useFanVotes(data.tournament.id, on && state !== 'closed')
  const [mine, setMine] = useState<string | null>(() => myVote(md.id))
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  if (!on || !md.home_id || !md.away_id) return null

  const rows = results.get(md.id) ?? []
  const total = rows.reduce((s, r) => s + r.votes, 0)
  if (state === 'closed' && total === 0) return null

  const playerById = new Map(data.players.map(p => [p.id, p]))
  const sides = [md.home_id, md.away_id].map(id => ({
    team: data.teams.find(t => t.id === id),
    players: data.players.filter(p => p.team_id === id).sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'cs')),
  }))

  async function vote(playerId: string) {
    if (sending) return
    setSending(true); setMsg('')
    try {
      const r = await castVote(md.id, playerId)
      if (r === 'ok') { setMine(playerId); setMsg('Díky, hlas započten ✓'); refetch() }
      else setMsg(VOTE_MESSAGES[r])
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="tm-drawer__sec">
      <h3>Hlasování diváků — hráč zápasu</h3>
      {state === 'not_started' && <p className="md-note" style={{ marginTop: 0 }}>Hlasování začne výkopem.</p>}
      {state === 'open' && (
        <>
          <p className="md-note" style={{ marginTop: 0 }}>Kdo byl nejlepší? {mine ? 'Svůj hlas můžete změnit.' : 'Klikněte na hráče.'}</p>
          <div className="fv-sides">
            {sides.map(s => s.team && (
              <div key={s.team.id} className="fv-side">
                <div className="fv-side__team"><TeamLogo team={s.team} size={20} radius={4} />{s.team.name}</div>
                <div className="fv-chips">
                  {s.players.map(p => (
                    <button key={p.id} type="button" className={mine === p.id ? 'fv-chip fv-chip--mine' : 'fv-chip'}
                      style={{ opacity: sending ? 0.5 : 1 }} onClick={() => vote(p.id)} aria-pressed={mine === p.id}>
                      {p.number != null && <b>{p.number}</b>}{p.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {msg && <p className="md-note" role="status">{msg}</p>}
        </>
      )}
      {total > 0 && (
        <div className="fv-results ui-card">
          <div className="fv-results__head"><Vote size={15} />Průběžně · {total} {total === 1 ? 'hlas' : total >= 2 && total <= 4 ? 'hlasy' : 'hlasů'}</div>
          {rows.slice(0, 5).map((r, i) => {
            const p = playerById.get(r.player_id)
            const pct = Math.round((r.votes / total) * 100)
            return (
              <div key={r.player_id} className={i === 0 ? 'fv-row fv-row--lead' : 'fv-row'}>
                <span className="fv-row__name">{p?.name ?? '—'}{r.player_id === mine && <em> · váš hlas</em>}</span>
                <span className="fv-row__bar"><i style={{ width: `${pct}%` }} /></span>
                <span className="fv-row__pct">{pct} %</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
