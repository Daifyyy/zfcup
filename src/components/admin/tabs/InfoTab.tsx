import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import RichTextEditor from '../../ui/RichTextEditor'

interface Props {
  tournament: Tournament | null
  showToast: (msg: string) => void
}

export default function InfoTab({ tournament, showToast }: Props) {
  const [form, setForm] = useState({ name: '', subtitle: '', date: '', venue: '', description: '', rules_content: '' })

  useEffect(() => {
    if (tournament) setForm({
      name: tournament.name,
      subtitle: tournament.subtitle,
      date: tournament.date,
      venue: tournament.venue,
      description: tournament.description,
      rules_content: tournament.rules_content ?? '',
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
        <RichTextEditor
          content={form.description}
          onChange={html => setForm(p => ({ ...p, description: html }))}
        />
      </div>

      <hr className="divider" />
      <div className="sub-title">Pravidla soutěže</div>
      <div className="field-group">
        <label className="field-label">Text pravidel</label>
        <textarea
          className="field-input"
          value={form.rules_content}
          onChange={f('rules_content')}
          placeholder={'Napište pravidla soutěže…\n\nPříklad:\nZápasy trvají 2×10 minut.\nZa výhru 3 body, remízu 1 bod, prohru 0 bodů.'}
          style={{ resize: 'vertical', minHeight: 200, lineHeight: 1.6, fontFamily: 'inherit' }}
        />
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 4 }}>
          Zobrazí se v záložce Pravidla. Nové řádky a odsazení jsou zachovány.
        </div>
      </div>

      <button type="button" className="btn btn-p btn-full" onClick={save}>💾 Uložit</button>
    </div>
  )
}
