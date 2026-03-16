import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import { TEAM_COLORS } from '../../../lib/constants'

interface Props {
  teams: Team[]
  players: Player[]
  showToast: (msg: string) => void
}

const BADGE_CAPTAIN = { label: 'C', color: '#92400e', bg: 'rgba(217,119,6,.12)',  border: 'rgba(217,119,6,.3)' }
const BADGE_GOALKEEPER = { label: 'B', color: '#166534', bg: 'rgba(22,163,74,.12)', border: 'rgba(22,163,74,.3)' }

function Badge({ b }: { b: typeof BADGE_CAPTAIN }) {
  return (
    <span style={{
      fontSize: '.65rem', fontWeight: 700, color: b.color,
      background: b.bg, border: `1px solid ${b.border}`,
      borderRadius: 4, padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
    }}>{b.label}</span>
  )
}

function RoleBadge({ role }: { role: string | null }) {
  if (role === 'captain')    return <Badge b={BADGE_CAPTAIN} />
  if (role === 'goalkeeper') return <Badge b={BADGE_GOALKEEPER} />
  if (role === 'both')       return <><Badge b={BADGE_CAPTAIN} /><Badge b={BADGE_GOALKEEPER} /></>
  return null
}

function LogoSection({ team, showToast }: { team: Team; showToast: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const uploadLogo = async (file: File) => {
    if (!file.type.includes('png')) { showToast('Pouze PNG soubory'); return }
    if (file.size > 512_000) { showToast('Max velikost je 500 KB'); return }
    setUploading(true)
    const path = `${team.id}.png`
    const { error: upErr } = await supabase.storage
      .from('team-logos')
      .upload(path, file, { upsert: true })
    if (upErr) { showToast('Chyba uploadu: ' + upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
    const urlWithTs = `${data.publicUrl}?v=${Date.now()}`
    const { error } = await supabase.from('teams').update({ logo_url: urlWithTs }).eq('id', team.id)
    setUploading(false)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Logo nahráno ✓')
  }

  const removeLogo = async () => {
    if (!confirm('Smazat logo?')) return
    await supabase.storage.from('team-logos').remove([`${team.id}.png`])
    await supabase.from('teams').update({ logo_url: null }).eq('id', team.id)
    showToast('Logo odstraněno')
  }

  return (
    <div style={{ marginTop: '.65rem', paddingTop: '.65rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.67rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.4rem' }}>
        Logo týmu
      </div>
      <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.5rem' }}>
        PNG · čtverec · max 500 KB · doporučeno 200×200 px
      </div>
      {team.logo_url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
          <img src={team.logo_url} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'contain', border: '1px solid var(--border)', background: '#fff' }} />
          <button type="button" className="btn btn-d btn-sm" onClick={removeLogo}>Smazat logo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".png,image/png"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
          />
          <button type="button" className="btn btn-s btn-sm" onClick={() => fileRef.current?.click()} style={{ opacity: uploading ? .6 : 1 }}>
            {uploading ? 'Nahrávám…' : '↑ Nahrát logo'}
          </button>
        </div>
      )}
    </div>
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem', flex: 1, minWidth: 0 }}>
                <span className="a-item-main" style={{ fontSize: '.8rem' }}>{p.name}</span>
                <RoleBadge role={p.role} />
              </span>
              <button type="button" className="btn btn-d btn-sm" onClick={() => removePlayer(p.id)}>✕</button>
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
            <option value="both">Kapitán + Brankář</option>
          </select>
        </div>
        <button type="button" className="btn btn-s btn-sm" onClick={addPlayer} style={{ flexShrink: 0, marginBottom: 1 }}>+ Přidat</button>
      </div>
    </div>
  )
}

export default function TeamsTab({ teams, players, showToast }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TEAM_COLORS[0])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

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

  const startEdit = (t: Team) => {
    setEditingId(t.id)
    setEditingName(t.name)
  }

  const saveEdit = async (id: string) => {
    if (!editingName.trim()) { showToast('Název nesmí být prázdný'); return }
    const { error } = await supabase.from('teams').update({ name: editingName.trim() }).eq('id', id)
    if (error) { showToast('Chyba: ' + error.message); return }
    setEditingId(null)
    showToast('Název uložen ✓')
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
      <button type="button" className="btn btn-p" onClick={addTeam}>+ Přidat tým</button>

      <hr className="divider" />
      <div className="sub-title">Týmy ({teams.length})</div>
      {!teams.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádné týmy.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {teams.map(t => {
            const expanded = expandedId === t.id
            const isEditing = editingId === t.id
            const playerCount = players.filter(p => p.team_id === t.id).length
            return (
              <div key={t.id} style={{ background: '#f8fafc', border: `1px solid ${isEditing ? 'rgba(37,99,235,.35)' : 'var(--border)'}`, borderRadius: 9, overflow: 'hidden' }}>
                <div style={{ padding: '.55rem .9rem', display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                  {t.logo_url ? (
                    <img src={t.logo_url} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                  ) : (
                    <div className="team-dot" style={{ background: t.color, width: 11, height: 11 }} />
                  )}
                  {isEditing ? (
                    <input
                      className="field-input"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(t.id); if (e.key === 'Escape') setEditingId(null) }}
                      style={{ flex: 1, fontSize: '.85rem', padding: '.28rem .5rem' }}
                      autoFocus
                    />
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{t.name}</div>
                      <div style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{playerCount} hráčů</div>
                    </div>
                  )}
                  {isEditing ? (
                    <>
                      <button type="button" className="btn btn-p btn-sm" onClick={() => saveEdit(t.id)}>✓</button>
                      <button type="button" className="btn btn-d btn-sm" onClick={() => setEditingId(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-d btn-sm" onClick={() => startEdit(t)}>✎</button>
                      <button type="button" className="btn btn-s btn-sm" onClick={() => setExpandedId(expanded ? null : t.id)}>
                        {expanded ? '↑ Zavřít' : '⊕ Soupiska'}
                      </button>
                      <button type="button" className="btn btn-d btn-sm" onClick={() => removeTeam(t.id)}>Smazat</button>
                    </>
                  )}
                </div>
                {expanded && !isEditing && (
                  <div style={{ padding: '0 .9rem .75rem' }}>
                    <LogoSection team={t} showToast={showToast} />
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
