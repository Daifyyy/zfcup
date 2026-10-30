// Admin → Střelci → Tým turnaje: automatická sestava (src/lib/bestTeam.ts) s možností
// obsadit jednotlivá místa ručně (tournament.best_team, migrace 22).
import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { isMissingColumnError } from '../../../lib/partners'
import { useTournamentData } from '../../../lib/TournamentDataContext'
import { bestTeamInput, computeBestTeam, fieldCount, BEST_TEAM_POINTS, MAX_PER_TEAM, type BestTeamEntry } from '../../../lib/bestTeam'
import { statFlags } from '../../../lib/details'
import { getSportDef } from '../../../lib/sports'

export default function BestTeamEditor({ refetchTournament, showToast }: { refetchTournament: () => void; showToast: (m: string) => void }) {
  const d = useTournamentData()
  const [saving, setSaving] = useState(false)
  const sport = getSportDef(d.tournament.sport)
  const overrides = d.tournament.best_team?.slots ?? {}
  const team = useMemo(
    () => computeBestTeam(bestTeamInput(d, statFlags(d)), sport, { overrides }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, sport, JSON.stringify(overrides)],
  )
  const n = fieldCount(sport)
  const slots: (BestTeamEntry | null)[] = [team.goalkeeper, ...Array.from({ length: n }, (_, i) => team.field[i] ?? null)]
  const teamName = (id: string) => d.teams.find(t => t.id === id)?.name ?? ''
  const playersSorted = useMemo(
    () => [...d.players].sort((a, b) => teamName(a.team_id).localeCompare(teamName(b.team_id), 'cs') || a.name.localeCompare(b.name, 'cs')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.players, d.teams],
  )
  const byTeam = d.teams
    .map(t => ({ team: t, players: playersSorted.filter(p => p.team_id === t.id) }))
    .filter(g => g.players.length > 0)

  async function save(next: Record<string, string>) {
    if (saving) return
    setSaving(true)
    try {
      const value = Object.keys(next).length ? { slots: next } : null
      const { error } = await supabase.from('tournament').update({ best_team: value }).eq('id', d.tournament.id)
      if (error) {
        showToast(isMissingColumnError(error, 'best_team') ? 'Chybí migrace 22 (db-backup/22_mvp_best_team.sql)' : 'Chyba: ' + error.message)
        return
      }
      showToast('Sestava uložena ✓')
      refetchTournament()
    } finally {
      setSaving(false)
    }
  }

  function setSlot(index: number, playerId: string) {
    const next = { ...overrides }
    if (playerId) {
      // stejný hráč nesmí být na dvou místech
      for (const [k, v] of Object.entries(next)) if (v === playerId) delete next[k]
      next[String(index)] = playerId
    } else {
      delete next[String(index)]
    }
    save(next)
  }

  const stat = (e: BestTeamEntry) => e.keeper
    ? `${e.keeper.against} obdržených v ${e.keeper.games} záp. · ${e.keeper.cleanSheets}× čisté konto`
    : [e.goals && `${e.goals} G`, e.assists && `${e.assists} A`, e.mvp && `${e.mvp}× hráč zápasu`].filter(Boolean).join(' · ')

  return (
    <div style={{ marginTop: '1.4rem' }}>
      <div className="sub-title">Tým turnaje</div>
      <div className="info-box">
        Sestava se skládá automaticky a průběžně se mění: gól {BEST_TEAM_POINTS.goal} b., asistence {BEST_TEAM_POINTS.assist} b., hráč zápasu {BEST_TEAM_POINTS.mvp} b.,
        výhra týmu +{BEST_TEAM_POINTS.win}, karty a tresty body ubírají; nejvýš {MAX_PER_TEAM} hráči z jednoho týmu. Brankář = tým s nejméně obdrženými góly
        (brankáře označte v soupisce). Kterékoli místo můžete obsadit ručně — ostatní dál doplňuje automatika.
      </div>
      {d.tournament.best_team === undefined && (
        <p style={{ fontSize: '.76rem', color: 'var(--warn)' }}>Ruční úpravy vyžadují migraci 22 (db-backup/22_mvp_best_team.sql).</p>
      )}
      <div className="a-list">
        {slots.map((e, i) => {
          const manual = overrides[String(i)] !== undefined
          return (
            <div key={i} className="a-item" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
              <span style={{ width: 70, flexShrink: 0, fontSize: '.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {i === 0 ? 'Brankář' : `Hráč ${i}`}
              </span>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div className="a-item-main">{e ? e.player.name : <span style={{ color: 'var(--ink-muted)' }}>{i === 0 ? 'Neurčen — v soupiskách chybí brankář' : 'Zatím nikdo'}</span>}</div>
                {e && <div className="a-item-sub">{e.team?.name}{stat(e) ? ` · ${stat(e)}` : ''}{manual ? ' · ručně' : ''}</div>}
              </div>
              <select className="field-input field-select" value={overrides[String(i)] ?? ''} aria-label={i === 0 ? 'Brankář' : `Hráč ${i}`}
                onChange={ev => setSlot(i, ev.target.value)} style={{ flex: '1 1 180px', fontSize: '.8rem', padding: '.25rem .45rem', opacity: saving ? 0.5 : 1 }}>
                <option value="">Automaticky</option>
                {byTeam.map(g => (
                  <optgroup key={g.team.id} label={g.team.name}>
                    {g.players.map(p => <option key={p.id} value={p.id}>{p.name}{p.role === 'goalkeeper' || p.role === 'both' ? ' (brankář)' : ''}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )
        })}
      </div>
      {Object.keys(overrides).length > 0 && (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" style={{ marginTop: '.5rem', opacity: saving ? 0.5 : 1 }} onClick={() => save({})}>
          <RotateCcw size={14} />Vrátit vše na automatiku
        </button>
      )}
    </div>
  )
}
