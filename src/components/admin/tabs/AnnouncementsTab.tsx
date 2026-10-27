import { useState, useEffect } from 'react'
import { ArrowDown, ArrowUp, Check, ImageIcon, Megaphone, Pencil, PlayCircle, Trash2, Upload, X } from 'lucide-react'
import { confirmDialog } from '../../ui/ConfirmDialog'
import { supabase } from '../../../lib/supabase'
import type { Announcement } from '../../../hooks/useAnnouncements'
import RichTextEditor from '../../ui/RichTextEditor'
import { ANNOUNCEMENT_ICONS, DEFAULT_ANNOUNCEMENT_ICON, announcementIcon, announcementIconKey } from '../../../lib/announcementIcons'
import { removeAssetByUrl, storagePathFromUrl, tournamentAssetPath, uploadAsset } from '../../../lib/storage'

type AType = 'text' | 'image' | 'video'
const EMPTY_FORM = { icon: DEFAULT_ANNOUNCEMENT_ICON, title: '', body: '', type: 'text' as AType, media_url: '' }

const TYPES: { value: AType; label: string; Icon: typeof Megaphone }[] = [
  { value: 'text', label: 'Oznámení', Icon: Megaphone },
  { value: 'image', label: 'Obrázek', Icon: ImageIcon },
  { value: 'video', label: 'Video', Icon: PlayCircle },
]

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

interface Props {
  announcements: Announcement[]
  tournament: { id: string } | null
  refetchAnnouncements: () => void
  showToast: (msg: string) => void
}

