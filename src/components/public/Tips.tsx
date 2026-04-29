import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { useTipsters } from '../../hooks/useTipsters'
import { useTips } from '../../hooks/useTips'
import { useBracketTips } from '../../hooks/useBracketTips'
import { useSpecialTips } from '../../hooks/useSpecialTips'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import type { Group } from '../../hooks/useGroups'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Tournament } from '../../hooks/useTournament'
import { TeamLogo } from '../ui/TeamLogo'

const STORAGE_KEY = 'zfcup_tipster_id'

interface Props {
  matches: Match[]
  teams: Team[]
  groups: Group[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  tournament: Tournament | null
  showToast: (msg: string) => void
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const segmentBtn = (active: boolean) => ({
  flex: 1, padding: '.45rem', border: 'none', borderRadius: 6, cursor: 'pointer',
  fontWeight: 600, fontSize: '.8rem',
  background: active ? '#fff' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--muted)',
  boxShadow: active ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
  transition: 'all .15s',
} as React.CSSProperties)

const groupHeader = {
  fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem',
  letterSpacing: '.15em', textTransform: 'uppercase' as const, fontWeight: 700,
  color: 'var(--text)' as const, padding: '.45rem 1rem', marginBottom: '.6rem',
  borderLeft: '5px solid var(--accent)', background: 'rgba(37,99,235,.04)',
  borderRadius: '0 8px 8px 0',
}

// ── Login / Register ───────────────────────────────────────────────────────────

function TipsLogin({ onSuccess, showToast }: { onSuccess: (id: string) => void; showToast: (m: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const buildName = () => `${firstName.trim()} ${lastName.trim()}`.toLowerCase().replace(/\s+/g, ' ').trim()

  const handleRegister = async () => {
    if (!firstName.trim()) { showToast('Zadej jméno'); return }
    if (!lastName.trim()) { showToast('Zadej příjmení'); return }
    if (!/^\d{4}$/.test(pin)) { showToast('PIN musí být 4 číslice (0–9)'); return }
    if (pin !== pinConfirm) { showToast('PINy se neshodují'); return }
    setLoading(true)
    const normalized = buildName()
    const { data, error } = await supabase
      .from('tipsters').insert({ name: normalized, pin, total_points: 0 })
      .select('id').single()
    setLoading(false)
    if (error) {
      if (error.code === '23505') showToast('Tento účet již existuje — přihlas se')
      else showToast('Chyba: ' + error.message)
      return
    }
    onSuccess(data.id)
  }

  const handleLogin = async () => {
    if (!firstName.trim() || !lastName.trim() || !pin) { showToast('Vyplň jméno, příjmení a PIN'); return }
    setLoading(true)
    const normalized = buildName()
    const { data } = await supabase.from('tipsters').select('id')
      .eq('name', normalized).eq('pin', pin).maybeSingle()
    setLoading(false)
    if (!data) { showToast('Špatné jméno, příjmení nebo PIN'); return }
    onSuccess(data.id)
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      <div className="sec-head"><span className="sec-title">Tipovačka</span></div>
      <div className="card" style={{ padding: '1.4rem' }}>
        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.2rem', background: 'var(--bg)', borderRadius: 8, padding: 4 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} style={segmentBtn(mode === m)}>
              {m === 'login' ? 'Přihlásit se' : 'Registrovat se'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Jméno</label>
            <input className="field-input" value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="Jan" autoCapitalize="words" />
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Příjmení</label>
            <input className="field-input" value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Novák" autoCapitalize="words" />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">PIN (4 číslice)</label>
          <input className="field-input" type="password" inputMode="numeric" maxLength={4}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" />
        </div>
        {mode === 'register' && (
          <div className="field-group">
            <label className="field-label">PIN znovu</label>
            <input className="field-input" type="password" inputMode="numeric" maxLength={4}
              value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && handleRegister()} placeholder="••••" />
          </div>
        )}
        <button type="button" className="btn btn-p btn-full"
          onClick={mode === 'login' ? handleLogin : handleRegister}
          style={{ marginTop: '.4rem', opacity: loading ? .7 : 1 }}>
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
            display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center',
            padding: '.6rem 1rem',
            borderBottom: i < tipsters.length - 1 ? '1px solid var(--border)' : 'none',
            background: isMe ? 'rgba(37,99,235,.04)' : i === 0 ? 'linear-gradient(90deg,rgba(217,119,6,.06) 0%,transparent 100%)' : 'transparent',
          }}>
            <div style={{ textAlign: 'center' }}><span className={rankCl} style={{ fontSize: '1.2rem' }}>{i + 1}</span></div>
            <div>
              <span style={{ fontWeight: isMe ? 700 : 500, fontSize: '.88rem', color: isMe ? 'var(--accent)' : 'var(--text)' }}>{t.name}</span>
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

// ── Special tips ───────────────────────────────────────────────────────────────

function SpecialTipsSection({ groups, teams, tipsterId, specialTips, anyMatchPlayed, anyPlayoffPlayed, showToast, isLeague }: {
  groups: Group[]
  teams: Team[]
  tipsterId: string
  specialTips: ReturnType<typeof useSpecialTips>['specialTips']
  anyMatchPlayed: boolean
  anyPlayoffPlayed: boolean
  showToast: (m: string) => void
  isLeague: boolean
}) {
  // selected = what user sees in dropdowns
  // savedSelections = what's confirmed saved (updated immediately after save, not waiting for realtime)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [savedSelections, setSavedSelections] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  // On DB load: sync state; when specialTips empties (after reset) clear stale entries
  useEffect(() => {
    setSelected(prev => {
      const next: Record<string, string> = {}
      for (const tip of specialTips) {
        next[tip.tip_type] = prev[tip.tip_type] ?? tip.predicted_team_id
      }
      return next
    })
    setSavedSelections(Object.fromEntries(specialTips.map(t => [t.tip_type, t.predicted_team_id])))
  }, [specialTips])

  const handleChange = (tipType: string, teamId: string) => {
    setSelected(prev => ({ ...prev, [tipType]: teamId }))
  }

  const saveSpecialTip = async (tipType: string) => {
    const teamId = selected[tipType]
    if (!teamId) return
    setSaving(prev => ({ ...prev, [tipType]: true }))
    const existing = specialTips.find(t => t.tip_type === tipType)
    if (existing) {
      // Reset evaluated/points_earned — tip se mění, dosavadní vyhodnocení je neplatné
      await supabase.from('special_tips').update({
        predicted_team_id: teamId,
        evaluated: false,
        points_earned: 0,
      }).eq('id', existing.id)
    } else {
      await supabase.from('special_tips').insert({
        tipster_id: tipsterId, tip_type: tipType, predicted_team_id: teamId, points_earned: 0, evaluated: false,
      })
    }
    // Mark as saved immediately — don't wait for realtime to clear the save button
    setSavedSelections(prev => ({ ...prev, [tipType]: teamId }))
    setSaving(prev => ({ ...prev, [tipType]: false }))
    showToast('Tip uložen ✓')
  }

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  const renderRow = (tipType: string, label: string, teamPool: Team[], points: number, isLast: boolean) => {
    const existing = specialTips.find(t => t.tip_type === tipType)
    const isEvaluated = existing?.evaluated
    const currentVal = selected[tipType] ?? ''
    const savedVal = savedSelections[tipType] ?? ''
    const changed = currentVal !== savedVal && currentVal !== ''
    const borderStyle = isLast ? 'none' : '1px solid var(--border)'
    // tournament_winner locks when first playoff match played; group tips lock when first group match played
    const isLocked = tipType === 'tournament_winner' ? anyPlayoffPlayed : anyMatchPlayed

    if (isEvaluated) {
      return (
        <div key={tipType} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .9rem', borderBottom: borderStyle }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '.67rem', color: 'var(--muted)' }}>{points} b. za správný tip</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span style={{ fontSize: '.78rem', color: 'var(--text)' }}>
              {teamPool.find(t => t.id === existing.predicted_team_id)?.name ?? '—'}
            </span>
            <span style={{
              fontSize: '.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              background: existing.points_earned > 0 ? 'rgba(22,163,74,.12)' : 'rgba(0,0,0,.06)',
              color: existing.points_earned > 0 ? 'var(--success)' : 'var(--muted)',
            }}>
              {existing.points_earned > 0 ? `+${existing.points_earned} b.` : '0 b.'}
            </span>
          </div>
        </div>
      )
    }

    if (isLocked) {
      // Locked — show saved selection read-only
      return (
        <div key={tipType} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .9rem', borderBottom: borderStyle, opacity: .75 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '.67rem', color: 'var(--muted)' }}>{points} b. za správný tip</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span style={{ fontSize: '.78rem', color: savedVal ? 'var(--text)' : 'var(--muted)', fontStyle: savedVal ? 'normal' : 'italic' }}>
              {savedVal ? (teamPool.find(t => t.id === savedVal)?.name ?? '—') : 'nezadáno'}
            </span>
            <span style={{ fontSize: '.7rem' }}>🔒</span>
          </div>
        </div>
      )
    }

    return (
      <div key={tipType} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .9rem', borderBottom: borderStyle }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: '.67rem', color: 'var(--muted)' }}>{points} b. za správný tip</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
          <select
            className="field-input field-select"
            style={{ width: 'auto', minWidth: 120, fontSize: '.78rem', padding: '.3rem .5rem' }}
            value={currentVal}
            onChange={e => handleChange(tipType, e.target.value)}
          >
            <option value="">— vyber tým —</option>
            {teamPool.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {changed && (
            <button type="button" className="btn btn-s btn-sm"
              onClick={() => saveSpecialTip(tipType)}
              style={{ opacity: saving[tipType] ? .6 : 1, whiteSpace: 'nowrap' }}>
              {saving[tipType] ? '…' : 'Uložit'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const rows: { tipType: string; label: string; teamPool: Team[]; points: number }[] = [
    { tipType: 'tournament_winner', label: '🏆 Vítěz turnaje (vč. playoff)', teamPool: teams, points: 10 },
    ...sortedGroups.flatMap(g => {
      const groupTeams = teams.filter(t => g.team_ids.includes(t.id))
      const ligaGroup = isLeague && g.name === 'Liga'
      return [
        { tipType: `group_winner:${g.id}`, label: ligaGroup ? '🥇 Vítěz ligové fáze' : `🥇 Vítěz skupiny ${g.name}`, teamPool: groupTeams, points: 5 },
        { tipType: `group_last:${g.id}`, label: ligaGroup ? '⬇️ Poslední v ligové fázi' : `⬇️ Poslední skupiny ${g.name}`, teamPool: groupTeams, points: 3 },
      ]
    }),
  ]

  return (
    <div style={{ marginBottom: '1.8rem' }}>
      <div style={groupHeader}>Speciální tipy</div>
      {anyMatchPlayed && !anyPlayoffPlayed && (
        <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.5rem', padding: '.3rem .8rem', background: 'rgba(0,0,0,.03)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          🔒 Skupinové tipy jsou uzamčeny. Tip na vítěze turnaje lze stále změnit (zamkne se po nasazení týmů do play-off).
        </div>
      )}
      {anyPlayoffPlayed && (
        <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.5rem', padding: '.3rem .8rem', background: 'rgba(0,0,0,.03)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          🔒 Všechny speciální tipy jsou uzamčeny.
        </div>
      )}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '.3rem' }}>
        {rows.map((r, i) => renderRow(r.tipType, r.label, r.teamPool, r.points, i === rows.length - 1))}
      </div>
      {!anyMatchPlayed && (
        <div style={{ fontSize: '.67rem', color: 'var(--muted)', padding: '0 .2rem' }}>
          Skupinové tipy se uzamknou po prvním zápase. Vítěz turnaje se zamkne po nasazení týmů do play-off.
        </div>
      )}
    </div>
  )
}

// ── Time-lock helper ──────────────────────────────────────────────────────────

function isMatchTimePassed(scheduledTime: string | null | undefined, lockFromDate?: string): boolean {
  if (!scheduledTime) return false
  // If a lock date is set, only lock on or after that date
  if (lockFromDate) {
    const today = new Date().toISOString().slice(0, 10)
    if (today < lockFromDate) return false
  }
  const now = new Date()
  const [hh, mm] = scheduledTime.split(':').map(Number)
  if (isNaN(hh) || isNaN(mm)) return false
  return now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm
}

// ── Group match tips ───────────────────────────────────────────────────────────

function GroupTipsSection({ matches, teams, myTips, tipsterId, loading, showToast, isLeague, lockFromDate }: {
  matches: Match[]
  teams: Team[]
  myTips: ReturnType<typeof useTips>['tips']
  tipsterId: string
  lockFromDate?: string
  loading: boolean
  showToast: (m: string) => void
  isLeague: boolean
}) {
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  // Rerender každou minutu aby se časové zámky aktualizovaly bez refreshe
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Varování při zavření/refreshi stránky s neuloženými tipy
  useEffect(() => {
    if (dirty.size === 0) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    setInputs(prev => {
      const next = { ...prev }
      for (const m of matches) {
        if (dirty.has(m.id)) continue  // user is editing — don't override
        const tip = myTips.find(t => t.match_id === m.id)
        next[m.id] = { home: tip ? String(tip.predicted_home) : '', away: tip ? String(tip.predicted_away) : '' }
      }
      return next
    })
  }, [matches, myTips]) // eslint-disable-line react-hooks/exhaustive-deps

  const setInput = (matchId: string, side: 'home' | 'away', val: string) => {
    setDirty(prev => new Set([...prev, matchId]))
    setInputs(prev => ({ ...prev, [matchId]: { ...prev[matchId], [side]: val.replace(/\D/g, '').slice(0, 2) } }))
  }

  const saveAll = async () => {
    setSaving(true)
    let saved = 0, failed = 0
    for (const m of matches) {
      // Zamknout odehrané i časově uzavřené zápasy
      if (m.played || isMatchTimePassed(m.scheduled_time, lockFromDate)) continue
      const inp = inputs[m.id]
      if (!inp || inp.home === '' || inp.away === '') continue
      const h = parseInt(inp.home), a = parseInt(inp.away)
      if (isNaN(h) || isNaN(a)) continue
      // Upsert — spolehlivé i při race condition (stale myTips po předchozím save)
      const { error } = await supabase.from('tips').upsert(
        { tipster_id: tipsterId, match_id: m.id, predicted_home: h, predicted_away: a },
        { onConflict: 'tipster_id,match_id' }
      )
      if (error) { failed++; continue }
      saved++
    }
    setSaving(false)
    if (failed > 0) showToast(`Chyba: ${failed} tipů se nepodařilo uložit`)
    else showToast(saved > 0 ? `${saved} tipů uloženo ✓` : 'Žádné nové tipy k uložení')
  }

  let sections: [string, Match[]][]
  if (isLeague) {
    const slotsMap = new Map<string, Match[]>()
    for (const m of [...matches].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
      const key = m.scheduled_time ?? '—'
      if (!slotsMap.has(key)) slotsMap.set(key, [])
      slotsMap.get(key)!.push(m)
    }
    sections = [...slotsMap.entries()]
  } else {
    const roundsMap: Record<string, Match[]> = {}
    for (const m of matches) {
      const r = m.round || 'Ostatní'
      if (!roundsMap[r]) roundsMap[r] = []
      roundsMap[r].push(m)
    }
    sections = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))
  }
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#94a3b8', logo_url: null }

  if (loading) return (
    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem', fontSize: '.85rem' }}>
      Načítám tipy…
    </div>
  )

  return (
    <div style={{ marginBottom: '1.8rem' }}>
      {sections.map(([label, ms]) => (
        <div key={label} style={{ marginBottom: '1rem' }}>
          <div style={groupHeader}>{isLeague ? `🕐 ${label}` : label}</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {ms.map((m, i) => {
              const inp = inputs[m.id] ?? { home: '', away: '' }
              const tip = myTips.find(t => t.match_id === m.id)
              const hw = m.played && m.home_score > m.away_score
              const aw = m.played && m.away_score > m.home_score
              const timeLocked = !m.played && isMatchTimePassed(m.scheduled_time, lockFromDate)
              const isLocked = m.played || timeLocked
              const isDirty = dirty.has(m.id) && !isLocked
              const showBorder = i < ms.length - 1
              return (
                <Fragment key={m.id}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                  gap: '.5rem', padding: '.6rem .9rem',
                  borderBottom: (!isDirty && showBorder) ? '1px solid var(--border)' : 'none',
                  background: isLocked ? 'rgba(0,0,0,.015)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '.82rem', fontWeight: hw ? 700 : 500, textAlign: 'right', color: hw ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tn(m.home_id)}</span>
                    <TeamLogo team={tt(m.home_id)} size={24} />
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    {m.played ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '.06em' }}>{m.home_score}:{m.away_score}</span>
                        {tip && <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>tip: {tip.predicted_home}:{tip.predicted_away}</span>}
                        {tip && (tip.evaluated ? (
                          <span style={{
                            fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                            background: tip.points_earned > 0 ? 'rgba(22,163,74,.15)' : 'rgba(0,0,0,.06)',
                            color: tip.points_earned > 0 ? 'var(--success)' : 'var(--muted)',
                          }}>{tip.points_earned > 0 ? `+${tip.points_earned} b. ✓` : '0 b.'}</span>
                        ) : (
                          <span style={{ fontSize: '.6rem', color: 'var(--muted)', fontStyle: 'italic' }}>čeká…</span>
                        ))}
                      </div>
                    ) : timeLocked ? (
                      // Zámek po čase výkopu
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: '.7rem' }}>🔒</span>
                        {tip ? (
                          <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>tip: {tip.predicted_home}:{tip.predicted_away}</span>
                        ) : (
                          <span style={{ fontSize: '.62rem', color: 'var(--muted)', fontStyle: 'italic' }}>nezadáno</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {(['home', 'away'] as const).map((side, si) => (
                          <>
                            {si === 1 && <span key="sep" style={{ color: 'var(--muted)', fontWeight: 700 }}>:</span>}
                            <input key={side} type="text" inputMode="numeric" maxLength={2}
                              value={inp[side]}
                              onChange={e => setInput(m.id, side, e.target.value)}
                              style={{
                                width: 32, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem',
                                border: '1px solid var(--border)', borderRadius: 6, padding: '3px 4px',
                                background: inp[side] !== '' ? 'rgba(37,99,235,.06)' : '#fff', outline: 'none',
                              }}
                              placeholder="–"
                            />
                          </>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                    <TeamLogo team={tt(m.away_id)} size={24} />
                    <span style={{ fontSize: '.82rem', fontWeight: aw ? 700 : 500, color: aw ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tn(m.away_id)}</span>
                  </div>
                </div>
                {isDirty && (
                  <div style={{ padding: '2px .9rem 6px', fontSize: '.68rem', color: '#b45309', borderBottom: showBorder ? '1px solid var(--border)' : 'none' }}>
                    ● neuloženo — klikni Uložit vše
                  </div>
                )}
                </Fragment>
              )
            })}
          </div>
        </div>
      ))}
      {dirty.size > 0 && (
        <div style={{
          background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.5)',
          borderRadius: 8, padding: '.5rem .85rem', marginBottom: '.55rem',
          fontSize: '.76rem', fontWeight: 600, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: '.5rem',
        }}>
          ⚠️ Máš neuložené tipy! Stiskni tlačítko níže před odchodem ze záložky.
        </div>
      )}
      <button type="button" className="btn btn-p btn-full" onClick={saveAll} style={{ opacity: saving ? .7 : 1 }}>
        {saving ? 'Ukládám…' : '💾 Uložit tipy na skupiny'}
      </button>
    </div>
  )
}

// ── Bracket tips ───────────────────────────────────────────────────────────────

function BracketTipsSection({ bracketRounds, bracketSlots, teams, bracketTips, tipsterId, loading, showToast, lockFromDate }: {
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  teams: Team[]
  bracketTips: ReturnType<typeof useBracketTips>['bracketTips']
  tipsterId: string
  loading: boolean
  showToast: (m: string) => void
  lockFromDate?: string
}) {
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Varování při zavření/refreshi stránky s neuloženými playoff tipy
  useEffect(() => {
    if (dirty.size === 0) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    setInputs(prev => {
      const next = { ...prev }
      for (const s of bracketSlots) {
        if (dirty.has(s.id)) continue  // user is editing — don't override
        const tip = bracketTips.find(t => t.slot_id === s.id)
        next[s.id] = { home: tip ? String(tip.predicted_home) : '', away: tip ? String(tip.predicted_away) : '' }
      }
      return next
    })
  }, [bracketSlots, bracketTips]) // eslint-disable-line react-hooks/exhaustive-deps

  const setInput = (slotId: string, side: 'home' | 'away', val: string) => {
    setDirty(prev => new Set([...prev, slotId]))
    setInputs(prev => ({ ...prev, [slotId]: { ...prev[slotId], [side]: val.replace(/\D/g, '').slice(0, 2) } }))
  }

  const saveAll = async () => {
    setSaving(true)
    let saved = 0, failed = 0
    for (const s of bracketSlots) {
      if (s.played || !s.home_id || !s.away_id) continue
      // Zamknout i časově uzavřené playoff sloty
      if (isMatchTimePassed(s.scheduled_time, lockFromDate)) continue
      const inp = inputs[s.id]
      if (!inp || inp.home === '' || inp.away === '') continue
      const h = parseInt(inp.home), a = parseInt(inp.away)
      if (isNaN(h) || isNaN(a)) continue
      // Upsert — spolehlivé i při race condition
      const { error } = await supabase.from('bracket_tips').upsert(
        { tipster_id: tipsterId, slot_id: s.id, predicted_home: h, predicted_away: a },
        { onConflict: 'tipster_id,slot_id' }
      )
      if (error) { failed++; continue }
      saved++
    }
    setSaving(false)
    if (failed > 0) showToast(`Chyba: ${failed} playoff tipů se nepodařilo uložit`)
    else showToast(saved > 0 ? `${saved} playoff tipů uloženo ✓` : 'Žádné nové tipy k uložení')
  }

  if (loading) return (
    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem', fontSize: '.85rem' }}>
      Načítám playoff tipy…
    </div>
  )

  if (!bracketRounds.length) return null

  const sorted = [...bracketRounds].sort((a, b) => a.position - b.position)
  const maxPos = Math.max(...sorted.map(r => r.position))
  const tt = (id: string | null) => id ? teams.find(t => t.id === id) ?? null : null

  return (
    <div style={{ marginBottom: '1.8rem' }}>
      {sorted.map(round => {
        const slots = [...bracketSlots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        const isFinal = round.position === maxPos
        return (
          <div key={round.id} style={{ marginBottom: '1rem' }}>
            <div style={{ ...groupHeader, borderLeft: `5px solid ${isFinal ? 'var(--gold)' : 'var(--accent)'}`, background: isFinal ? 'rgba(217,119,6,.06)' : 'rgba(37,99,235,.04)', color: isFinal ? 'var(--gold)' : 'var(--text)' }}>
              {round.name}
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {slots.map((s, i) => {
                const hT = tt(s.home_id)
                const aT = tt(s.away_id)
                const inp = inputs[s.id] ?? { home: '', away: '' }
                const tip = bracketTips.find(t => t.slot_id === s.id)
                const hw = s.played && s.home_score > s.away_score
                const aw = s.played && s.away_score > s.home_score
                const timeLocked = !!s.home_id && !!s.away_id && !s.played && isMatchTimePassed(s.scheduled_time, lockFromDate)
                const canTip = !!s.home_id && !!s.away_id && !s.played && !timeLocked
                const isDirty = dirty.has(s.id) && canTip
                const showBorder = i < slots.length - 1

                return (
                  <Fragment key={s.id}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                    gap: '.5rem', padding: '.6rem .9rem',
                    borderBottom: (!isDirty && showBorder) ? '1px solid var(--border)' : 'none',
                    background: s.played || timeLocked ? 'rgba(0,0,0,.015)' : !canTip ? 'rgba(0,0,0,.02)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.4rem', minWidth: 0 }}>
                      <span style={{ fontSize: '.82rem', fontWeight: hw ? 700 : 500, textAlign: 'right', color: hT ? (hw ? 'var(--accent)' : 'var(--text)') : 'var(--muted)', fontStyle: hT ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hT ? hT.name : 'TBD'}
                      </span>
                      {hT && <TeamLogo team={hT} size={24} />}
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      {s.played ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '.06em', color: isFinal ? 'var(--gold)' : 'var(--text)' }}>{s.home_score}:{s.away_score}</span>
                          {tip && <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>tip: {tip.predicted_home}:{tip.predicted_away}</span>}
                          {tip && (tip.evaluated ? (
                            <span style={{
                              fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                              background: tip.points_earned > 0 ? 'rgba(22,163,74,.15)' : 'rgba(0,0,0,.06)',
                              color: tip.points_earned > 0 ? 'var(--success)' : 'var(--muted)',
                            }}>{tip.points_earned > 0 ? `+${tip.points_earned} b. ✓` : '0 b.'}</span>
                          ) : (
                            <span style={{ fontSize: '.6rem', color: 'var(--muted)', fontStyle: 'italic' }}>čeká…</span>
                          ))}
                        </div>
                      ) : timeLocked ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: '.7rem' }}>🔒</span>
                          {tip ? (
                            <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>tip: {tip.predicted_home}:{tip.predicted_away}</span>
                          ) : (
                            <span style={{ fontSize: '.62rem', color: 'var(--muted)', fontStyle: 'italic' }}>nezadáno</span>
                          )}
                        </div>
                      ) : canTip ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {(['home', 'away'] as const).map((side, si) => (
                            <>
                              {si === 1 && <span key="sep" style={{ color: 'var(--muted)', fontWeight: 700 }}>:</span>}
                              <input key={side} type="text" inputMode="numeric" maxLength={2}
                                value={inp[side]}
                                onChange={e => setInput(s.id, side, e.target.value)}
                                style={{
                                  width: 32, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem',
                                  border: '1px solid var(--border)', borderRadius: 6, padding: '3px 4px',
                                  background: inp[side] !== '' ? 'rgba(37,99,235,.06)' : '#fff', outline: 'none',
                                }}
                                placeholder="–"
                              />
                            </>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>TBD</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                      {aT && <TeamLogo team={aT} size={24} />}
                      <span style={{ fontSize: '.82rem', fontWeight: aw ? 700 : 500, color: aT ? (aw ? 'var(--accent)' : 'var(--text)') : 'var(--muted)', fontStyle: aT ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {aT ? aT.name : 'TBD'}
                      </span>
                    </div>
                  </div>
                  {isDirty && (
                    <div style={{ padding: '2px .9rem 6px', fontSize: '.68rem', color: '#b45309', borderBottom: showBorder ? '1px solid var(--border)' : 'none' }}>
                      ● neuloženo — klikni Uložit vše
                    </div>
                  )}
                  </Fragment>
                )
              })}
            </div>
          </div>
        )
      })}
      {dirty.size > 0 && (
        <div style={{
          background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.5)',
          borderRadius: 8, padding: '.5rem .85rem', marginBottom: '.55rem',
          fontSize: '.76rem', fontWeight: 600, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: '.5rem',
        }}>
          ⚠️ Máš neuložené playoff tipy! Stiskni tlačítko níže před odchodem ze záložky.
        </div>
      )}
      <button type="button" className="btn btn-p btn-full" onClick={saveAll} style={{ opacity: saving ? .7 : 1 }}>
        {saving ? 'Ukládám…' : '💾 Uložit playoff tipy'}
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Tips({ matches, teams, groups, bracketRounds, bracketSlots, tournament, showToast }: Props) {
  const [tipsterId, setTipsterId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [view, setView] = useState<'tips' | 'leaderboard'>('tips')
  const { tipsters } = useTipsters()
  const { tips, loading: tipsLoading } = useTips(tipsterId)
  const { bracketTips, loading: bracketTipsLoading } = useBracketTips(tipsterId)
  const { specialTips } = useSpecialTips(tipsterId)

  const currentTipster = tipsters.find(t => t.id === tipsterId)
  const isLeague = tournament?.format === 'league'
  const groupMatches = matches.filter(m => m.group_id !== null)

  const handleLogin = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setTipsterId(id)
    showToast('Přihlášen ✓')
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setTipsterId(null)
  }

  if (!tipsterId) return <TipsLogin onSuccess={handleLogin} showToast={showToast} />

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

      {/* Bodové schéma */}
      <div style={{
        fontSize: '.7rem', color: 'var(--muted)', marginBottom: '1rem',
        padding: '.45rem .8rem', background: 'rgba(37,99,235,.04)',
        borderRadius: 8, border: '1px solid rgba(37,99,235,.1)',
        display: 'flex', gap: '.8rem', flexWrap: 'wrap',
      }}>
        <span>{isLeague ? 'Liga' : 'Skupiny'}: <strong style={{ color: 'var(--text)' }}>3</strong> / <strong style={{ color: 'var(--text)' }}>1 b.</strong></span>
        <span>Playoff (QF/SF/F): <strong style={{ color: 'var(--text)' }}>5</strong> / <strong style={{ color: 'var(--text)' }}>2 b.</strong></span>
        <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: '.8rem' }}>
          Vítěz turnaje: <strong style={{ color: 'var(--text)' }}>10 b.</strong> · Vítěz skupiny: <strong style={{ color: 'var(--text)' }}>5 b.</strong> · Poslední skupiny: <strong style={{ color: 'var(--text)' }}>3 b.</strong>
        </span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.2rem', background: 'var(--bg)', borderRadius: 8, padding: 4 }}>
        {(['tips', 'leaderboard'] as const).map(v => (
          <button key={v} type="button" onClick={() => setView(v)} style={segmentBtn(view === v)}>
            {v === 'tips' ? 'Moje tipy' : `Žebříček (${tipsters.length})`}
          </button>
        ))}
      </div>

      {view === 'tips' && (
        <>
          <SpecialTipsSection
            groups={groups} teams={teams} tipsterId={tipsterId}
            specialTips={specialTips} showToast={showToast}
            anyMatchPlayed={groupMatches.some(m => m.played)}
            anyPlayoffPlayed={bracketSlots.some(s => s.home_id != null || s.away_id != null)}
            isLeague={isLeague}
          />
          <GroupTipsSection
            matches={groupMatches} teams={teams} myTips={tips}
            tipsterId={tipsterId} loading={tipsLoading} showToast={showToast} isLeague={isLeague}
            lockFromDate={tournament?.tips_lock_from || undefined}
          />
          {bracketRounds.length > 0 && (
            <BracketTipsSection
              bracketRounds={bracketRounds} bracketSlots={bracketSlots} teams={teams}
              bracketTips={bracketTips} tipsterId={tipsterId} loading={bracketTipsLoading} showToast={showToast}
              lockFromDate={tournament?.tips_lock_from || undefined}
            />
          )}
        </>
      )}
      {view === 'leaderboard' && <Leaderboard tipsters={tipsters} myId={tipsterId} />}
    </div>
  )
}
