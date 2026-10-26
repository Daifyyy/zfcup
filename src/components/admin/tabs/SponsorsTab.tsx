import { useState, useEffect } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import type { Sponsor } from '../../../hooks/useSponsors'
import { PARTNER_TIERS, sortByTier, tierOf, tierLabel, isMissingColumnError, type PartnerTier } from '../../../lib/partners'

interface Props {
  sponsors: Sponsor[]
  tournament: { id: string } | null
  refetchSponsors: () => void
  showToast: (msg: string) => void
}

const EMPTY_FORM: { name: string; logo_url: string; website_url: string; tier: PartnerTier } = { name: '', logo_url: '', website_url: '', tier: 'partner' }
const MIGRATION_HINT = 'Úroveň partnera se neuložila — spusťte v Supabase migraci db-backup/08_partners_branding_media.sql'

export default function SponsorsTab({ sponsors, tournament, refetchSponsors, showToast }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [items, setItems] = useState(() => sortByTier(sponsors))
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(sortByTier(sponsors)) }, [sponsors])

  /** Uloží záznam; pokud DB ještě nemá sloupec tier (bez migrace 08), uloží bez něj. */
  async function writeSponsor(payload: Record<string, unknown>): Promise<{ ok: boolean; tierDropped: boolean }> {
    const run = (p: Record<string, unknown>) => editId
      ? supabase.from('sponsors').update(p).eq('id', editId)
      : supabase.from('sponsors').insert(p)
    const { error } = await run(payload)
    if (!error) return { ok: true, tierDropped: false }
    if (isMissingColumnError(error, 'tier')) {
      const { tier: _tier, ...rest } = payload
      const retry = await run(rest)
      if (!retry.error) return { ok: true, tierDropped: true }
      showToast('Chyba: ' + retry.error.message)
      return { ok: false, tierDropped: true }
    }
    showToast('Chyba: ' + error.message)
    return { ok: false, tierDropped: false }
  }

  const save = async () => {
    if (saving) return
    if (!tournament) return
    if (!form.name.trim()) { showToast('Zadejte název partnera'); return }
    setSaving(true)
    try {
      const base = {
        name: form.name.trim(),
        logo_url: form.logo_url.trim(),
        website_url: form.website_url.trim(),
        tier: form.tier,
      }
      const payload = editId ? base : { ...base, tournament_id: tournament.id, position: items.length }
      const { ok, tierDropped } = await writeSponsor(payload)
      if (!ok) return
      setForm(EMPTY_FORM)
      setEditId(null)
      refetchSponsors()
      showToast(tierDropped ? MIGRATION_HINT : 'Uloženo')
    } finally {
      setSaving(false)
    }
  }

  const edit = (s: Sponsor) => {
    setForm({ name: s.name, logo_url: s.logo_url, website_url: s.website_url, tier: tierOf(s) })
    setEditId(s.id)
  }

  const remove = async (s: Sponsor) => {
    if (!confirm(`Smazat partnera "${s.name}"?`)) return
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
        showToast('Logo nahráno')
      } else {
        setForm(f => ({ ...f, logo_url: url }))
        showToast('Logo připraveno')
      }
    } finally {
      setUploading(false)
    }
  }

  /** Prohodí pořadí se sousedem ve stejné úrovni (optimisticky, při chybě revert). */
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= items.length) return
    if (tierOf(items[index]) !== tierOf(items[j])) return
    const snapshot = items
    const next = [...items]
    ;[next[index], next[j]] = [next[j], next[index]]
    setItems(next)
    const a = snapshot[index], b = snapshot[j]
    const [r1, r2] = await Promise.all([
      supabase.from('sponsors').update({ position: b.position }).eq('id', a.id),
      supabase.from('sponsors').update({ position: a.position }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(snapshot); showToast('Chyba řazení') }
    else refetchSponsors()
  }

  const titleCount = items.filter(s => tierOf(s) === 'title').length

  return (
    <div>
      <div className="sub-title">{editId ? 'Upravit partnera' : 'Přidat partnera'}</div>

      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Název</label>
          <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Název firmy" />
        </div>
        <div className="field-group">
          <label className="field-label">Úroveň</label>
          <select className="field-input field-select" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value as PartnerTier }))}>
            {PARTNER_TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>
      {form.tier === 'title' && (
        <div className="info-box">
          Generální partner se zobrazí jako „Presented by“ v hlavičce webu, na úvodní stránce i na TV tabuli.
          {titleCount > 0 && !(editId && items.find(s => s.id === editId && tierOf(s) === 'title')) && ' Generální partner už je nastaven — zobrazí se ten první v pořadí.'}
        </div>
      )}

      <div className="field-group">
        <label className="field-label">Web (URL)</label>
        <input className="field-input" type="url" value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://firma.cz" />
      </div>

      <div className="field-group">
        <label className="field-label">Logo (PNG/JPG, max 500 KB — ideálně průhledné PNG na šířku)</label>
        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} id="sponsor-logo-input"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="sponsor-logo-input" className="btn btn-s" style={{ cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
            <ImagePlus size={15} />{uploading ? 'Nahrávám…' : 'Vybrat logo'}
          </label>
          {form.logo_url && (
            <img src={form.logo_url} alt="" style={{ height: 40, maxWidth: 120, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)', background: '#fff' }} />
          )}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-p" onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Ukládám…' : (editId ? 'Uložit změny' : 'Přidat partnera')}
        </button>
        {editId && (
          <button type="button" className="btn btn-d btn-sm" onClick={() => { setForm(EMPTY_FORM); setEditId(null) }}>Zrušit</button>
        )}
      </div>

      {items.length > 0 && (
        <>
          <hr className="divider" />
          <div className="sub-title">Partneři ({items.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
            {items.map((s, i) => {
              const tier = tierOf(s)
              const newTier = i === 0 || tierOf(items[i - 1]) !== tier
              const canUp = i > 0 && tierOf(items[i - 1]) === tier
              const canDown = i < items.length - 1 && tierOf(items[i + 1]) === tier
              return (
                <div key={s.id}>
                  {newTier && (
                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-muted)', margin: i === 0 ? '0 0 .3rem' : '.6rem 0 .3rem' }}>
                      {tierLabel(tier)}
                    </div>
                  )}
                  <div className="a-item">
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} style={{ width: 64, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)', background: '#fff', display: 'block' }} />
                      ) : (
                        <div style={{ width: 64, height: 36, borderRadius: 4, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.62rem', color: 'var(--muted)' }}>+ logo</div>
                      )}
                      <label htmlFor={`logo-edit-${s.id}`} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} title="Nahrát / nahradit logo" />
                      <input type="file" id={`logo-edit-${s.id}`} accept="image/png,image/jpeg" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f, s.id) }} />
                    </div>

                    <div className="a-item-main" style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '(bez názvu)'}</div>
                      {s.website_url && <div className="a-item-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.website_url}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: '.25rem', flexShrink: 0 }}>
                      <button type="button" className="btn btn-d btn-sm" title="Posunout výš" onClick={() => move(i, -1)} style={{ opacity: canUp ? 1 : 0.3 }}><ArrowUp size={14} /></button>
                      <button type="button" className="btn btn-d btn-sm" title="Posunout níž" onClick={() => move(i, 1)} style={{ opacity: canDown ? 1 : 0.3 }}><ArrowDown size={14} /></button>
                      <button type="button" className="btn btn-d btn-sm" title="Upravit" onClick={() => edit(s)}><Pencil size={14} /></button>
                      <button type="button" className="btn btn-d btn-sm" title="Smazat" onClick={() => remove(s)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
