import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import { isMissingColumnError } from '../../../lib/partners'

interface Props {
  tournament: Tournament | null
  refetchTournament: () => void
  showToast: (msg: string) => void
}

/** Admin → Info → Média: veřejná záložka pro novináře (kontakt, podklady, výsledkový servis). */
export default function MediaSection({ tournament, refetchTournament, showToast }: Props) {
  const [form, setForm] = useState({ press_enabled: false, press_contact_name: '', press_contact_email: '', press_contact_phone: '', press_note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tournament) return
    setForm({
      press_enabled: tournament.press_enabled ?? false,
      press_contact_name: tournament.press_contact_name ?? '',
      press_contact_email: tournament.press_contact_email ?? '',
      press_contact_phone: tournament.press_contact_phone ?? '',
      press_note: tournament.press_note ?? '',
    })
  }, [tournament?.id, tournament?.press_enabled, tournament?.press_contact_name, tournament?.press_contact_email, tournament?.press_contact_phone, tournament?.press_note])

  async function save() {
    if (saving || !tournament) return
    setSaving(true)
    try {
      const { error } = await supabase.from('tournament').update({
        press_enabled: form.press_enabled,
        press_contact_name: form.press_contact_name.trim(),
        press_contact_email: form.press_contact_email.trim(),
        press_contact_phone: form.press_contact_phone.trim(),
        press_note: form.press_note.trim(),
      }).eq('id', tournament.id)
      if (error) {
        showToast(isMissingColumnError(error, 'press_')
          ? 'Mediální sekce vyžaduje migraci db-backup/08_partners_branding_media.sql'
          : 'Chyba: ' + error.message)
        return
      }
      refetchTournament()
      showToast('Uloženo')
    } finally {
      setSaving(false)
    }
  }

  const f = (k: 'press_contact_name' | 'press_contact_email' | 'press_contact_phone' | 'press_note') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="sub-title">Média a tisk</div>
      <div className="info-box">
        Zapne veřejnou záložku <strong>Média</strong>: kontakt pro novináře, loga ke stažení
        a výsledkový servis (export výsledků, tabulek a střelců do Excelu, tisknutelný bulletin).
      </div>

      <label className="chk-item" style={{ marginBottom: '.8rem' }}>
        <input type="checkbox" checked={form.press_enabled} onChange={e => setForm(p => ({ ...p, press_enabled: e.target.checked }))} />
        <span style={{ fontSize: '.88rem', fontWeight: 600 }}>Zobrazit záložku Média</span>
      </label>

      <div className="field-group">
        <label className="field-label">Kontaktní osoba pro média</label>
        <input className="field-input" value={form.press_contact_name} onChange={f('press_contact_name')} placeholder="Jméno a pozice" />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label className="field-label">E-mail</label>
          <input className="field-input" type="email" value={form.press_contact_email} onChange={f('press_contact_email')} placeholder="media@firma.cz" />
        </div>
        <div className="field-group">
          <label className="field-label">Telefon</label>
          <input className="field-input" type="tel" value={form.press_contact_phone} onChange={f('press_contact_phone')} placeholder="+420 …" />
        </div>
      </div>
      <div className="field-group">
        <label className="field-label">Poznámka pro média (akreditace, focení, parkování…)</label>
        <textarea className="field-input" rows={3} value={form.press_note} onChange={f('press_note')} />
      </div>

      <button type="button" className="btn btn-p" onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Ukládám…' : 'Uložit mediální sekci'}
      </button>
    </div>
  )
}
