import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
  showToast: (msg: string) => void
}

export default function InfoTab({ tournament, showToast }: Props) {
  const [form, setForm] = useState({ name: '', subtitle: '', date: '', venue: '', description: '' })

  useEffect(() => {
    if (tournament) setForm({
      name: tournament.name,
      subtitle: tournament.subtitle,
      date: tournament.date,
      venue: tournament.venue,
      description: tournament.description,
    })
  }, [tournament])

  const save = async () => {
    if (!tournament?.id) return
    const { error } = await supabase.from('tournament').update(form).eq('id', tournament.id)
    if (error) { showToast('Chyba: ' + error.message); return }
    showToast('Uloženo ✓')
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="field-group">
        <label className="field-label">Název turnaje</label>
        <input className="field-input" value={form.name} onChange={f('name')} placeholder="Firemní fotbalový turnaj" />
      </div>
      <div className="field-group">
        <label className="field-label">Podnázev / rok</label>
        <input className="field-input" value={form.subtitle} onChange={f('subtitle')} placeholder="2025" />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Datum</label>
          <input className="field-input" value={form.date} onChange={f('date')} placeholder="15. 6. 2025" />
        </div>
        <div className="field-group">
          <label className="field-label">Místo</label>
          <input className="field-input" value={form.venue} onChange={f('venue')} placeholder="Sportovní hala" />
        </div>
      </div>
      <div className="field-group">
        <label className="field-label">Popis</label>
        <textarea
          className="field-input"
          value={form.description}
          onChange={f('description')}
          placeholder="Stručný popis turnaje…"
          style={{ resize: 'vertical', minHeight: 80, lineHeight: 1.5 }}
        />
      </div>
      <button className="btn btn-p btn-full" onClick={save}>💾 Uložit</button>
    </div>
  )
}
