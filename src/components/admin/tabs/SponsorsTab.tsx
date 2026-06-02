import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Sponsor } from '../../../hooks/useSponsors'

interface Props {
  sponsors: Sponsor[]
  tournament: { id: string } | null
  refetchSponsors: () => void
  showToast: (msg: string) => void
}

const EMPTY_FORM = { name: '', logo_url: '', website_url: '' }

export default function SponsorsTab({ sponsors, tournament, refetchSponsors, showToast }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [items, setItems] = useState(sponsors)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(sponsors) }, [sponsors])

  const save = async () => {
    if (!tournament) return
    if (!form.name.trim()) { showToast('Zadejte název sponzora'); return }
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase.from('sponsors').update({
          name: form.name.trim(),
          logo_url: form.logo_url.trim(),
          website_url: form.website_url.trim(),
        }).eq('id', editId)
        if (error) { showToast('Chyba: ' + error.message); return }
      } else {
        const { error } = await supabase.from('sponsors').insert({
          tournament_id: tournament.id,
          name: form.name.trim(),
          logo_url: form.logo_url.trim(),
          website_url: form.website_url.trim(),
          position: items.length,
        })
        if (error) { showToast('Chyba: ' + error.message); return }
      }
      setForm(EMPTY_FORM)
      setEditId(null)
      refetchSponsors()
      showToast('Uloženo ✓')
    } finally {
      setSaving(false)
    }
  }

  const edit = (s: Sponsor) => {
    setForm({ name: s.name, logo_url: s.logo_url, website_url: s.website_url })
    setEditId(s.id)
  }

  const remove = async (s: Sponsor) => {
    if (!confirm(`Smazat sponzora "${s.name}"?`)) return
    if (s.logo_url && s.logo_url.includes('sponsors/')) {
      const path = s.logo_url.split('sponsors/')[1]?.split('?')[0]
      if (path) await supabase.storage.from('team-logos').remove([`sponsors/${path}`])
    }
    const { error } = await supabase.from('sponsors').delete().eq('id', s.id)
    if (error) { showToast('Chyba: ' + error.message); return }
    refetchSponsors()
    showToast('Smazáno')
  }

  const uploadLogo = async (file: File, sponsorId?: string) => {
    if (!file.type.match(/^image\/(png|jpeg)$/)) { showToast('Pouze PNG nebo JPG'); return }
    if (file.size > 500 * 1024) { showToast('Max. 500 KB'); return }
    const id = sponsorId ?? editId ?? `tmp_${Date.now()}`
    const ext = file.name.endsWith('.png') ? 'png' : 'jpg'
    setUploading(true)
    try {
      const path = `sponsors/${id}.${ext}`
      const { error } = await supabase.storage.from('team-logos').upload(path, file, { upsert: true })
      if (error) { showToast('Chyba uploadu: ' + error.message); return }
      const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
      const url = `${data.publicUrl}?v=${Date.now()}`
      if (sponsorId) {
        await supabase.from('sponsors').update({ logo_url: url }).eq('id', sponsorId)
        refetchSponsors()
        showToast('Logo nahráno ✓')
      } else {
        setForm(f => ({ ...f, logo_url: url }))
        showToast('Logo připraveno ✓')
      }
    } finally {
      setUploading(false)
    }
  }

  const moveUp = async (index: number) => {
    if (index === 0) return
    const snapshot = items
    const next = [...items]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setItems(next)
    const a = snapshot[index], b = snapshot[index - 1]
    const [r1, r2] = await Promise.all([
      supabase.from('sponsors').update({ position: b.position }).eq('id', a.id),
      supabase.from('sponsors').update({ position: a.position }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(snapshot); showToast('Chyba řazení') }
    else refetchSponsors()
  }

  const moveDown = async (index: number) => {
    if (index === items.length - 1) return
    const snapshot = items
    const next = [...items]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setItems(next)
    const a = snapshot[index], b = snapshot[index + 1]
    const [r1, r2] = await Promise.all([
      supabase.from('sponsors').update({ position: b.position }).eq('id', a.id),
      supabase.from('sponsors').update({ position: a.position }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(snapshot); showToast('Chyba řazení') }
    else refetchSponsors()
  }

  return (
    <div>
      <div className="sub-title">{editId ? 'Upravit sponzora' : 'Přidat sponzora'}</div>

      <div className="field-group">
        <label className="field-label">Název</label>
        <input
          className="field-input"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Název firmy"
        />
      </div>

      <div className="field-group">
        <label className="field-label">Web (URL)</label>
        <input
          className="field-input"
          type="url"
          value={form.website_url}
          onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
          placeholder="https://firma.cz"
        />
      </div>

      <div className="field-group">
        <label className="field-label">Logo (PNG/JPG, max 500 KB)</label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          id="sponsor-logo-input"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
        />
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="sponsor-logo-input" className="btn btn-s" style={{ cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Nahrávám…' : '📎 Vybrat logo'}
          </label>
          {form.logo_url && (
            <img src={form.logo_url} alt="" style={{ height: 40, maxWidth: 120, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)' }} />
          )}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-s" onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Ukládám…' : (editId ? '💾 Uložit změny' : '➕ Přidat sponzora')}
        </button>
        {editId && (
          <button type="button" className="btn btn-d btn-sm" onClick={() => { setForm(EMPTY_FORM); setEditId(null) }}>
            Zrušit
          </button>
        )}
      </div>

      {items.length > 0 && (
        <>
          <hr className="divider" />
          <div className="sub-title">Sponzoři ({items.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
            {items.map((s, i) => (
              <div key={s.id} style={{
                background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9,
                padding: '.6rem .9rem', display: 'flex', alignItems: 'center', gap: '.7rem',
              }}>
                {/* Logo náhled */}
                {s.logo_url ? (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={s.logo_url} alt={s.name} style={{ width: 60, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)', background: '#fff' }} />
                    <label htmlFor={`logo-edit-${s.id}`} style={{ position: 'absolute', inset: 0, cursor: 'pointer', opacity: 0 }} title="Nahradit logo" />
                    <input
                      type="file" id={`logo-edit-${s.id}`} accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f, s.id) }}
                    />
                  </div>
                ) : (
                  <label htmlFor={`logo-edit-${s.id}`} style={{
                    width: 60, height: 36, borderRadius: 4, border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.6rem', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
                  }}>
                    + logo
                    <input type="file" id={`logo-edit-${s.id}`} accept="image/png,image/jpeg" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f, s.id) }} />
                  </label>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '(bez názvu)'}</div>
                  {s.website_url && (
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.website_url}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
                  <button type="button" className="btn btn-d btn-sm" onClick={() => moveUp(i)} style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                  <button type="button" className="btn btn-d btn-sm" onClick={() => moveDown(i)} style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button type="button" className="btn btn-d btn-sm" onClick={() => edit(s)}>✎</button>
                  <button type="button" className="btn btn-d btn-sm" onClick={() => remove(s)} style={{ color: 'var(--danger)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
