import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import { TEAM_COLORS } from '../../../lib/constants'

interface Props {
  teams: Team[]
  players: Player[]
  showToast: (msg: string) => void
}

const ROLE_LABELS: Record<string, string> = { captain: 'C', goalkeeper: 'B' }
const ROLE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  captain:    { color: '#92400e', bg: 'rgba(217,119,6,.12)',  border: 'rgba(217,119,6,.3)' },
  goalkeeper: { color: '#166534', bg: 'rgba(22,163,74,.12)', border: 'rgba(22,163,74,.3)' },
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role || !ROLE_LABELS[role]) return null
  const s = ROLE_COLORS[role]
  return (
    <span style={{
      fontSize: '.65rem', fontWeight: 700, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 4, padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
    }}>{ROLE_LABELS[role]}</span>
  )
}

function RosterSection({ team, players, showToast }: { team: Team; players: Player[]; showToast: (m: string) => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const roster = players.filter(p => p.team_id === team.id).sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  const addPlayer = async () => {
    if (!name.trim()) { showToast('Zadej jméno'); return }
    const { error } = await supabase.from('players').insert({
      team_id: team.id,
      name: name.trim(),
      number: null,
      role: role || null,
    })
    if (error) { showToast('Chyba: ' + error.message); return }
    setName(''); setRole('')
    showToast('Hráč přidán ✓')
  }

  const removePlayer = async (id: string) => {
    if (!confirm('Smazat hráče?')) return
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Smazáno')
  }

  return (
    <div style={{ marginTop: '.65rem', paddingTop: '.65rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.67rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.5rem' }}>
        Soupiska ({roster.length} hráčů)
      </div>
      {roster.length > 0 && (
        <div className="a-list" style={{ marginBottom: '.5rem' }}>
          {roster.map(p => (
            <div key={p.id} className="a-item" style={{ padding: '.4rem .7rem' }}>
              <RoleBadge role={p.role} />
              <span className="a-item-main" style={{ fontSize: '.8rem' }}>{p.name}</span>
              <button className="btn btn-d btn-sm" onClick={() => removePlayer(p.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Jméno hráče</label>
          <input className="field-input" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Jan Novák" />
        </div>
        <div style={{ width: 110, flexShrink: 0 }}>
          <label className="field-label">Role</label>
          <select className="field-input field-select" value={role} onChange={e => setRole(e.target.value)}>
            <option value="">Žádná</option>
            <option value="captain">Kapitán (C)</option>
            <option value="goalkeeper">Brankář (B)</option>
          </select>
        </div>
        <button className="btn btn-s btn-sm" onClick={addPlayer} style={{ flexShrink: 0, marginBottom: 1 }}>+ Přidat</button>
      </div>
    </div>
  )
}

export default function TeamsTab({ teams, players, showToast }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TEAM_COLORS[0])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const addTeam = async () => {
    if (!name.trim()) { showToast('Zadej název'); return }
    const { error } = await supabase.from('teams').insert({ name: name.trim(), color })
    if (error) { showToast('Chyba: ' + error.message); return }
    setName('')
    showToast('Tým přidán ✓')
  }

  const removeTeam = async (id: string) => {
    if (!confirm('Smazat tým? Smaže se i soupiska a přiřazené zápasy.')) return
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Tým smazán')
  }

  return (
    <div>
      <div className="sub-title">Přidat tým</div>
      <div className="field-group">
        <label className="field-label">Název týmu</label>
        <input className="field-input" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTeam()} placeholder="FC Účetnictví" />
      </div>
      <div className="field-group">
        <label className="field-label">Barva</label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {TEAM_COLORS.map(c => (
            <div key={c} className={`color-swatch${color === c ? ' selected' : ''}`}
              style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <button className="btn btn-p" onClick={addTeam}>+ Přidat tým</button>

      <hr className="divider" />
      <div className="sub-title">Týmy ({teams.length})</div>
      {!teams.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádné týmy.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {teams.map(t => {
            const expanded = expandedId === t.id
            const playerCount = players.filter(p => p.team_id === t.id).length
            return (
              <div key={t.id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                <div style={{ padding: '.55rem .9rem', display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                  <div className="team-dot" style={{ background: t.color, width: 11, height: 11 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{t.name}</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{playerCount} hráčů</div>
                  </div>
                  <button className="btn btn-s btn-sm" onClick={() => setExpandedId(expanded ? null : t.id)}>
                    {expanded ? '↑ Zavřít' : '⊕ Soupiska'}
                  </button>
                  <button className="btn btn-d btn-sm" onClick={() => removeTeam(t.id)}>Smazat</button>
                </div>
                {expanded && (
                  <div style={{ padding: '0 .9rem .75rem' }}>
                    <RosterSection team={t} players={players} showToast={showToast} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
