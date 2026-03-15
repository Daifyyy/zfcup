import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
  showToast: (msg: string) => void
}

export default function SettingsTab({ tournament, showToast }: Props) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleTips = async () => {
    if (!tournament) return
    const { error } = await supabase
      .from('tournament')
      .update({ tips_enabled: !tournament.tips_enabled })
      .eq('id', tournament.id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast(tournament.tips_enabled ? 'Tipovačka vypnuta' : 'Tipovačka zapnuta ✓')
  }

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
      <div className="sub-title">Tipovačka</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.7rem .9rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '.85rem' }}>Zobrazit tipovačku uživatelům</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
            {tournament?.tips_enabled ? 'Tipovačka je viditelná v navigaci' : 'Tipovačka je skrytá — jen ty ji vidíš'}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTips}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: tournament?.tips_enabled ? 'var(--accent)' : '#cbd5e1',
            position: 'relative', transition: 'background .2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, borderRadius: '50%',
            width: 18, height: 18, background: '#fff',
            left: tournament?.tips_enabled ? 23 : 3,
            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </button>
      </div>

      <hr className="divider" />
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
