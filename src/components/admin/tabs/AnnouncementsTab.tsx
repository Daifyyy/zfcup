import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Announcement } from '../../../hooks/useAnnouncements'

const ICONS = [
  // Turnaj / sport
  '📌', '⚽', '🏆', '🥇', '🥈', '🥉', '🏅', '⚔️', '🎯', '🏃',
  // Informace / upozornění
  '📢', '🔔', '⚠️', '✅', '❌', '❗', '💡', '📋', '📝', '🔍',
  // Čas / logistika
  '⏰', '⏱️', '📅', '🗓️', '🚗', '🅿️', '🚪', '📍', '🗺️', '🔑',
  // Jídlo / zábava
  '🍕', '🍺', '🥤', '☕', '🎉', '🎊', '🎶', '🎤', '👏', '🙌',
  // Různé
  '💪', '🤝', '👋', '😄', '🌤️', '🌧️', '☀️', '🏟️', '📸', '🛡️',
]

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

interface Props {
  announcements: Announcement[]
  showToast: (msg: string) => void
}

export default function AnnouncementsTab({ announcements, showToast }: Props) {
  const [form, setForm] = useState({ icon: '📌', title: '', body: '', type: 'text' as 'text' | 'image' | 'video', media_url: '' })
  const [editId, setEditId] = useState<string | null>(null)

  const save = async () => {
    if (!form.title.trim()) { showToast('Zadej nadpis'); return }
    if (form.type === 'video' && form.media_url && !extractYoutubeId(form.media_url)) {
      showToast('Neplatná YouTube URL'); return
    }
    const data = {
      icon: form.icon,
      title: form.title.trim(),
      body: form.body.trim(),
      position: editId ? undefined : announcements.length,
      type: form.type,
      media_url: form.media_url.trim() || null,
    }
    if (editId) {
      const { error } = await supabase.from('announcements').update(data).eq('id', editId)
      if (error) { showToast('Chyba: ' + error.message); return }
    } else {
      const { error } = await supabase.from('announcements').insert({ ...data, position: announcements.length })
      if (error) { showToast('Chyba: ' + error.message); return }
    }
    setForm({ icon: '📌', title: '', body: '', type: 'text', media_url: '' })
    setEditId(null)
    showToast('Uloženo ✓')
  }

  const edit = (a: Announcement) => {
    setForm({ icon: a.icon, title: a.title, body: a.body, type: a.type ?? 'text', media_url: a.media_url ?? '' })
    setEditId(a.id)
  }

  const remove = async (id: string) => {
    if (!confirm('Smazat oznámení?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Smazáno')
  }

  const moveUp = async (index: number) => {
    if (index === 0) return
    const a = announcements[index]
    const b = announcements[index - 1]
    const { error: e1 } = await supabase.from('announcements').update({ position: b.position }).eq('id', a.id)
    if (e1) { showToast('Chyba řazení: ' + e1.message); return }
    const { error: e2 } = await supabase.from('announcements').update({ position: a.position }).eq('id', b.id)
    if (e2) showToast('Chyba řazení: ' + e2.message)
  }

  const moveDown = async (index: number) => {
    if (index === announcements.length - 1) return
    const a = announcements[index]
    const b = announcements[index + 1]
    const { error: e1 } = await supabase.from('announcements').update({ position: b.position }).eq('id', a.id)
    if (e1) { showToast('Chyba řazení: ' + e1.message); return }
    const { error: e2 } = await supabase.from('announcements').update({ position: a.position }).eq('id', b.id)
    if (e2) showToast('Chyba řazení: ' + e2.message)
  }

  const typeLabel = (t?: string) => t === 'image' ? '🖼️ Obrázek' : t === 'video' ? '▶️ Video' : '📢 Oznámení'

  return (
    <div>
      <div className="sub-title">{editId ? 'Upravit položku' : 'Přidat položku'}</div>

      {/* Typ */}
      <div className="field-group">
        <label className="field-label">Typ</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['text', 'image', 'video'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t }))}
              style={{
                padding: '.35rem .85rem',
                borderRadius: 8,
                border: `2px solid ${form.type === t ? 'var(--accent)' : 'var(--border)'}`,
                background: form.type === t ? 'var(--accent-dim)' : '#f8fafc',
                color: form.type === t ? 'var(--accent)' : 'var(--muted)',
                fontWeight: form.type === t ? 700 : 500,
                fontSize: '.8rem',
                cursor: 'pointer',
              }}
            >
              {typeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Ikona — pouze pro oznámení */}
      {form.type === 'text' && (
        <div className="field-group">
          <label className="field-label">Ikona</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '.5rem' }}>
            {ICONS.map(ic => (
              <button
                key={ic}
                type="button"
                onClick={() => setForm(f => ({ ...f, icon: ic }))}
                style={{
                  width: 32, height: 32, borderRadius: 7, border: `2px solid ${form.icon === ic ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.icon === ic ? 'var(--accent-dim)' : '#f8fafc',
                  cursor: 'pointer', fontSize: '.95rem',
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field-group">
        <label className="field-label">Nadpis</label>
        <input
          className="field-input"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={form.type === 'video' ? 'Název videa' : form.type === 'image' ? 'Popisek obrázku' : 'Nadpis oznámení'}
        />
      </div>

      {/* URL pro obrázek nebo video */}
      {form.type !== 'text' && (
        <div className="field-group">
          <label className="field-label">{form.type === 'video' ? 'YouTube URL' : 'URL obrázku'}</label>
          <input
            className="field-input"
            value={form.media_url}
            onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))}
            placeholder={form.type === 'video' ? 'https://youtu.be/...' : 'https://example.com/foto.jpg'}
          />
          {/* Náhled obrázku */}
          {form.type === 'image' && form.media_url && (
            <div style={{ marginTop: 8 }}>
              <img
                src={form.media_url}
                alt="náhled"
                style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
          {/* Náhled YouTube */}
          {form.type === 'video' && form.media_url && extractYoutubeId(form.media_url) && (
            <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--muted)' }}>
              ✅ Video ID: <strong>{extractYoutubeId(form.media_url)}</strong>
            </div>
          )}
          {form.type === 'video' && form.media_url && !extractYoutubeId(form.media_url) && (
            <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--danger)' }}>
              ⚠️ Neplatná YouTube URL
            </div>
          )}
        </div>
      )}

      {/* Textové tělo — pro oznámení a obrázek */}
      {form.type !== 'video' && (
        <div className="field-group">
          <label className="field-label">Text (volitelný)</label>
          <textarea
            className="field-input"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Podrobnější informace…"
            style={{ resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
          />
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-p" onClick={save}>{editId ? '💾 Uložit' : '+ Přidat'}</button>
        {editId && <button type="button" className="btn btn-d btn-sm" onClick={() => { setEditId(null); setForm({ icon: '📌', title: '', body: '', type: 'text', media_url: '' }) }}>✕ Zrušit</button>}
      </div>

      <hr className="divider" />
      <div className="sub-title">Položky</div>
      {!announcements.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádná oznámení.</p>
      ) : (
        <div className="a-list">
          {announcements.map((a, i) => (
            <div key={a.id} className="a-item">
              <span style={{ fontSize: '1.1rem' }}>{a.type === 'image' ? '🖼️' : a.type === 'video' ? '▶️' : a.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="a-item-main">{a.title}</div>
                {a.body && <div className="a-item-sub">{a.body}</div>}
                {a.media_url && <div className="a-item-sub" style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{a.media_url}</div>}
              </div>
              <button type="button" className="btn btn-s btn-sm" onClick={() => moveUp(i)} style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button type="button" className="btn btn-s btn-sm" onClick={() => moveDown(i)} style={{ opacity: i === announcements.length - 1 ? 0.3 : 1 }}>↓</button>
              <button type="button" className="btn btn-d btn-sm" onClick={() => edit(a)}>Upravit</button>
              <button type="button" className="btn btn-d btn-sm" onClick={() => remove(a.id)}>Smazat</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
