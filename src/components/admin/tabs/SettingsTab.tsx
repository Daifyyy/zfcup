import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface Props {
  showToast: (msg: string) => void
}

export default function SettingsTab({ showToast }: Props) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [loading, setLoading] = useState(false)

  const changePassword = async () => {
    if (!p1) { showToast('Zadejte nové heslo'); return }
    if (p1 !== p2) { showToast('Hesla se neshodují'); return }
    if (p1.length < 6) { showToast('Heslo musí mít alespoň 6 znaků'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setLoading(false)
    if (error) { showToast('Chyba: ' + error.message); return }
    setP1(''); setP2('')
    showToast('Heslo změněno ✓')
  }

  const resetData = async () => {
    if (!confirm('Opravdu smazat VŠECHNA data? Tuto akci nelze vrátit!')) return
    if (!confirm('Opravdu? Poslední potvrzení — smazat vše?')) return

    const tables = ['goals', 'matches', 'bracket_slots', 'bracket_rounds', 'players', 'teams', 'groups', 'announcements']
    for (const table of tables) {
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }
    await supabase.from('tournament').update({ name: '', subtitle: '', date: '', venue: '', description: '' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    showToast('Vše smazáno')
  }

  return (
    <div>
      <div className="info-box">
        <strong>Supabase</strong> je nakonfigurováno a data se ukládají do databáze v reálném čase.
        Přihlašování probíhá přes Supabase Auth (email + heslo).
      </div>

      <div className="sub-title">Změna hesla</div>
      <div className="field-group">
        <label className="field-label">Nové heslo</label>
        <input className="field-input" type="password" value={p1} onChange={e => setP1(e.target.value)} placeholder="Nové heslo (min. 6 znaků)" />
      </div>
      <div className="field-group">
        <label className="field-label">Potvrdit heslo</label>
        <input className="field-input" type="password" value={p2} onChange={e => setP2(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && changePassword()} placeholder="Znovu nové heslo" />
      </div>
      <button className="btn btn-s" onClick={changePassword} disabled={loading}>
        {loading ? 'Ukládám…' : '🔑 Změnit heslo'}
      </button>

      <hr className="divider" />
      <div className="sub-title">Nebezpečná zóna</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Smaže veškerá data turnaje nevratně. Účet Supabase Auth zůstane zachován.
      </p>
      <button
        className="btn btn-d"
        style={{ border: '1px solid var(--border)' }}
        onClick={resetData}
      >
        🗑 Vymazat vše
      </button>
    </div>
  )
}
