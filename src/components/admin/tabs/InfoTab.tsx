import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import RichTextEditor from '../../ui/RichTextEditor'

interface Props {
  tournament: Tournament | null
  refetchTournament: () => void
  showToast: (msg: string) => void
}

export default function InfoTab({ tournament, refetchTournament, showToast }: Props) {
  const [form, setForm] = useState({ name: '', subtitle: '', date: '', venue: '', description: '' })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    refetchTournament()
    showToast('Uloženo ✓')
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const uploadLogo = async (file: File) => {
    if (!file.type.includes('png')) { showToast('Pouze PNG soubory'); return }
    if (file.size > 512_000) { showToast('Max velikost je 500 KB'); return }
    if (!tournament?.id) return
    setUploading(true)
    const path = 'tournament-logo.png'
    const { error: upErr } = await supabase.storage.from('team-logos').upload(path, file, { upsert: true })
    if (upErr) { showToast('Chyba uploadu: ' + upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
    const urlWithTs = `${data.publicUrl}?v=${Date.now()}`
    const { error } = await supabase.from('tournament').update({ logo_url: urlWithTs }).eq('id', tournament.id)
    setUploading(false)
    if (error) showToast('Chyba: ' + error.message)
    else { refetchTournament(); showToast('Logo nahráno ✓') }
  }

  const removeLogo = async () => {
    if (!tournament?.id || !confirm('Smazat logo turnaje?')) return
    await supabase.storage.from('team-logos').remove(['tournament-logo.png'])
    await supabase.from('tournament').update({ logo_url: null }).eq('id', tournament.id)
    refetchTournament()
    showToast('Logo odstraněno')
  }

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

      <button type="button" className="btn btn-p btn-full" onClick={save}>💾 Uložit</button>

      <hr className="divider" />
      <div className="sub-title">Logo turnaje</div>
      <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.65rem' }}>
        PNG · čtverec · max 500 KB · doporučeno 400×400 px
      </div>
      {tournament?.logo_url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
          <img src={tournament.logo_url} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)', background: '#fff' }} alt="logo" />
          <button type="button" className="btn btn-d btn-sm" onClick={removeLogo}>Smazat logo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <input ref={fileRef} type="file" accept=".png,image/png" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
          <button type="button" className="btn btn-s btn-sm" onClick={() => fileRef.current?.click()} style={{ opacity: uploading ? .6 : 1 }}>
            {uploading ? 'Nahrávám…' : '↑ Nahrát logo'}
          </button>
        </div>
      )}
    </div>
  )
}
