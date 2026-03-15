import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTipsters } from '../../hooks/useTipsters'
import { useTips } from '../../hooks/useTips'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import { TeamLogo } from '../ui/TeamLogo'

const STORAGE_KEY = 'zfcup_tipster_id'

interface Props {
  matches: Match[]
  teams: Team[]
  showToast: (msg: string) => void
}

// ── Login / Register ───────────────────────────────────────────────────────────

function TipsLogin({ onSuccess, showToast }: { onSuccess: (id: string) => void; showToast: (m: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name.trim()) { showToast('Zadej jméno'); return }
    if (!/^\d{4}$/.test(pin)) { showToast('PIN musí být 4 číslice (0–9)'); return }
    if (pin !== pinConfirm) { showToast('PINy se neshodují'); return }
    setLoading(true)
    const normalized = name.trim().toLowerCase()
    const { data, error } = await supabase
      .from('tipsters')
      .insert({ name: normalized, pin, total_points: 0 })
      .select('id')
      .single()
    setLoading(false)
    if (error) {
      if (error.code === '23505') showToast('Toto jméno je již registrováno — přihlas se')
      else showToast('Chyba: ' + error.message)
      return
    }
    onSuccess(data.id)
  }

  const handleLogin = async () => {
    if (!name.trim() || !pin) { showToast('Vyplň jméno a PIN'); return }
    setLoading(true)
    const normalized = name.trim().toLowerCase()
    const { data } = await supabase
      .from('tipsters')
      .select('id')
      .eq('name', normalized)
      .eq('pin', pin)
      .maybeSingle()
    setLoading(false)
    if (!data) { showToast('Špatné jméno nebo PIN'); return }
    onSuccess(data.id)
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      <div className="sec-head">
        <span className="sec-title">Tipovačka</span>
      </div>

      <div className="card" style={{ padding: '1.4rem' }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.2rem', background: 'var(--bg)', borderRadius: 8, padding: 4 }}>
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '.45rem', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: '.8rem',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? 'var(--accent)' : 'var(--muted)',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
              }}
            >
              {m === 'login' ? 'Přihlásit se' : 'Registrovat se'}
            </button>
          ))}
        </div>

        <div className="field-group">
          <label className="field-label">Jméno</label>
          <input
            className="field-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="jan novák"
            autoCapitalize="none"
          />
          <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 3 }}>Malá písmena, bez diakritiky není nutné</div>
        </div>

        <div className="field-group">
          <label className="field-label">PIN (4 číslice)</label>
          <input
            className="field-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
          />
        </div>

        {mode === 'register' && (
          <div className="field-group">
            <label className="field-label">PIN znovu</label>
            <input
              className="field-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              placeholder="••••"
            />
          </div>
        )}

        <button
          type="button"
          className="btn btn-p btn-full"
          onClick={mode === 'login' ? handleLogin : handleRegister}
          style={{ marginTop: '.4rem', opacity: loading ? .7 : 1 }}
        >
          {loading ? 'Chvíli…' : mode === 'login' ? 'Přihlásit se' : 'Zaregistrovat se'}
        </button>

        {mode === 'login' && (
          <p style={{ fontSize: '.7rem', color: 'var(--muted)', textAlign: 'center', marginTop: '.8rem' }}>
            Nemáš účet? Přepni na <strong>Registrovat se</strong>.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

function Leaderboard({ tipsters, myId }: { tipsters: ReturnType<typeof useTipsters>['tipsters']; myId: string }) {
  if (!tipsters.length) return (
    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem', fontSize: '.85rem' }}>
      Zatím žádní tipéři.
    </div>
  )
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {tipsters.map((t, i) => {
        const isMe = t.id === myId
        const rankCl = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
        return (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '44px 1fr auto',
            alignItems: 'center', padding: '.6rem 1rem',
            borderBottom: i < tipsters.length - 1 ? '1px solid var(--border)' : 'none',
            background: isMe ? 'rgba(37,99,235,.04)' : i === 0 ? 'linear-gradient(90deg,rgba(217,119,6,.06) 0%,transparent 100%)' : 'transparent',
          }}>
            <div style={{ textAlign: 'center' }}>
              <span className={rankCl} style={{ fontSize: '1.2rem' }}>{i + 1}</span>
            </div>
            <div>
              <span style={{ fontWeight: isMe ? 700 : 500, fontSize: '.88rem', color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                {t.name}
              </span>
              {isMe && <span style={{ fontSize: '.65rem', color: 'var(--accent)', marginLeft: 6, fontWeight: 600 }}>← ty</span>}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: i === 0 ? 'var(--gold)' : 'var(--accent)', lineHeight: 1 }}>
              {t.total_points}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tips form ──────────────────────────────────────────────────────────────────

function TipsForm({ matches, teams, myTips, tipsterId, showToast }: {
  matches: Match[]
  teams: Team[]
  myTips: ReturnType<typeof useTips>['tips']
  tipsterId: string
  showToast: (m: string) => void
}) {
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [saving, setSaving] = useState(false)

  // Pre-fill inputs from existing tips
  useEffect(() => {
    const init: Record<string, { home: string; away: string }> = {}
    for (const m of matches) {
      const tip = myTips.find(t => t.match_id === m.id)
      init[m.id] = { home: tip ? String(tip.predicted_home) : '', away: tip ? String(tip.predicted_away) : '' }
    }
    setInputs(init)
  }, [matches, myTips])

  const setInput = (matchId: string, side: 'home' | 'away', val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2)
    setInputs(prev => ({ ...prev, [matchId]: { ...prev[matchId], [side]: clean } }))
  }

  const saveAll = async () => {
    setSaving(true)
    let saved = 0
    for (const m of matches) {
      if (m.played) continue
      const inp = inputs[m.id]
      if (!inp || inp.home === '' || inp.away === '') continue
      const h = parseInt(inp.home), a = parseInt(inp.away)
      if (isNaN(h) || isNaN(a)) continue

      const existing = myTips.find(t => t.match_id === m.id)
      if (existing) {
        await supabase.from('tips').update({ predicted_home: h, predicted_away: a }).eq('id', existing.id)
      } else {
        await supabase.from('tips').insert({ tipster_id: tipsterId, match_id: m.id, predicted_home: h, predicted_away: a, points_earned: 0, evaluated: false })
      }
      saved++
    }
    setSaving(false)
    showToast(saved > 0 ? `${saved} tipů uloženo ✓` : 'Žádné nové tipy k uložení')
  }

  // Group matches by round, sorted alphabetically
  const roundsMap: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Ostatní'
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  }
  const rounds = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))

  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#94a3b8', logo_url: null }

  const hasUnsaved = matches.some(m => {
    if (m.played) return false
    const inp = inputs[m.id]
    if (!inp || inp.home === '' || inp.away === '') return false
    const tip = myTips.find(t => t.match_id === m.id)
    if (!tip) return true
    return String(tip.predicted_home) !== inp.home || String(tip.predicted_away) !== inp.away
  })

  return (
    <div>
      {rounds.map(([round, ms]) => (
        <div key={round} style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem',
            letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 700,
            color: 'var(--text)', padding: '.45rem 1rem', marginBottom: '.6rem',
            borderLeft: '5px solid var(--accent)', background: 'rgba(37,99,235,.04)',
            borderRadius: '0 8px 8px 0',
          }}>{round}</div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {ms.map((m, i) => {
              const inp = inputs[m.id] ?? { home: '', away: '' }
              const tip = myTips.find(t => t.match_id === m.id)
              const hw = m.played && m.home_score > m.away_score
              const aw = m.played && m.away_score > m.home_score
              const correct = tip && m.played && (
                (tip.predicted_home > tip.predicted_away && m.home_score > m.away_score) ||
                (tip.predicted_home < tip.predicted_away && m.home_score < m.away_score) ||
                (tip.predicted_home === tip.predicted_away && m.home_score === m.away_score)
              )

              return (
                <div key={m.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center', gap: '.5rem', padding: '.6rem .9rem',
                  borderBottom: i < ms.length - 1 ? '1px solid var(--border)' : 'none',
                  background: m.played ? 'rgba(0,0,0,.015)' : 'transparent',
                }}>
                  {/* Home */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.4rem', minWidth: 0 }}>
                    <span style={{
                      fontSize: '.82rem', fontWeight: hw ? 700 : 500, textAlign: 'right',
                      color: hw ? 'var(--accent)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{tn(m.home_id)}</span>
                    <TeamLogo team={tt(m.home_id)} size={20} />
                  </div>

                  {/* Center — inputs or result */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    {m.played ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '.06em', color: 'var(--text)' }}>
                          {m.home_score}:{m.away_score}
                        </span>
                        {tip && (
                          <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>
                            tip: {tip.predicted_home}:{tip.predicted_away}
                          </span>
                        )}
                        {tip && (
                          <span style={{
                            fontSize: '.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                            background: tip.evaluated && tip.points_earned > 0 ? 'rgba(22,163,74,.12)' : tip.evaluated ? 'rgba(0,0,0,.06)' : 'transparent',
                            color: tip.evaluated && tip.points_earned > 0 ? 'var(--success)' : 'var(--muted)',
                          }}>
                            {tip.evaluated ? `+${tip.points_earned} b.` : correct ? 'čekám…' : ''}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="text" inputMode="numeric" maxLength={2}
                          value={inp.home}
                          onChange={e => setInput(m.id, 'home', e.target.value)}
                          style={{
                            width: 32, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: '1.1rem', border: '1px solid var(--border)', borderRadius: 6,
                            padding: '3px 4px', background: inp.home !== '' ? 'rgba(37,99,235,.06)' : '#fff',
                            outline: 'none',
                          }}
                          placeholder="–"
                        />
                        <span style={{ color: 'var(--muted)', fontWeight: 700 }}>:</span>
                        <input
                          type="text" inputMode="numeric" maxLength={2}
                          value={inp.away}
                          onChange={e => setInput(m.id, 'away', e.target.value)}
                          style={{
                            width: 32, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: '1.1rem', border: '1px solid var(--border)', borderRadius: 6,
                            padding: '3px 4px', background: inp.away !== '' ? 'rgba(37,99,235,.06)' : '#fff',
                            outline: 'none',
                          }}
                          placeholder="–"
                        />
                      </div>
                    )}
                  </div>

                  {/* Away */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                    <TeamLogo team={tt(m.away_id)} size={20} />
                    <span style={{
                      fontSize: '.82rem', fontWeight: aw ? 700 : 500,
                      color: aw ? 'var(--accent)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{tn(m.away_id)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-p btn-full"
        onClick={saveAll}
        style={{ opacity: saving ? .7 : 1, marginTop: '.5rem' }}
      >
        {saving ? 'Ukládám…' : hasUnsaved ? '💾 Uložit tipy' : '✓ Tipy uloženy'}
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Tips({ matches, teams, showToast }: Props) {
  const [tipsterId, setTipsterId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [view, setView] = useState<'tips' | 'leaderboard'>('tips')
  const { tipsters } = useTipsters()
  const { tips } = useTips(tipsterId)

  const currentTipster = tipsters.find(t => t.id === tipsterId)

  const handleLogin = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setTipsterId(id)
    showToast('Přihlášen ✓')
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setTipsterId(null)
  }

  // Only show matches from the matches table (group + playoff recorded in matches)
  const tippableMatches = matches.filter(m => m.group_id !== null)

  if (!tipsterId) {
    return <TipsLogin onSuccess={handleLogin} showToast={showToast} />
  }

  return (
    <div>
      {/* Header */}
      <div className="sec-head">
        <span className="sec-title">Tipovačka</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {currentTipster && (
            <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--accent)' }}>
              {currentTipster.name} · {currentTipster.total_points} b.
            </span>
          )}
          <button type="button" className="btn btn-d btn-sm" onClick={handleLogout}>Odhlásit</button>
        </div>
      </div>

      {/* Bodový systém */}
      <div style={{
        fontSize: '.72rem', color: 'var(--muted)', marginBottom: '1rem',
        padding: '.5rem .8rem', background: 'rgba(37,99,235,.04)',
        borderRadius: 8, border: '1px solid rgba(37,99,235,.1)',
        display: 'flex', gap: '1rem', flexWrap: 'wrap',
      }}>
        <span>⚽ Přesný výsledek: <strong style={{ color: 'var(--text)' }}>7 b.</strong></span>
        <span>✓ Správný výsledek: <strong style={{ color: 'var(--text)' }}>3 b.</strong></span>
        <span>Playoff: <strong style={{ color: 'var(--text)' }}>8 / 4 b.</strong></span>
        <span>Finále: <strong style={{ color: 'var(--text)' }}>12 / 6 b.</strong></span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', background: 'var(--bg)', borderRadius: 8, padding: 4 }}>
        {(['tips', 'leaderboard'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '.45rem', border: 'none', borderRadius: 6, cursor: 'pointer',
              fontWeight: 600, fontSize: '.8rem',
              background: view === v ? '#fff' : 'transparent',
              color: view === v ? 'var(--accent)' : 'var(--muted)',
              boxShadow: view === v ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
              transition: 'all .15s',
            }}
          >
            {v === 'tips' ? 'Moje tipy' : `Žebříček (${tipsters.length})`}
          </button>
        ))}
      </div>

      {view === 'tips' && (
        <TipsForm
          matches={tippableMatches}
          teams={teams}
          myTips={tips}
          tipsterId={tipsterId}
          showToast={showToast}
        />
      )}
      {view === 'leaderboard' && (
        <Leaderboard tipsters={tipsters} myId={tipsterId} />
      )}
    </div>
  )
}