export default function AnnouncementsTab({ announcements, tournament, refetchAnnouncements, showToast }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [items, setItems] = useState(announcements)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(announcements) }, [announcements])

  const save = async () => {
    if (saving) return
    if (form.type === 'video' && form.media_url && !extractYoutubeId(form.media_url)) {
      showToast('Neplatná YouTube URL'); return
    }
    if (form.type !== 'text' && !form.media_url.trim()) {
      showToast(form.type === 'video' ? 'Vlož odkaz na YouTube video' : 'Nahraj obrázek nebo vlož jeho adresu'); return
    }
    setSaving(true)
    try {
      const data = {
        icon: form.icon,
        title: form.title.trim(),
        body: form.type === 'video' ? '' : form.body.trim(),
        type: form.type,
        media_url: form.type === 'text' ? null : form.media_url.trim() || null,
      }
      if (editId) {
        const { error } = await supabase.from('announcements').update(data).eq('id', editId)
        if (error) { showToast('Chyba: ' + error.message); return }
      } else {
        const { error } = await supabase.from('announcements').insert({ ...data, position: items.length, tournament_id: tournament?.id })
        if (error) { showToast('Chyba: ' + error.message); return }
      }
      setForm(EMPTY_FORM)
      setEditId(null)
      refetchAnnouncements()
      showToast('Uloženo')
    } finally {
      setSaving(false)
    }
  }

  const edit = (a: Announcement) => {
    setForm({ icon: announcementIconKey(a.icon), title: a.title, body: a.body, type: a.type ?? 'text', media_url: a.media_url ?? '' })
    setEditId(a.id)
  }

  const remove = async (id: string) => {
    if (!await confirmDialog('Smazat oznámení?', { danger: true })) return
    const media = items.find(x => x.id === id)?.media_url
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) { showToast('Chyba: ' + error.message); return }
    // Nahraný obrázek (jen z úložiště tohoto turnaje) uklidit
    if (media && tournament?.id && storagePathFromUrl(media)?.startsWith(`tournaments/${tournament.id}/`)) await removeAssetByUrl(media)
    refetchAnnouncements()
    showToast('Smazáno')
  }

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir
    if (other < 0 || other >= items.length) return
    const snapshot = items
    const next = [...items]
    ;[next[index], next[other]] = [next[other], next[index]]
    setItems(next)
    const a = snapshot[index], b = snapshot[other]
    const [r1, r2] = await Promise.all([
      supabase.from('announcements').update({ position: b.position }).eq('id', a.id),
      supabase.from('announcements').update({ position: a.position }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(snapshot); showToast('Chyba řazení') }
    else refetchAnnouncements()
  }

  const uploadImage = async (file: File) => {
    if (uploading || !tournament?.id) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { showToast('Obrázek musí být PNG, JPG nebo WebP'); return }
    if (file.size > 2 * 1024 * 1024) { showToast('Obrázek může mít nejvýš 2 MB'); return }
    setUploading(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const res = await uploadAsset(tournamentAssetPath(tournament.id, 'announcements', crypto.randomUUID(), ext), file)
      if ('error' in res) { showToast('Chyba uploadu: ' + res.error); return }
      setForm(f => ({ ...f, media_url: res.url }))
      showToast('Obrázek nahrán — nezapomeň uložit')
    } finally {
      setUploading(false)
    }
  }

  const videoId = form.type === 'video' && form.media_url ? extractYoutubeId(form.media_url) : null

  return (
    <div>
      <div className="sub-title">{editId ? 'Upravit položku' : 'Přidat položku'}</div>

      {/* Typ */}
      <div className="field-group">
        <label className="field-label">Typ</label>
        <div className="an-types" role="radiogroup" aria-label="Typ položky">
          {TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={form.type === t.value}
              className={`an-type${form.type === t.value ? ' an-type--on' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: t.value }))}
            >
              <t.Icon size={16} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ikona — pouze pro oznámení */}
      {form.type === 'text' && (
        <div className="field-group">
          <label className="field-label">Ikona</label>
          <div className="an-icons" role="radiogroup" aria-label="Ikona oznámení">
            {ANNOUNCEMENT_ICONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={form.icon === key}
                aria-label={label}
                title={label}
                className={`an-icon${form.icon === key ? ' an-icon--on' : ''}`}
                onClick={() => setForm(f => ({ ...f, icon: key }))}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field-group">
        <label className="field-label">Nadpis (volitelný)</label>
        <input
          className="field-input"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={form.type === 'video' ? 'Název videa' : form.type === 'image' ? 'Popisek obrázku' : 'Nadpis oznámení'}
        />
      </div>

      {/* Obrázek (nahrát / URL) nebo video (YouTube) */}
      {form.type !== 'text' && (
        <div className="field-group">
          <label className="field-label">{form.type === 'video' ? 'YouTube URL' : 'Obrázek'}</label>
          {form.type === 'image' && (
            <label className="btn btn-s btn-sm an-upload" style={{ opacity: uploading ? 0.6 : 1 }}>
              <Upload size={14} />{uploading ? 'Nahrávám…' : 'Nahrát obrázek (PNG/JPG/WebP, max 2 MB)'}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadImage(f) }} />
            </label>
          )}
          <input
            className="field-input"
            value={form.media_url}
            onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))}
            placeholder={form.type === 'video' ? 'https://youtu.be/…' : 'nebo vlož adresu obrázku https://…'}
          />
          {form.type === 'image' && form.media_url && (
            <img
              src={form.media_url}
              alt="Náhled"
              className="an-preview"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          {form.type === 'video' && form.media_url && (videoId
            ? <div className="an-hint an-hint--ok"><Check size={13} />Video ID: <strong>{videoId}</strong></div>
            : <div className="an-hint an-hint--err"><X size={13} />Neplatná YouTube URL</div>)}
        </div>
      )}

      {/* Textové tělo — pro oznámení a obrázek */}
      {form.type !== 'video' && (
        <div className="field-group">
          <label className="field-label">Text (volitelný)</label>
          <RichTextEditor content={form.body} onChange={html => setForm(f => ({ ...f, body: html }))} />
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-p" onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>{editId ? 'Uložit změny' : '+ Přidat'}</button>
        {editId && <button type="button" className="btn btn-d btn-sm" onClick={() => { setEditId(null); setForm(EMPTY_FORM) }}>Zrušit úpravy</button>}
      </div>

      <hr className="divider" />
      <div className="sub-title">Položky</div>
      {!items.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádná oznámení.</p>
      ) : (
        <div className="a-list">
          {items.map((a, i) => {
            const ItemIcon = a.type === 'image' ? ImageIcon : a.type === 'video' ? PlayCircle : announcementIcon(a.icon).Icon
            return (
              <div key={a.id} className="a-item">
                <span className="an-item-icon"><ItemIcon size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {a.title
                    ? <div className="a-item-main">{a.title}</div>
                    : <div className="a-item-main" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(bez nadpisu)</div>}
                  {a.body && <div className="a-item-sub">{a.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}</div>}
                  {a.media_url && <div className="a-item-sub" style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.media_url}</div>}
                </div>
                <button type="button" className="btn btn-s btn-sm" onClick={() => move(i, -1)} style={{ opacity: i === 0 ? 0.3 : 1 }} aria-label="Posunout nahoru" title="Nahoru"><ArrowUp size={14} /></button>
                <button type="button" className="btn btn-s btn-sm" onClick={() => move(i, 1)} style={{ opacity: i === items.length - 1 ? 0.3 : 1 }} aria-label="Posunout dolů" title="Dolů"><ArrowDown size={14} /></button>
                <button type="button" className="btn btn-s btn-sm" onClick={() => edit(a)} aria-label="Upravit" title="Upravit"><Pencil size={14} /></button>
                <button type="button" className="btn btn-d btn-sm" onClick={() => remove(a.id)} aria-label="Smazat" title="Smazat"><Trash2 size={14} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
