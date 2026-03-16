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

interface Props {
  announcements: Announcement[]
  showToast: (msg: string) => void
}

export default function AnnouncementsTab({ announcements, showToast }: Props) {
  const [form, setForm] = useState({ icon: '📌', title: '', body: '' })
  const [editId, setEditId] = useState<string | null>(null)

  const save = async () => {
    if (!form.title.trim()) { showToast('Zadej nadpis'); return }
    const data = { icon: form.icon, title: form.title.trim(), body: form.body.trim(), position: announcements.length }
    if (editId) {
      const { error } = await supabase.from('announcements').update(data).eq('id', editId)
      if (error) { showToast('Chyba: ' + error.message); return }
    } else {
      const { error } = await supabase.from('announcements').insert(data)
      if (error) { showToast('Chyba: ' + error.message); return }
    }
    setForm({ icon: '📌', title: '', body: '' })
    setEditId(null)
    showToast('Uloženo ✓')
  }

  const edit = (a: Announcement) => {
    setForm({ icon: a.icon, title: a.title, body: a.body })
    setEditId(a.id)
  }

  const remove = async (id: string) => {
    if (!confirm('Smazat oznámení?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Smazáno')
  }

  return (
    <div>
      <div className="sub-title">{editId ? 'Upravit oznámení' : 'Přidat oznámení'}</div>
      <div className="field-group">
        <label className="field-label">Ikona</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '.5rem' }}>
          {ICONS.map(ic => (
            <button
              key={ic}
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
      <div className="field-group">
        <label className="field-label">Nadpis</label>
        <input className="field-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nadpis oznámení" />
      </div>
      <div className="field-group">
        <label className="field-label">Text (volitelný)</label>
        <textarea className="field-input" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="Podrobnější informace…" style={{ resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
      </div>
      <div className="btn-row">
        <button className="btn btn-p" onClick={save}>{editId ? '💾 Uložit' : '+ Přidat'}</button>
        {editId && <button className="btn btn-d btn-sm" onClick={() => { setEditId(null); setForm({ icon: '📌', title: '', body: '' }) }}>✕ Zrušit</button>}
      </div>

      <hr className="divider" />
      <div className="sub-title">Oznámení</div>
      {!announcements.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádná oznámení.</p>
      ) : (
        <div className="a-list">
          {announcements.map(a => (
            <div key={a.id} className="a-item">
              <span style={{ fontSize: '1.1rem' }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="a-item-main">{a.title}</div>
                {a.body && <div className="a-item-sub">{a.body}</div>}
              </div>
              <button className="btn btn-d btn-sm" onClick={() => edit(a)}>Upravit</button>
              <button className="btn btn-d btn-sm" onClick={() => remove(a.id)}>Smazat</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
