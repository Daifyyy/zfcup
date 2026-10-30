// Statistiky → Tým turnaje (Vlna 1, bod 3): automatická sestava s ručními úpravami pořadatele.
import { useMemo, useState } from 'react'
import { Share2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { TeamLogo } from '../ui/TeamLogo'
import { useTournamentData } from '../../lib/TournamentDataContext'
import { bestTeamScopes } from '../../lib/tournamentGraphics'
import { getSportDef } from '../../lib/sports'
import { tournamentUrl, withAccessCode } from '../../lib/share'
import type { BestTeamEntry } from '../../lib/bestTeam'
import { ShareBestTeamDialog } from '../share/lazy'

export default function BestTeamCard({ showToast }: { showToast?: (m: string) => void }) {
  const d = useTournamentData()
  const scopes = useMemo(() => bestTeamScopes(d), [d])
  const [scope, setScope] = useState('all')
  const [share, setShare] = useState(false)
  const cur = scopes.find(s => s.value === scope) ?? scopes[0]
  if (!cur) return null
  const rows: { role: string; e: BestTeamEntry }[] = [
    ...(cur.team.goalkeeper ? [{ role: 'Brankář', e: cur.team.goalkeeper }] : []),
    ...cur.team.field.map(e => ({ role: 'Hráč', e })),
  ]
  const stat = (e: BestTeamEntry) => e.keeper
    ? `${(e.keeper.against / e.keeper.games).toFixed(1).replace('.', ',')} obdržených/záp.`
    : [e.goals && `${e.goals} G`, e.assists && `${e.assists} A`, e.mvp && `${e.mvp}× MVP`].filter(Boolean).join(' · ')
  const url = tournamentUrl(d.tournament.id)

  return (
    <Card padded={false} title={cur.label} actions={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
        {scopes.length > 1 && (
          <select className="field-input field-select" aria-label="Sestava" value={cur.value} onChange={e => setScope(e.target.value)}
            style={{ width: 'auto', fontSize: '.78rem', padding: '.2rem .45rem' }}>
            {scopes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon" title="Sdílet grafiku sestavy" onClick={() => setShare(true)}><Share2 size={14} /></button>
      </span>
    }>
      <table className="ui-table">
        <tbody>
          {rows.map(({ role, e }) => (
            <tr key={e.player.id}>
              <td className="is-muted" style={{ width: 74, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase' }}>{role}</td>
              <td className="is-left is-name">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.55rem', minWidth: 0 }}>
                  {e.team && <TeamLogo team={e.team} size={28} />}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{e.player.name}</span>
                    <span style={{ display: 'block', fontSize: '.72rem', color: 'var(--ink-muted)' }}>{e.team?.name}</span>
                  </span>
                </span>
              </td>
              <td className="is-muted" style={{ fontSize: '.76rem', whiteSpace: 'nowrap' }}>{stat(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '.55rem .9rem', fontSize: '.72rem', color: 'var(--ink-muted)', borderTop: '1px solid var(--line)' }}>
        Skládá se automaticky z gólů, asistencí, hráčů zápasu a výsledků{d.tournament.best_team?.slots && Object.keys(d.tournament.best_team.slots).length ? '; část vybral pořadatel' : ''}.
      </div>
      {share && (
        <ShareBestTeamDialog
          tournament={d.tournament}
          sponsors={d.sponsors ?? []}
          scopes={scopes}
          initialScope={cur.value}
          hockey={getSportDef(d.tournament.sport).id === 'hockey'}
          url={url}
          codeUrl={withAccessCode(url, d.tournament)}
          onClose={() => setShare(false)}
          showToast={showToast}
        />
      )}
    </Card>
  )
}
