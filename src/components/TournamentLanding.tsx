import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

interface TournamentSummary {
  id: string
  name: string
  subtitle: string
  date: string
  venue: string
}

interface Props {
  onSelect: (tournamentId: string) => void
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 20px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '10px 20px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.95rem',
  cursor: 'pointer',
  width: '100%',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: '1.75rem',
  width: '100%',
  maxWidth: 400,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

export default function TournamentLanding({ onSelect }: Props) {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)

  // Login modal
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Create tournament modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Load tournaments
  useEffect(() => {
    supabase.from('tournament')
      .select('id, name, subtitle, date, venue')
      .order('date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('Nepodařilo se načíst turnaje.')
        else setTournaments(data ?? [])
        setLoading(false)
      })
  }, [])

  function handleNameChange(val: string) {
    setNewName(val)
    if (!slugManual) setNewSlug(toSlug(val))
  }

  function handleSlugChange(val: string) {
    setSlugManual(true)
    setNewSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true); setLoginError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setResetLoading(false)
    if (error) { setLoginError(error.message); return }
    setResetSent(true)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoggingIn(false)
    if (err) { setLoginError(err.message); return }
    setShowLogin(false)
    setShowCreate(true)
    setEmail('')
    setPassword('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) { setCreateError('Zadej název turnaje'); return }
    if (!newSlug.trim()) { setCreateError('Zadej slug (URL)'); return }
    setCreating(true)
    setCreateError('')
    const user = (await supabase.auth.getUser()).data.user
    const { data, error: err } = await supabase
      .from('tournament')
      .insert({ name: newName.trim(), slug: newSlug.trim(), owner_id: user?.id ?? null })
      .select('id')
      .single()
    setCreating(false)
    if (err) {
      setCreateError(err.message.includes('unique') ? 'Slug již existuje, zvol jiný.' : err.message)
      return
    }
    setShowCreate(false)
    setNewName('')
    setNewSlug('')
    setSlugManual(false)
    window.history.pushState({ tournamentId: data.id }, '', `/${data.id}`)
    onSelect(data.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #f8fafc)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '3rem 1.5rem 4rem',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', width: '100%', maxWidth: 520 }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(2.2rem, 7vw, 3.2rem)',
          letterSpacing: '.06em',
          color: '#2563eb',
          margin: '0 0 .3rem',
        }}>
          ⚽ ZF Cup
        </h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280', fontSize: '.95rem', margin: 0 }}>
          Vyberte turnaj nebo vytvořte nový
        </p>
      </div>

      {/* Action bar */}
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '.75rem', alignItems: 'center' }}>
        {session ? (
          <>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', color: '#6b7280' }}>
              {session.user.email}
            </span>
            <button type="button" onClick={() => { setShowCreate(true); setCreateError('') }} style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem',
              fontWeight: 600, cursor: 'pointer',
            }}>
              ＋ Nový turnaj
            </button>
            <button type="button" onClick={handleLogout} style={{
              background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db',
              borderRadius: 8, padding: '8px 14px', fontFamily: "'DM Sans', sans-serif",
              fontSize: '.85rem', cursor: 'pointer',
            }}>
              Odhlásit
            </button>
          </>
        ) : (
          <button type="button" onClick={() => { setShowLogin(true); setLoginError('') }} style={{
            background: 'transparent', color: '#2563eb', border: '1.5px solid #2563eb',
            borderRadius: 8, padding: '8px 18px', fontFamily: "'DM Sans', sans-serif",
            fontSize: '.9rem', fontWeight: 600, cursor: 'pointer',
          }}>
            🔑 Přihlásit se
          </button>
        )}
      </div>

      {/* Tournament list */}
      <div style={{ width: '100%', maxWidth: 520 }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
            <div className="spinner" />
            <p style={{ fontFamily: 'DM Sans, sans-serif', marginTop: '.75rem', fontSize: '.9rem' }}>Načítám…</p>
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10,
            padding: '1rem 1.25rem', color: '#b91c1c',
            fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && tournaments.length === 0 && (
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: '2rem', textAlign: 'center', color: '#6b7280',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Žádné turnaje nejsou k dispozici.
          </div>
        )}

        {!loading && !error && tournaments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tournaments.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  window.history.pushState({ tournamentId: t.id }, '', `/${t.id}`)
                  onSelect(t.id)
                }}
                style={{
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: '1.1rem 1.4rem', cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 1px 4px rgba(0,0,0,.07)', transition: 'box-shadow .15s, border-color .15s',
                  display: 'flex', flexDirection: 'column', gap: '.3rem',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(37,99,235,.12)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2563eb'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.07)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'
                }}
              >
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: '.05em', color: '#2563eb' }}>
                  {t.name || '(bez názvu)'}
                </span>
                {t.subtitle && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', color: '#6b7280', fontWeight: 500 }}>
                    {t.subtitle}
                  </span>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.1rem' }}>
                  {t.date && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.78rem', color: '#9ca3af' }}>📅 {t.date}</span>}
                  {t.venue && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.78rem', color: '#9ca3af' }}>📍 {t.venue}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Login modal */}
      {showLogin && (
        <div style={overlayStyle} onClick={() => { setShowLogin(false); setResetMode(false); setResetSent(false); setLoginError('') }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '.05em', color: '#111', margin: 0 }}>
              {resetMode ? 'Reset hesla' : 'Přihlášení admina'}
            </h2>

            {resetSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '.9rem', fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', color: '#166534' }}>
                  ✅ E-mail s odkazem pro reset hesla byl odeslán na <strong>{email}</strong>. Zkontroluj schránku (včetně spamu).
                </div>
                <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setLoginError('') }} style={btnSecondary}>
                  ← Zpět na přihlášení
                </button>
              </div>
            ) : resetMode ? (
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', color: '#374151', margin: 0 }}>
                  Zadej svůj e-mail a pošleme ti odkaz pro nastavení nového hesla.
                </p>
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  required
                  autoFocus
                />
                {loginError && <p style={{ color: '#b91c1c', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', margin: 0 }}>{loginError}</p>}
                <button type="submit" style={{ ...btnPrimary, opacity: resetLoading ? 0.6 : 1 }}>
                  {resetLoading ? 'Odesílám…' : 'Odeslat odkaz'}
                </button>
                <button type="button" onClick={() => { setResetMode(false); setLoginError('') }} style={btnSecondary}>
                  ← Zpět
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  required
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Heslo"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  required
                />
                {loginError && <p style={{ color: '#b91c1c', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', margin: 0 }}>{loginError}</p>}
                <button type="submit" style={{ ...btnPrimary, opacity: loggingIn ? 0.6 : 1 }}>
                  {loggingIn ? 'Přihlašuji…' : 'Přihlásit se'}
                </button>
                <button type="button" onClick={() => { setResetMode(true); setLoginError('') }} style={{
                  background: 'none', border: 'none', color: '#2563eb',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'center',
                }}>
                  Zapomenuté heslo?
                </button>
                <button type="button" onClick={() => setShowLogin(false)} style={btnSecondary}>
                  Zrušit
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create tournament modal */}
      {showCreate && (
        <div style={overlayStyle} onClick={() => setShowCreate(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '.05em', color: '#111', margin: 0 }}>
              Nový turnaj
            </h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <div>
                <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', color: '#374151', display: 'block', marginBottom: '.3rem' }}>
                  Název turnaje
                </label>
                <input
                  type="text"
                  placeholder="např. ZF Cup 2027"
                  value={newName}
                  onChange={e => handleNameChange(e.target.value)}
                  style={inputStyle}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', color: '#374151', display: 'block', marginBottom: '.3rem' }}>
                  Slug (URL adresa)
                </label>
                <input
                  type="text"
                  placeholder="zf-cup-2027"
                  value={newSlug}
                  onChange={e => handleSlugChange(e.target.value)}
                  style={inputStyle}
                  required
                />
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.75rem', color: '#9ca3af', margin: '.3rem 0 0' }}>
                  Přístup: app.vercel.app/{newSlug || 'zf-cup-2027'}
                </p>
              </div>
              {createError && (
                <p style={{ color: '#b91c1c', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', margin: 0 }}>
                  {createError}
                </p>
              )}
              <button type="submit" style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Vytvářím…' : '✓ Vytvořit turnaj'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} style={btnSecondary}>
                Zrušit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
