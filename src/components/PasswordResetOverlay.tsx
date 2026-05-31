import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  onDone: () => void
}

export default function PasswordResetOverlay({ onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setErr('Heslo musí mít alespoň 6 znaků.'); return }
    if (password !== confirm) { setErr('Hesla se neshodují.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setDone(true)
    setTimeout(() => { onDone() }, 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '2rem',
        width: '100%', maxWidth: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>✅</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: '#111' }}>
              Heslo bylo změněno
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', color: '#6b7280' }}>
              Přesměrovávám…
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '.05em', color: '#111', margin: 0 }}>
              Nastavit nové heslo
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <input
                type="password"
                placeholder="Nové heslo (min. 6 znaků)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid #d1d5db', borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <input
                type="password"
                placeholder="Potvrdit heslo"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid #d1d5db', borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              {err && <p style={{ color: '#b91c1c', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', margin: 0 }}>{err}</p>}
              <button type="submit" style={{
                background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? 'Ukládám…' : '✓ Uložit nové heslo'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
