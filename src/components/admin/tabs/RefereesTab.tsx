import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Referee } from '../../../hooks/useReferees'

interface Props {
  referees: Referee[]
  refetchReferees: () => void
  showToast: (msg: string) => void
}

export default function RefereesTab({ referees, refetchReferees, showToast }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const addReferee = async () => {
    const trimmed = name.trim()
    if (!trimmed) { showToast('Zadejte jméno rozhodčího'); return }
    setSaving(true)
    const { error } = await supabase.from('referees').insert({ name: trimmed })
    setSaving(false)
    if (error) { showToast('Chyba: ' + error.message); return }
    setName('')
    refetchReferees()
    showToast('Rozhodčí přidán ✓')
  }

  const removeReferee = async (id: string) => {
    if (!confirm('Smazat rozhodčího?')) return
    const { error } = await supabase.from('referees').delete().eq('id', id)
    if (error) { showToast('Chyba: ' + error.message); return }
    refetchReferees()
    showToast('Smazáno')
  }

  return (
    <div>
      <div className="sub-title">Rozhodčí</div>

      {referees.length === 0 ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.85rem' }}>Žádní rozhodčí.</p>
      ) : (
        <div className="a-list" style={{ marginBottom: '1rem' }}>
          {referees.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.45rem .7rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: '.84rem', fontWeight: 500 }}>⚖ {r.name}</span>
              <button type="button" className="btn btn-d btn-sm" onClick={() => removeReferee(r.id)}>Smazat</button>
            </div>
          ))}
        </div>
      )}

      <div className="field-group">
        <label className="field-label">Jméno nového rozhodčího</label>
        <input
          className="field-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addReferee() }}
          placeholder="Jan Novák"
        />
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-p" onClick={addReferee} style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Ukládám…' : '+ Přidat rozhodčího'}
        </button>
      </div>
    </div>
  )
}
