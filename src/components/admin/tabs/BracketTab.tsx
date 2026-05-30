import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { addMinutes } from '../../../lib/constants'
import { checkTournamentWinner } from '../../../lib/tipsEval'
import { getFormatDef, getLegacyFormatDef } from '../../../lib/formats'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'
import type { BracketGoal } from '../../../hooks/useBracketGoals'
import type { BracketAssist } from '../../../hooks/useBracketAssists'
import type { BracketCard } from '../../../hooks/useBracketCards'
import type { Tournament } from '../../../hooks/useTournament'
import type { Referee } from '../../../hooks/useReferees'

interface Props {
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  bracketGoals: BracketGoal[]
  bracketAssists: BracketAssist[]
  bracketCards: BracketCard[]
  referees?: Referee[]
  refetchBracket: () => Promise<void> | void
  refetchBracketGoals: () => void
  refetchBracketAssists: () => void
  refetchBracketCards: () => void
  tournament: Tournament | null
  showToast: (msg: string) => void
}

// ── Slot Editor (skóre + góly v jednom panelu, stejný layout jako MatchesTab) ──
function SlotEditor({
  slot, teams, players, bracketGoals, bracketAssists, bracketCards,
  referees, refetchBracketGoals, refetchBracketAssists, refetchBracketCards,
  assistsEnabled, cardsEnabled, showToast, onSave,
}: {
  slot: BracketSlot
  teams: Team[]
  players: Player[]
  bracketGoals: BracketGoal[]
  bracketAssists: BracketAssist[]
  bracketCards: BracketCard[]
  referees: Referee[]
  refetchBracketGoals: () => void
  refetchBracketAssists: () => void
  refetchBracketCards: () => void
  assistsEnabled: boolean
  cardsEnabled: boolean
  showToast: (m: string) => void
  onSave: (data: Partial<BracketSlot>) => Promise<void>
}) {
  const [s, setS] = useState({ ...slot, scheduled_time: slot.scheduled_time ?? '' })
  const [refereeId, setRefereeId] = useState<string>(slot.referee_id ?? '')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const homePlayers = players.filter(p => p.team_id === s.home_id).sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const awayPlayers = players.filter(p => p.team_id === s.away_id).sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  const buildCounts = (homeId: string | null, awayId: string | null) => {
    const c: Record<string, number> = {}
    for (const p of [...players.filter(p => p.team_id === homeId), ...players.filter(p => p.team_id === awayId)]) {
      const g = bracketGoals.find(g => g.player_id === p.id && g.slot_id === slot.id)
      c[p.id] = g?.count ?? 0
    }
    return c
  }
  const buildAssistCounts = (homeId: string | null, awayId: string | null) => {
    const c: Record<string, number> = {}
    for (const p of [...players.filter(p => p.team_id === homeId), ...players.filter(p => p.team_id === awayId)]) {
      const a = bracketAssists.find(a => a.player_id === p.id && a.slot_id === slot.id)
      c[p.id] = a?.count ?? 0
    }
    return c
  }
  const buildCardData = (homeId: string | null, awayId: string | null) => {
    const c: Record<string, { yellow: number; red: number }> = {}
    for (const p of [...players.filter(p => p.team_id === homeId), ...players.filter(p => p.team_id === awayId)]) {
      const playerCards = bracketCards.filter(c => c.player_id === p.id && c.slot_id === slot.id)
      c[p.id] = {
        yellow: playerCards.filter(c => c.type === 'yellow').length,
        red: playerCards.some(c => c.type === 'red' || c.type === 'yellow_red') ? 1 : 0,
      }
    }
    return c
  }

  const [counts, setCounts] = useState<Record<string, number>>(() => buildCounts(slot.home_id, slot.away_id))
  const [assistCounts, setAssistCounts] = useState<Record<string, number>>(() => buildAssistCounts(slot.home_id, slot.away_id))
  const [cardData, setCardData] = useState<Record<string, { yellow: number; red: number }>>(() => buildCardData(slot.home_id, slot.away_id))

  // Re-init when teams change
  useEffect(() => {
    setCounts(buildCounts(s.home_id, s.away_id))
    setAssistCounts(buildAssistCounts(s.home_id, s.away_id))
    setCardData(buildCardData(s.home_id, s.away_id))
  }, [s.home_id, s.away_id, slot.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeScore = (k: 'home_score' | 'away_score', delta: number) => {
    setS(x => {
      const next = Math.max(0, x[k] + delta)
      return { ...x, [k]: next, played: next > 0 ? true : x.played }
    })
  }
  const changeGoal = (pid: string, delta: number) =>
    setCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))
  const changeAssist = (pid: string, delta: number) =>
    setAssistCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))
  const changeYellow = (pid: string, delta: number) =>
    setCardData(c => ({ ...c, [pid]: { ...c[pid], yellow: Math.min(2, Math.max(0, (c[pid]?.yellow ?? 0) + delta)) } }))
  const toggleRed = (pid: string) =>
    setCardData(c => {
      const cur = c[pid]?.red ?? 0
      return { ...c, [pid]: { yellow: cur ? c[pid]?.yellow ?? 0 : 0, red: cur ? 0 : 1 } }
    })

  const ht = teams.find(t => t.id === s.home_id)
  const at = teams.find(t => t.id === s.away_id)

  const scoreBtn = (variant: 'minus' | 'plus') => ({
    width: 36, height: 36, borderRadius: 7, cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700,
    border: variant === 'plus' ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: variant === 'plus' ? 'var(--accent-dim)' : '#f8fafc',
    color: variant === 'plus' ? 'var(--accent)' : 'var(--muted)',
    flexShrink: 0,
  } as React.CSSProperties)

  const saveAll = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const allPlayers = [...homePlayers, ...awayPlayers]
    try {
      // 1) Save goals
      const goalResults = await Promise.all(allPlayers.map(p => {
        const count = counts[p.id] ?? 0
        return count > 0
          ? supabase.from('bracket_goals').upsert({ player_id: p.id, slot_id: slot.id, count }, { onConflict: 'player_id,slot_id' })
          : supabase.from('bracket_goals').delete().match({ player_id: p.id, slot_id: slot.id })
      }))
      const goalErr = goalResults.find(r => r.error)?.error
      if (goalErr) showToast('Chyba gólů: ' + goalErr.message)
      else refetchBracketGoals()

      // 2) Save assists
      if (assistsEnabled) {
        const assistResults = await Promise.all(allPlayers.map(p => {
          const count = assistCounts[p.id] ?? 0
          return count > 0
            ? supabase.from('bracket_assists').upsert({ player_id: p.id, slot_id: slot.id, count }, { onConflict: 'player_id,slot_id' })
            : supabase.from('bracket_assists').delete().match({ player_id: p.id, slot_id: slot.id })
        }))
        const assistErr = assistResults.find(r => r.error)?.error
        if (assistErr) showToast('Chyba asistencí: ' + assistErr.message)
        else refetchBracketAssists()
      }

      // 3) Save cards
      if (cardsEnabled) {
        await supabase.from('bracket_cards').delete().eq('slot_id', slot.id)
        const cardRows: { player_id: string; slot_id: string; type: string }[] = []
        for (const p of allPlayers) {
          const d = cardData[p.id]
          if (!d) continue
          for (let i = 0; i < (d.yellow ?? 0); i++) cardRows.push({ player_id: p.id, slot_id: slot.id, type: 'yellow' })
          if (d.red) cardRows.push({ player_id: p.id, slot_id: slot.id, type: 'red' })
        }
        if (cardRows.length > 0) {
          const { error: cErr } = await supabase.from('bracket_cards').insert(cardRows)
          if (cErr) showToast('Chyba kartiček: ' + cErr.message)
        }
        refetchBracketCards()
      }

      // 4) Save slot + auto-advance
      const autoPlayed = s.played || s.home_score > 0 || s.away_score > 0
      await onSave({
        home_id: s.home_id, away_id: s.away_id,
        home_score: s.home_score, away_score: s.away_score,
        played: autoPlayed,
        scheduled_time: s.scheduled_time || null,
        referee_id: refereeId || null,
      })
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const stepper = (val: number, onMinus: () => void, onPlus: () => void, accent = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button type="button" onClick={onMinus}
        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--muted)' }}>−</button>
      <span style={{ width: 28, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: val > 0 ? (accent ? '#059669' : 'var(--accent)') : 'var(--muted)' }}>
        {val}
      </span>
      <button type="button" onClick={onPlus}
        style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${accent ? '#059669' : 'var(--accent)'}`, background: accent ? 'rgba(5,150,105,.08)' : 'var(--accent-dim)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: accent ? '#059669' : 'var(--accent)' }}>+</button>
    </div>
  )

  const PlayerRow = ({ p, color }: { p: Player; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.38rem 0', borderBottom: '1px solid var(--border)' }}>
      <span className="team-dot" style={{ background: color }} />
      <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {stepper(counts[p.id] ?? 0, () => changeGoal(p.id, -1), () => changeGoal(p.id, +1))}
        {assistsEnabled && stepper(assistCounts[p.id] ?? 0, () => changeAssist(p.id, -1), () => changeAssist(p.id, +1), true)}
        {cardsEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
            <button type="button" onClick={() => changeYellow(p.id, -1)}
              style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.7rem', color: 'var(--muted)' }}>−</button>
            <span style={{ fontSize: '.85rem' }}>{'🟡'.repeat(Math.max(0, cardData[p.id]?.yellow ?? 0))}{cardData[p.id]?.yellow === 2 ? '→🔴' : ''}</span>
            <button type="button" onClick={() => changeYellow(p.id, +1)}
              style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #d97706', background: 'rgba(217,119,6,.08)', cursor: 'pointer', fontSize: '.7rem', color: '#d97706' }}>+</button>
            <button type="button" onClick={() => toggleRed(p.id)}
              style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${cardData[p.id]?.red ? '#dc2626' : 'var(--border)'}`, background: cardData[p.id]?.red ? 'rgba(220,38,38,.1)' : '#f8fafc', cursor: 'pointer', fontSize: '.8rem' }}>🔴</button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ padding: '.75rem .85rem .85rem', marginTop: '.55rem', borderTop: '2px solid rgba(37,99,235,.15)', background: 'var(--accent-dim)', borderRadius: '0 0 8px 8px' }}>

      {/* Tým selects */}
      <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.5rem' }}>
        🏟️ Týmy (Zápas {slot.position + 1})
      </div>
      <div className="field-row" style={{ marginBottom: '.65rem' }}>
        <select className="field-input field-select" style={{ fontSize: '.78rem' }} value={s.home_id ?? ''}
          onChange={e => setS(x => ({ ...x, home_id: e.target.value || null }))}>
          <option value="">TBD</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="field-input field-select" style={{ fontSize: '.78rem' }} value={s.away_id ?? ''}
          onChange={e => setS(x => ({ ...x, away_id: e.target.value || null }))}>
          <option value="">TBD</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Skóre — každý tým na vlastním řádku */}
      <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.55rem' }}>
        📝 Skóre zápasu
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.3rem' }}>
        <span className="team-dot" style={{ background: ht?.color ?? '#94a3b8', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {ht?.name ?? 'TBD'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button" style={scoreBtn('minus')} onClick={() => changeScore('home_score', -1)}>−</button>
          <span style={{ width: 38, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>{s.home_score}</span>
          <button type="button" style={scoreBtn('plus')} onClick={() => changeScore('home_score', +1)}>+</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.6rem' }}>
        <span className="team-dot" style={{ background: at?.color ?? '#94a3b8', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {at?.name ?? 'TBD'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button" style={scoreBtn('minus')} onClick={() => changeScore('away_score', -1)}>−</button>
          <span style={{ width: 38, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>{s.away_score}</span>
          <button type="button" style={scoreBtn('plus')} onClick={() => changeScore('away_score', +1)}>+</button>
        </div>
      </div>

      {/* Odehrán + čas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.65rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer', fontSize: '.82rem' }}>
          <input type="checkbox" checked={s.played} onChange={e => setS(x => ({ ...x, played: e.target.checked }))}
            style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
          Odehrán {s.played && <span style={{ color: 'var(--success)' }}>✓</span>}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>🕐</span>
          <input type="time" value={s.scheduled_time} onChange={e => setS(x => ({ ...x, scheduled_time: e.target.value }))}
            style={{ fontSize: '.82rem', padding: '.25rem .45rem', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }} />
        </div>
      </div>

      {/* Rozhodčí */}
      {referees.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.65rem' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>⚖</span>
          <select className="field-input field-select" value={refereeId} onChange={e => setRefereeId(e.target.value)}
            style={{ fontSize: '.82rem', padding: '.25rem .45rem', flex: 1 }}>
            <option value="">— Bez rozhodčího —</option>
            {referees.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      {/* Góly / asistence / kartičky hráčů — inline */}
      {(homePlayers.length > 0 || awayPlayers.length > 0) && (
        <div style={{ marginBottom: '.75rem' }}>
          <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.45rem' }}>
            ⚽ Góly{assistsEnabled ? ' + Asistence' : ''}{cardsEnabled ? ' + Kartičky' : ''}
          </div>
          {ht && homePlayers.length > 0 && (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.2rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="team-dot" style={{ background: ht.color }} />{ht.name}
            </div>
          )}
          {homePlayers.map(p => <PlayerRow key={p.id} p={p} color={ht?.color ?? '#94a3b8'} />)}
          {at && awayPlayers.length > 0 && (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.5rem', marginBottom: '.2rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="team-dot" style={{ background: at.color }} />{at.name}
            </div>
          )}
          {awayPlayers.map(p => <PlayerRow key={p.id} p={p} color={at?.color ?? '#94a3b8'} />)}
        </div>
      )}

      <button type="button" className="btn btn-p btn-sm" onClick={saveAll} style={{ opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Ukládám…' : '💾 Uložit vše'}
      </button>
    </div>
  )
}

// ── Round Card ────────────────────────────────────────────────────────────────
function RoundCard({
  round, rSlots, teams, players, bracketGoals, bracketAssists, bracketCards,
  referees, refetchBracketGoals, refetchBracketAssists, refetchBracketCards,
  assistsEnabled, cardsEnabled, showToast, matchDuration, onSave, onRemove, onApplyTimes,
}: {
  round: BracketRound
  rSlots: BracketSlot[]
  teams: Team[]
  players: Player[]
  bracketGoals: BracketGoal[]
  bracketAssists: BracketAssist[]
  bracketCards: BracketCard[]
  referees: Referee[]
  refetchBracketGoals: () => void
  refetchBracketAssists: () => void
  refetchBracketCards: () => void
  assistsEnabled: boolean
  cardsEnabled: boolean
  showToast: (m: string) => void
  matchDuration: number
  onSave: (slotId: string, data: Partial<BracketSlot>) => Promise<void>
  onRemove: (id: string) => void
  onApplyTimes: (r: BracketRound & { _start: string; _break: number }) => void
}) {
  const [start, setStart] = useState(round.scheduled_start ?? '')
  const [brk, setBrk] = useState(String(round.break_after ?? 5))
  const [openSlotId, setOpenSlotId] = useState<string | null>(null)

  const preview = () => {
    if (!start || rSlots.length === 0) return null
    const b = parseInt(brk) || 0
    const last = addMinutes(start, (rSlots.length - 1) * (matchDuration + b) + matchDuration)
    return `${start} – ${last}`
  }

  return (
    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.85rem .95rem', marginBottom: '.65rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.55rem' }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '.06em', flex: 1 }}>{round.name}</span>
        <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{rSlots.length} zápasů</span>
        <button type="button" className="btn btn-d btn-sm" onClick={() => onRemove(round.id)}>Smazat kolo</button>
      </div>

      {/* Časování kola */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.6rem', padding: '.5rem .6rem', background: 'rgba(37,99,235,.04)', border: '1px solid rgba(37,99,235,.12)', borderRadius: 7 }}>
        <div>
          <div style={{ fontSize: '.67rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '.2rem' }}>Začátek kola</div>
          <input type="time" value={start} onChange={e => setStart(e.target.value)}
            style={{ fontSize: '.8rem', padding: '.22rem .4rem', border: '1px solid var(--border)', borderRadius: 5 }} />
        </div>
        <div>
          <div style={{ fontSize: '.67rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '.2rem' }}>Pauza mezi zápasy (min)</div>
          <input type="number" min="0" value={brk} onChange={e => setBrk(e.target.value)}
            style={{ fontSize: '.8rem', padding: '.22rem .4rem', border: '1px solid var(--border)', borderRadius: 5, width: 64 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          <button type="button" className="btn btn-s btn-sm" onClick={() => onApplyTimes({ ...round, _start: start, _break: parseInt(brk) || 0 })}>
            ⏰ Rozepsat časy
          </button>
          {preview() && <span style={{ fontSize: '.67rem', color: 'var(--muted)' }}>{preview()}</span>}
        </div>
      </div>

      {/* Zápasy — kompaktní řádky s rozbalovacím editorem */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
        {rSlots.map(slot => {
          const ht = teams.find(t => t.id === slot.home_id)
          const at = teams.find(t => t.id === slot.away_id)
          const isOpen = openSlotId === slot.id
          return (
            <div key={slot.id} style={{ border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', background: '#fff' }}>
              {/* Kompaktní řádek */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.42rem .65rem', background: isOpen ? 'var(--accent-dim)' : '#fff' }}>
                <span style={{ fontSize: '.68rem', color: 'var(--muted)', minWidth: 34, flexShrink: 0 }}>
                  {slot.scheduled_time || '—'}
                </span>
                <span style={{ flex: 1, fontSize: '.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ht?.name ?? 'TBD'}
                  {' '}
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: slot.played ? 'var(--accent)' : 'var(--muted)', fontSize: '.9rem' }}>
                    {slot.played ? `${slot.home_score}:${slot.away_score}` : 'vs'}
                  </span>
                  {' '}
                  {at?.name ?? 'TBD'}
                </span>
                {slot.played && <span style={{ fontSize: '.65rem', color: 'var(--success)', flexShrink: 0 }}>✓</span>}
                <button
                  type="button"
                  className="btn btn-s btn-sm"
                  onClick={() => setOpenSlotId(isOpen ? null : slot.id)}
                  style={{ flexShrink: 0 }}
                >
                  {isOpen ? '✕ Zavřít' : '✎ Upravit'}
                </button>
              </div>
              {/* Rozbalený editor */}
              {isOpen && (
                <SlotEditor
                  slot={slot} teams={teams} players={players}
                  bracketGoals={bracketGoals} bracketAssists={bracketAssists} bracketCards={bracketCards}
                  referees={referees}
                  refetchBracketGoals={refetchBracketGoals}
                  refetchBracketAssists={refetchBracketAssists}
                  refetchBracketCards={refetchBracketCards}
                  assistsEnabled={assistsEnabled} cardsEnabled={cardsEnabled}
                  showToast={showToast}
                  onSave={data => onSave(slot.id, data) as Promise<void>}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main BracketTab ───────────────────────────────────────────────────────────
export default function BracketTab({ teams, players, groups, matches, bracketRounds, bracketSlots, bracketGoals, bracketAssists, bracketCards, referees = [], refetchBracket, refetchBracketGoals, refetchBracketAssists, refetchBracketCards, tournament, showToast }: Props) {
  const [name, setName] = useState('')
  const [slotCount, setSlotCount] = useState('2')
  const [generating, setGenerating] = useState(false)

  const isLeague = tournament?.format === 'league'

  const groupMatches = matches.filter(m => groups.some(g => g.id === m.group_id))
  const playedCount = groupMatches.filter(m => m.played).length
  const allGroupsComplete = groupMatches.length > 0 && playedCount === groupMatches.length

  const totalTeams = teams.length
  const advancingPerGroup = tournament?.advancing_per_group
    || (Math.round(totalTeams / Math.max(1, groups.length)) >= 6 ? 4 : 2)

  const formatDef = getFormatDef(tournament?.format_id ?? '') ?? getLegacyFormatDef(tournament, groups)
  const formatLabel = formatDef?.label ?? 'Neznámý formát'
  const formatDescription = formatDef?.description ?? ''

  // ── Step 1: Create bracket structure (all slots TBD) ─────────────────
  const generateStructure = async () => {
    if (!formatDef) { showToast('Nejdříve vyber formát v Nastavení'); return }
    if (!isLeague && groups.length < 1) { showToast('Potřebuješ aspoň 1 skupinu'); return }
    if (!confirm(`Vytvořit strukturu playoff (${formatLabel})? Stávající pavouk bude smazán.`)) return

    setGenerating(true)
    try {
      if (bracketRounds.length) {
        await supabase.from('bracket_slots').delete().in('round_id', bracketRounds.map(r => r.id))
        await supabase.from('bracket_rounds').delete().in('id', bracketRounds.map(r => r.id))
      }
      await formatDef.fns.generate()
      await refetchBracket()
      showToast('Struktura playoff vytvořena ✓')
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGenerating(false)
    }
  }

  // ── Step 2: Seed teams from completed standings ───────────────────────
  const seedTeams = async () => {
    if (!formatDef) { showToast('Nejdříve vyber formát v Nastavení'); return }
    if (!bracketRounds.length) { showToast('Nejdříve vytvoř strukturu playoff'); return }
    if (!allGroupsComplete) {
      showToast(`Skupiny nejsou dohrány (${playedCount}/${groupMatches.length} zápasů)`)
      return
    }
    if (!confirm('Nasadit týmy do playoff dle tabulky? Vyplní se TBD sloty prvního kola.')) return

    setGenerating(true)
    try {
      await formatDef.fns.seed({
        groups,
        matches,
        bracketRounds,
        bracketSlots,
        advancingPerGroup,
      })
      await refetchBracket()
      showToast('Týmy nasazeny do playoff ✓')
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGenerating(false)
    }
  }

  const addRound = async () => {
    if (!name.trim()) { showToast('Zadej název kola'); return }
    const n = parseInt(slotCount) || 1
    const pos = bracketRounds.length

    const { data: round, error: rErr } = await supabase
      .from('bracket_rounds').insert({ name: name.trim(), position: pos }).select().single()
    if (rErr) { showToast('Chyba: ' + rErr.message); return }

    const slots = Array.from({ length: n }, (_, i) => ({
      round_id: round.id, position: i,
      home_id: null, away_id: null,
      home_score: 0, away_score: 0, played: false,
    }))
    const { error: sErr } = await supabase.from('bracket_slots').insert(slots)
    if (sErr) { showToast('Chyba: ' + sErr.message); return }

    setName('')
    showToast('Kolo přidáno ✓')
  }

  const removeRound = async (id: string) => {
    if (!confirm('Smazat kolo a všechny jeho zápasy?')) return
    await supabase.from('bracket_slots').delete().eq('round_id', id)
    const { error } = await supabase.from('bracket_rounds').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Kolo smazáno')
  }

  const saveSlot = async (slotId: string, data: Partial<BracketSlot>): Promise<void> => {
    const payload = { ...data, scheduled_time: data.scheduled_time ?? null }
    const { error } = await supabase.from('bracket_slots').update(payload).eq('id', slotId)
    if (error) { showToast('Chyba: ' + error.message); return }

    const isDecisive = data.played && data.home_score !== data.away_score
    const hasBothTeams = data.home_id && data.away_id
    if (!isDecisive || !hasBothTeams) { await refetchBracket(); showToast('Uloženo ✓'); return }

    const slot = bracketSlots.find(s => s.id === slotId)
    const currentRound = slot ? bracketRounds.find(r => r.id === slot.round_id) : null
    if (!slot || !currentRound) { await refetchBracket(); showToast('Uloženo ✓'); return }

    const maxPos = Math.max(...bracketRounds.map(r => r.position))

    // Final match — check tournament winner
    if (currentRound.position === maxPos) {
      await refetchBracket()
      const evaluated = await checkTournamentWinner(bracketRounds)
      showToast(evaluated ? 'Uloženo ✓ · 🏆 Vítěz turnaje vyhodnocen' : 'Uloženo ✓')
      return
    }

    // Delegate auto-advance to format
    if (!formatDef) { await refetchBracket(); showToast('Uloženo ✓'); return }
    try {
      const result = await formatDef.fns.autoAdvance({
        slot: { ...slot, ...data } as BracketSlot,
        data,
        currentRound,
        allRounds: bracketRounds,
        allSlots: bracketSlots,
      })
      await refetchBracket()
      showToast(result.toast)
    } catch (e: unknown) {
      await refetchBracket()
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const applyRoundTimes = async (round: BracketRound & { _start: string; _break: number }) => {
    if (!round._start) { showToast('Zadej čas začátku kola'); return }
    const dur = tournament?.match_duration ?? 20
    const brk = round._break
    const rSlots = [...bracketSlots]
      .filter(s => s.round_id === round.id)
      .sort((a, b) => a.position - b.position)
    try {
      const { error: rErr } = await supabase.from('bracket_rounds')
        .update({ scheduled_start: round._start, break_after: brk })
        .eq('id', round.id)
      if (rErr) throw rErr
      await Promise.all(
        rSlots.map((s, i) => {
          const t = addMinutes(round._start, i * (dur + brk))
          return supabase.from('bracket_slots').update({ scheduled_time: t }).eq('id', s.id)
            .then(({ error }) => { if (error) throw error })
        })
      )
      await refetchBracket()
      showToast(`Časy rozepsány pro ${rSlots.length} zápasů ✓`)
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const sorted = [...bracketRounds].sort((a, b) => a.position - b.position)

  return (
    <div>
      {/* Step 1 — Structure */}
      <div className="info-box" style={{ marginBottom: '.75rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '.35rem', fontSize: '.82rem' }}>📋 Krok 1 — Vytvořit strukturu</div>
        <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '.6rem' }}>
          Vytvoří prázdný pavouk (všechna místa TBD). Lze udělat <strong>před turnajem</strong>.<br />
          {formatDef
            ? <><strong>{formatLabel}:</strong> {formatDescription}</>
            : <span style={{ color: 'var(--danger)' }}>⚠️ Nejdříve vyber formát v záložce Nastavení</span>
          }
        </div>
        <button type="button" className="btn btn-s" onClick={generateStructure} style={{ opacity: generating ? 0.6 : 1 }}>
          {generating ? 'Vytvářím…' : '⚡ Vytvořit strukturu playoff'}
        </button>
      </div>

      {/* Step 2 — Seed teams */}
      <div className={allGroupsComplete ? 'info-box' : 'warn-box'} style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '.35rem', fontSize: '.82rem' }}>🏆 Krok 2 — Nasadit týmy ze skupin</div>
        <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '.6rem' }}>
          {allGroupsComplete
            ? <>✅ Všechny zápasy jsou odehrány. Lze nasadit týmy.<br />
               {formatDescription}</>
            : <>⏳ Zápasy nejsou dohrány — odehráno <strong>{playedCount}/{groupMatches.length}</strong> zápasů.</>
          }
        </div>
        <button
          type="button"
          className="btn btn-p"
          onClick={seedTeams}
          style={{ opacity: allGroupsComplete && !generating ? 1 : 0.5 }}
        >
          {generating ? 'Nasazuji…' : '🏆 Nasadit týmy do playoff'}
        </button>
      </div>

      <hr className="divider" />
      <div className="sub-title">Přidat kolo ručně</div>
      <div className="field-group">
        <label className="field-label">Název kola</label>
        <input className="field-input" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addRound()} placeholder="Čtvrtfinále, Semifinále, Finále…" />
      </div>
      <div className="field-group">
        <label className="field-label">Počet zápasů</label>
        <select className="field-input field-select" value={slotCount} onChange={e => setSlotCount(e.target.value)}>
          <option value="1">1 zápas (Finále)</option>
          <option value="2">2 zápasy (Semifinále)</option>
          <option value="4">4 zápasy (Čtvrtfinále)</option>
          <option value="8">8 zápasů</option>
        </select>
      </div>
      <button type="button" className="btn btn-s" onClick={addRound}>+ Přidat kolo</button>

      <hr className="divider" />
      {!sorted.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádná kola.</p>
      ) : sorted.map(round => {
        const rSlots = [...bracketSlots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        return (
          <RoundCard
            key={round.id}
            round={round}
            rSlots={rSlots}
            teams={teams}
            players={players}
            bracketGoals={bracketGoals}
            bracketAssists={bracketAssists}
            bracketCards={bracketCards}
            referees={referees}
            refetchBracketGoals={refetchBracketGoals}
            refetchBracketAssists={refetchBracketAssists}
            refetchBracketCards={refetchBracketCards}
            assistsEnabled={tournament?.assists_enabled ?? false}
            cardsEnabled={tournament?.cards_enabled ?? false}
            showToast={showToast}
            matchDuration={tournament?.match_duration ?? 20}
            onSave={saveSlot}
            onRemove={removeRound}
            onApplyTimes={applyRoundTimes}
          />
        )
      })}
    </div>
  )
}
