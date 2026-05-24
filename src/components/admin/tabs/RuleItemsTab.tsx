import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { RuleItem } from '../../../hooks/useRuleItems'
import RichTextEditor from '../../ui/RichTextEditor'

interface Props {
  ruleItems: RuleItem[]
  showToast: (msg: string) => void
}

export default function RuleItemsTab({ ruleItems, showToast }: Props) {
  const [form, setForm] = useState({ title: '', body: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [items, setItems] = useState(ruleItems)

  useEffect(() => { setItems(ruleItems) }, [ruleItems])

  const save = async () => {
    const data = { title: form.title.trim(), body: form.body.trim() }
    if (editId) {
      const { error } = await supabase.from('rule_items').update(data).eq('id', editId)
      if (error) { showToast('Chyba: ' + error.message); return }
    } else {
      const { error } = await supabase.from('rule_items').insert({ ...data, position: items.length })
      if (error) { showToast('Chyba: ' + error.message); return }
    }
    setForm({ title: '', body: '' })
    setEditId(null)
    showToast('Uloženo ✓')
  }

  const edit = (r: RuleItem) => {
    setForm({ title: r.title, body: r.body })
    setEditId(r.id)
  }

  const remove = async (id: string) => {
    if (!confirm('Smazat položku pravidel?')) return
    const { error } = await supabase.from('rule_items').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Smazáno')
  }

  const moveUp = async (index: number) => {
    if (index === 0) return
    const snapshot = items
    const next = [...items]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setItems(next)
    const a = snapshot[index], b = snapshot[index - 1]
    const [r1, r2] = await Promise.all([
      supabase.from('rule_items').update({ position: b.position }).eq('id', a.id),
      supabase.from('rule_items').update({ position: a.position }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(snapshot); showToast('Chyba řazení') }
  }

  const moveDown = async (index: number) => {
    if (index === items.length - 1) return
    const snapshot = items
    const next = [...items]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setItems(next)
    const a = snapshot[index], b = snapshot[index + 1]
    const [r1, r2] = await Promise.all([
      supabase.from('rule_items').update({ position: b.position }).eq('id', a.id),
      supabase.from('rule_items').update({ position: a.position }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(snapshot); showToast('Chyba řazení') }
  }

  return (
    <div>
      <div className="sub-title">{editId ? 'Upravit sekci' : 'Přidat sekci'}</div>

      <div className="field-group">
        <label className="field-label">Nadpis sekce (volitelný)</label>
        <input
          className="field-input"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="např. Hrací systém, Bodování, Disciplína…"
        />
      </div>

      <div className="field-group">
        <label className="field-label">Text pravidla</label>
        <RichTextEditor
          content={form.body}
          onChange={html => setForm(f => ({ ...f, body: html }))}
        />
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-p" onClick={save}>{editId ? '💾 Uložit' : '+ Přidat'}</button>
        {editId && (
          <button type="button" className="btn btn-d btn-sm" onClick={() => { setEditId(null); setForm({ title: '', body: '' }) }}>✕ Zrušit</button>
        )}
      </div>

      <hr className="divider" />
      <div className="sub-title">Sekce pravidel</div>
      {!items.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádné sekce pravidel.</p>
      ) : (
        <div className="a-list">
          {items.map((r, i) => (
            <div key={r.id} className="a-item">
              <span style={{ fontSize: '1.1rem' }}>📋</span>
              <div style={{ flex: 1 }}>
                {r.title
                  ? <div className="a-item-main">{r.title}</div>
                  : <div className="a-item-main" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(bez nadpisu)</div>
                }
                {r.body && (
                  <div className="a-item-sub">
                    {r.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-s btn-sm" onClick={() => moveUp(i)} style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button type="button" className="btn btn-s btn-sm" onClick={() => moveDown(i)} style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}>↓</button>
              <button type="button" className="btn btn-d btn-sm" onClick={() => edit(r)}>Upravit</button>
              <button type="button" className="btn btn-d btn-sm" onClick={() => remove(r.id)}>Smazat</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
