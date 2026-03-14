import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcGroupStandings } from '../../../lib/standings'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'
import type { BracketGoal } from '../../../hooks/useBracketGoals'

interface Props {
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  bracketGoals: BracketGoal[]
  refetchBracketGoals: () => void
  showToast: (msg: string) => void
}

// ── Bracket Goal Editor ───────────────────────────────────────────────────────
function BracketGoalEditor({
  slot, teams, players, bracketGoals, showToast, onClose, refetchBracketGoals,
}: {
  slot: BracketSlot
  teams: Team[]
  players: Player[]
  bracketGoals: BracketGoal[]
  showToast: (m: string) => void
  onClose: () => void
  refetchBracketGoals: () => void
}) {
  const homePlayers = players.filter(p => p.team_id === slot.home_id)
  const awayPlayers = players.filter(p => p.team_id === slot.away_id)
  const allPlayers = [...homePlayers, ...awayPlayers]

  const initCounts = () => {
    const c: Record<string, number> = {}
    for (const p of allPlayers) {
      const g = bracketGoals.find(g => g.player_id === p.id && g.slot_id === slot.id)
      c[p.id] = g?.count ?? 0
    }
    return c
  }
  const [counts, setCounts] = useState<Record<string, number>>(initCounts)

  const change = (pid: string, delta: number) =>
    setCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))

  const saveGoals = async () => {
    for (const [player_id, count] of Object.entries(counts)) {
      if (count > 0) {
        const { error } = await supabase.from('bracket_goals').upsert(
          { player_id, slot_id: slot.id, count },
          { onConflict: 'player_id,slot_id' }
        )
        if (error) { showToast('Chyba: ' + error.message); return }
      } else {
        await supabase.from('bracket_goals').delete().match({ player_id, slot_id: slot.id })
      }
    }
    refetchBracketGoals()
    showToast('Góly uloženy ✓')
    onClose()
  }

  const ht = teams.find(t => t.id === slot.home_id)
  const at = teams.find(t => t.id === slot.away_id)

  const PlayerRow = ({ p, color }: { p: Player; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
      <span className="team-dot" style={{ background: color }} />
      <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button type="button" onClick={() => change(p.id, -1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--muted)' }}>−</button>
        <span style={{ width: 28, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: counts[p.id] > 0 ? 'var(--accent)' : 'var(--muted)' }}>
          {counts[p.id] ?? 0}
        </span>
        <button type="button" onClick={() => change(p.id, +1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--accent)' }}>+</button>
      </div>
    </div>
  )

  return (
    <div style={{ marginTop: '.75rem', padding: '.85rem', background: 'var(--accent-dim)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 9 }}>
      <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.65rem' }}>
        ⚽ Góly hráčů
      </div>
      {allPlayers.length === 0 ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.65rem' }}>
          Hráči nejsou zadáni. Přidej je v záložce Týmy → Soupiska.
        </p>
      ) : (
        <div style={{ marginBottom: '.75rem' }}>
          {ht && homePlayers.length > 0 && (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.4rem', marginBottom: '.2rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="team-dot" style={{ background: ht.color }} />{ht.name}
            </div>
          )}
          {homePlayers.map(p => <PlayerRow key={p.id} p={p} color={ht?.color ?? '#94a3b8'} />)}
          {at && awayPlayers.length > 0 && (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.6rem', marginBottom: '.2rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="team-dot" style={{ background: at.color }} />{at.name}
            </div>
          )}
          {awayPlayers.map(p => <PlayerRow key={p.id} p={p} color={at?.color ?? '#94a3b8'} />)}
        </div>
      )}
      <div style={{ display: 'flex', gap: '.4rem' }}>
        <button type="button" className="btn btn-p btn-sm" onClick={saveGoals}>💾 Uložit góly</button>
        <button type="button" className="btn btn-d btn-sm" onClick={onClose}>Zavřít</button>
      </div>
    </div>
  )
}

// ── Slot Editor ───────────────────────────────────────────────────────────────
function SlotEditor({
  slot, teams, players, bracketGoals, refetchBracketGoals, showToast, onSave,
}: {
  slot: BracketSlot
  teams: Team[]
  players: Player[]
  bracketGoals: BracketGoal[]
  refetchBracketGoals: () => void
  showToast: (m: string) => void
  onSave: (data: Partial<BracketSlot>) => void
}) {
  const [s, setS] = useState({ ...slot })
  const [goalOpen, setGoalOpen] = useState(false)

  const changeScore = (k: 'home_score' | 'away_score', delta: number) =>
    setS(x => ({ ...x, [k]: Math.max(0, x[k] + delta) }))

  const btnMinus = { width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: '#f8fafc', fontSize: '1rem', fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' } as const
  const btnPlus  = { width: 30, height: 30, borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--accent-dim)', fontSize: '1rem', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' } as const

  return (
    <div style={{ paddingTop: '.55rem', marginTop: '.55rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.63rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.38rem' }}>
        Zápas {slot.position + 1}
      </div>

      {/* Team selects */}
      <div className="field-row" style={{ marginBottom: '.32rem' }}>
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

      {/* Score steppers */}
      <div className="field-row3" style={{ marginBottom: '.32rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={() => changeScore('home_score', -1)} style={btnMinus}>−</button>
          <input className="field-input" type="number" min="0"
            style={{ width: 52, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}
            value={s.home_score} onChange={e => setS(x => ({ ...x, home_score: parseInt(e.target.value) || 0 }))} />
          <button type="button" onClick={() => changeScore('home_score', +1)} style={btnPlus}>+</button>
        </div>
        <div className="field-sep">:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={() => changeScore('away_score', -1)} style={btnMinus}>−</button>
          <input className="field-input" type="number" min="0"
            style={{ width: 52, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}
            value={s.away_score} onChange={e => setS(x => ({ ...x, away_score: parseInt(e.target.value) || 0 }))} />
          <button type="button" onClick={() => changeScore('away_score', +1)} style={btnPlus}>+</button>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '.42rem', marginBottom: '.5rem', cursor: 'pointer', fontSize: '.78rem' }}>
        <input type="checkbox" checked={s.played} onChange={e => setS(x => ({ ...x, played: e.target.checked }))}
          style={{ accentColor: 'var(--accent)' }} />
        Odehráno
      </label>

      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-s btn-sm" onClick={() => onSave({
          home_id: s.home_id, away_id: s.away_id,
          home_score: s.home_score, away_score: s.away_score, played: s.played,
        })}>💾 Uložit</button>
        <button type="button" className="btn btn-s btn-sm" onClick={() => setGoalOpen(o => !o)}>
          {goalOpen ? '✕ Zavřít góly' : '⚽ Góly'}
        </button>
      </div>

      {goalOpen && (
        <BracketGoalEditor
          slot={slot} teams={teams} players={players}
          bracketGoals={bracketGoals} showToast={showToast}
          onClose={() => setGoalOpen(false)}
          refetchBracketGoals={refetchBracketGoals}
        />
      )}
    </div>
  )
}

// ── Main BracketTab ───────────────────────────────────────────────────────────
export default function BracketTab({ teams, players, groups, matches, bracketRounds, bracketSlots, bracketGoals, refetchBracketGoals, showToast }: Props) {
  const [name, setName] = useState('')
  const [slotCount, setSlotCount] = useState('2')
  const [generating, setGenerating] = useState(false)

  // Group completion status
  const groupMatches = matches.filter(m => groups.some(g => g.id === m.group_id))
  const playedCount = groupMatches.filter(m => m.played).length
  const allGroupsComplete = groupMatches.length > 0 && playedCount === groupMatches.length

  const totalTeams = teams.length
  const advancingPerGroup = totalTeams <= 10 ? 2 : 4
  const format = advancingPerGroup === 2 ? 'sf' : 'qf'
  const formatLabel = format === 'sf' ? 'Semifinále' : 'Čtvrtfinále'

  // ── Step 1: Create bracket structure (all slots TBD) ─────────────────
  const generateStructure = async () => {
    if (groups.length < 2) { showToast('Potřebuješ aspoň 2 skupiny'); return }
    if (!confirm(`Vytvořit strukturu playoff (${formatLabel})? Stávající pavouk bude smazán.`)) return

    setGenerating(true)
    try {
      if (bracketRounds.length) {
        await supabase.from('bracket_slots').delete().in('round_id', bracketRounds.map(r => r.id))
        await supabase.from('bracket_rounds').delete().in('id', bracketRounds.map(r => r.id))
      }

      const createRound = async (roundName: string, count: number, pos: number) => {
        const { data: round, error } = await supabase
          .from('bracket_rounds').insert({ name: roundName, position: pos }).select().single()
        if (error) throw error
        const slots = Array.from({ length: count }, (_, i) => ({
          round_id: round.id, position: i,
          home_id: null, away_id: null,
          home_score: 0, away_score: 0, played: false,
        }))
        const { error: se } = await supabase.from('bracket_slots').insert(slots)
        if (se) throw se
      }

      if (format === 'sf') {
        await createRound('Semifinále', 2, 0)
        await createRound('O 3. místo', 1, 1)
        await createRound('Finále',     1, 2)
      } else {
        await createRound('Čtvrtfinále', 4, 0)
        await createRound('Semifinále',  2, 1)
        await createRound('O 3. místo',  1, 2)
        await createRound('Finále',      1, 3)
      }

      showToast('Struktura playoff vytvořena ✓')
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGenerating(false)
    }
  }

  // ── Step 2: Seed teams from completed group standings ─────────────────
  const seedTeams = async () => {
    if (!bracketRounds.length) { showToast('Nejdříve vytvoř strukturu playoff'); return }
    // Check done inside fn (button is never disabled so it works on mobile touch)
    if (!allGroupsComplete) {
      showToast(`Skupiny nejsou dohrány (${playedCount}/${groupMatches.length} zápasů)`)
      return
    }
    if (!confirm('Nasadit týmy do playoff dle tabulek skupin? Vyplní se TBD sloty prvního kola.')) return

    const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
    const grouped = sortedGroups.map(g =>
      calcGroupStandings(g, matches).slice(0, advancingPerGroup).map(r => r.id)
    )
    const A = grouped[0] ?? []
    const B = grouped[1] ?? []
    const fill = (arr: string[], i: number): string | null => arr[i] ?? null

    const pairs: Array<{ home: string | null; away: string | null }> = format === 'sf'
      ? [
          { home: fill(A, 0), away: fill(B, 1) },
          { home: fill(B, 0), away: fill(A, 1) },
        ]
      : [
          { home: fill(A, 0), away: fill(B, 3) },
          { home: fill(B, 1), away: fill(A, 2) },
          { home: fill(B, 0), away: fill(A, 3) },
          { home: fill(A, 1), away: fill(B, 2) },
        ]

    const firstRound = bracketRounds.find(r => r.position === 0)
    if (!firstRound) { showToast('Struktura playoff nenalezena'); return }
    const firstSlots = [...bracketSlots]
      .filter(s => s.round_id === firstRound.id)
      .sort((a, b) => a.position - b.position)

    setGenerating(true)
    try {
      for (let i = 0; i < pairs.length; i++) {
        const slot = firstSlots[i]
        if (!slot) continue
        const { error } = await supabase
          .from('bracket_slots')
          .update({ home_id: pairs[i].home, away_id: pairs[i].away })
          .eq('id', slot.id)
        if (error) throw error
      }
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

  const saveSlot = async (slotId: string, data: Partial<BracketSlot>) => {
    const { error } = await supabase.from('bracket_slots').update(data).eq('id', slotId)
    if (error) { showToast('Chyba: ' + error.message); return }

    // ── Auto-advance winner to next round ──────────────────────────────
    const isDecisive = data.played && data.home_score !== data.away_score
    const hasBothTeams = data.home_id && data.away_id
    if (!isDecisive || !hasBothTeams) { showToast('Uloženo ✓'); return }

    const slot = bracketSlots.find(s => s.id === slotId)
    const currentRound = slot ? bracketRounds.find(r => r.id === slot.round_id) : null
    if (!slot || !currentRound) { showToast('Uloženo ✓'); return }

    const maxPos = Math.max(...bracketRounds.map(r => r.position))
    if (currentRound.position >= maxPos - 1) { showToast('Uloženo ✓'); return }

    const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
    const winner = homeWins ? data.home_id! : data.away_id!
    const loser  = homeWins ? data.away_id! : data.home_id!
    const isEven = slot.position % 2 === 0

    const slotsOf = (roundId: string) =>
      [...bracketSlots].filter(s => s.round_id === roundId).sort((a, b) => a.position - b.position)

    const isSemifinal = currentRound.position === maxPos - 2

    if (isSemifinal) {
      const finalRound = bracketRounds.find(r => r.position === maxPos)
      const thirdRound = bracketRounds.find(r => r.position === maxPos - 1)
      const finalSlot  = finalRound ? slotsOf(finalRound.id)[0] : null
      const thirdSlot  = thirdRound ? slotsOf(thirdRound.id)[0] : null
      const field = isEven ? 'home_id' : 'away_id'

      const ops: Promise<unknown>[] = []
      if (finalSlot && !finalSlot[field])
        ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', finalSlot.id))
      if (thirdSlot && !thirdSlot[field])
        ops.push(supabase.from('bracket_slots').update({ [field]: loser }).eq('id', thirdSlot.id))
      await Promise.all(ops)
      showToast('Uloženo ✓ — vítěz postoupil do finále')
    } else {
      const nextRound = bracketRounds.find(r => r.position === currentRound.position + 1)
      if (!nextRound) { showToast('Uloženo ✓'); return }
      const nextSlots = slotsOf(nextRound.id)
      const targetSlot = nextSlots[Math.floor(slot.position / 2)]
      const field = isEven ? 'home_id' : 'away_id'
      if (targetSlot && !targetSlot[field]) {
        await supabase.from('bracket_slots').update({ [field]: winner }).eq('id', targetSlot.id)
        showToast('Uloženo ✓ — vítěz postoupil dál')
      } else {
        showToast('Uloženo ✓')
      }
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
          <strong>≤ 10 týmů:</strong> Semifinále → O 3. místo + Finále<br />
          <strong>≥ 11 týmů:</strong> Čtvrtfinále → Semifinále → O 3. místo + Finále
        </div>
        <button type="button" className="btn btn-s" onClick={generateStructure} disabled={generating}>
          {generating ? 'Vytvářím…' : '⚡ Vytvořit strukturu playoff'}
        </button>
      </div>

      {/* Step 2 — Seed teams */}
      <div className={allGroupsComplete ? 'info-box' : 'warn-box'} style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '.35rem', fontSize: '.82rem' }}>🏆 Krok 2 — Nasadit týmy ze skupin</div>
        <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '.6rem' }}>
          {allGroupsComplete
            ? <>✅ Všechny skupinové zápasy jsou odehrány. Lze nasadit týmy.<br />Doplní A1 vs B2, B1 vs A2 (nebo dle čtvrtfinálového klíče).</>
            : <>⏳ Skupiny nejsou dohrány — odehráno <strong>{playedCount}/{groupMatches.length}</strong> zápasů.</>
          }
        </div>
        {/* type="button" + never disabled → works on mobile touch */}
        <button
          type="button"
          className="btn btn-p"
          onClick={seedTeams}
          disabled={generating}
          style={{ opacity: allGroupsComplete ? 1 : 0.5 }}
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
          <div key={round.id} style={{
            background: '#f8fafc', border: '1px solid var(--border)',
            borderRadius: 9, padding: '.85rem .95rem', marginBottom: '.65rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.3rem' }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '.06em', flex: 1 }}>{round.name}</span>
              <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{rSlots.length} zápasů</span>
              <button type="button" className="btn btn-d btn-sm" onClick={() => removeRound(round.id)}>Smazat kolo</button>
            </div>
            {rSlots.map(slot => (
              <SlotEditor
                key={slot.id} slot={slot} teams={teams} players={players}
                bracketGoals={bracketGoals} refetchBracketGoals={refetchBracketGoals}
                showToast={showToast}
                onSave={data => saveSlot(slot.id, data)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
