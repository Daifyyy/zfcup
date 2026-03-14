import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcGroupStandings } from '../../../lib/standings'
import type { Team } from '../../../hooks/useTeams'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'

interface Props {
  teams: Team[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  showToast: (msg: string) => void
}

function SlotEditor({
  slot, teams, onSave,
}: {
  slot: BracketSlot
  teams: Team[]
  onSave: (data: Partial<BracketSlot>) => void
}) {
  const [s, setS] = useState({ ...slot })

  return (
    <div style={{ paddingTop: '.55rem', marginTop: '.55rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.63rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.38rem' }}>
        Zápas {slot.position + 1}
      </div>
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
      <div className="field-row3" style={{ marginBottom: '.32rem' }}>
        <input className="field-input" type="number" min="0" style={{ fontSize: '.78rem' }}
          value={s.home_score} onChange={e => setS(x => ({ ...x, home_score: parseInt(e.target.value) || 0 }))} />
        <div className="field-sep">:</div>
        <input className="field-input" type="number" min="0" style={{ fontSize: '.78rem' }}
          value={s.away_score} onChange={e => setS(x => ({ ...x, away_score: parseInt(e.target.value) || 0 }))} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '.42rem', marginBottom: '.38rem', cursor: 'pointer', fontSize: '.78rem' }}>
        <input type="checkbox" checked={s.played} onChange={e => setS(x => ({ ...x, played: e.target.checked }))}
          style={{ accentColor: 'var(--accent)' }} />
        Odehráno
      </label>
      <button className="btn btn-s btn-sm" onClick={() => onSave({
        home_id: s.home_id, away_id: s.away_id,
        home_score: s.home_score, away_score: s.away_score, played: s.played,
      })}>💾 Uložit</button>
    </div>
  )
}

export default function BracketTab({ teams, groups, matches, bracketRounds, bracketSlots, showToast }: Props) {
  const [name, setName] = useState('')
  const [slotCount, setSlotCount] = useState('2')
  const [generating, setGenerating] = useState(false)

  // ── Playoff auto-generation ──────────────────────────────────────────
  const generatePlayoff = async () => {
    if (groups.length < 2) { showToast('Potřebuješ aspoň 2 skupiny'); return }

    const totalTeams = teams.length
    // 10 teams → top 2 per group → semifinal format
    // 12 teams → top 4 per group → quarterfinal format
    const advancingPerGroup = totalTeams <= 10 ? 2 : 4
    const format = advancingPerGroup === 2 ? 'sf' : 'qf'

    // Get advancing team IDs per group (sorted by standings)
    const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
    const grouped = sortedGroups.map(g => {
      const rows = calcGroupStandings(g, matches)
      return rows.slice(0, advancingPerGroup).map(r => r.id)
    })

    // grouped[0] = Group A top teams [A1, A2, (A3, A4)]
    // grouped[1] = Group B top teams [B1, B2, (B3, B4)]
    const A = grouped[0] ?? []
    const B = grouped[1] ?? []
    const fill = (arr: string[], i: number) => arr[i] ?? null

    if (!confirm(`Vygenerovat playoff (${format === 'sf' ? 'Semifinále' : 'Čtvrtfinále'})? Stávající pavouk bude smazán.`)) return

    setGenerating(true)
    try {
      // Delete existing bracket
      if (bracketRounds.length) {
        await supabase.from('bracket_slots').delete().in('round_id', bracketRounds.map(r => r.id))
        await supabase.from('bracket_rounds').delete().in('id', bracketRounds.map(r => r.id))
      }

      // Helper: insert round + slots
      const createRound = async (roundName: string, slotPairs: Array<{ home: string | null; away: string | null }>, pos: number) => {
        const { data: round, error } = await supabase
          .from('bracket_rounds').insert({ name: roundName, position: pos }).select().single()
        if (error) throw error
        const slotsData = slotPairs.map((p, i) => ({
          round_id: round.id, position: i,
          home_id: p.home, away_id: p.away,
          home_score: 0, away_score: 0, played: false,
        }))
        const { error: se } = await supabase.from('bracket_slots').insert(slotsData)
        if (se) throw se
      }

      if (format === 'sf') {
        // Semifinále: A1 vs B2, B1 vs A2  (cross-seeding)
        await createRound('Semifinále', [
          { home: fill(A, 0), away: fill(B, 1) },
          { home: fill(B, 0), away: fill(A, 1) },
        ], 0)
        await createRound('O 3. místo', [{ home: null, away: null }], 1)
        await createRound('Finále',     [{ home: null, away: null }], 2)
      } else {
        // Čtvrtfinále (8 teams): A1 vs B4, B2 vs A3, B1 vs A4, A2 vs B3
        await createRound('Čtvrtfinále', [
          { home: fill(A, 0), away: fill(B, 3) },
          { home: fill(B, 1), away: fill(A, 2) },
          { home: fill(B, 0), away: fill(A, 3) },
          { home: fill(A, 1), away: fill(B, 2) },
        ], 0)
        await createRound('Semifinále',  [{ home: null, away: null }, { home: null, away: null }], 1)
        await createRound('O 3. místo',  [{ home: null, away: null }], 2)
        await createRound('Finále',      [{ home: null, away: null }], 3)
      }

      showToast('Playoff vygenerován ✓')
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

    // ── Auto-advance winner to next round ─────────────────────────────
    // Only when: result is decisive (no draw), slot has both teams assigned
    const isDecisive = data.played && data.home_score !== data.away_score
    const hasBothTeams = data.home_id && data.away_id
    if (!isDecisive || !hasBothTeams) { showToast('Uloženo ✓'); return }

    const slot = bracketSlots.find(s => s.id === slotId)
    const currentRound = slot ? bracketRounds.find(r => r.id === slot.round_id) : null
    if (!slot || !currentRound) { showToast('Uloženo ✓'); return }

    const maxPos = Math.max(...bracketRounds.map(r => r.position))
    // Don't advance from 3rd place or final
    if (currentRound.position >= maxPos - 1) { showToast('Uloženo ✓'); return }

    const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
    const winner = homeWins ? data.home_id! : data.away_id!
    const loser  = homeWins ? data.away_id! : data.home_id!
    const isEven = slot.position % 2 === 0

    const slotsOf = (roundId: string) =>
      [...bracketSlots].filter(s => s.round_id === roundId).sort((a, b) => a.position - b.position)

    const isSemifinal = currentRound.position === maxPos - 2

    if (isSemifinal) {
      // Winner → Final (maxPos), Loser → O 3. místo (maxPos - 1)
      const finalRound  = bracketRounds.find(r => r.position === maxPos)
      const thirdRound  = bracketRounds.find(r => r.position === maxPos - 1)
      const finalSlots  = finalRound  ? slotsOf(finalRound.id)  : []
      const thirdSlots  = thirdRound  ? slotsOf(thirdRound.id)  : []
      const finalSlot   = finalSlots[0]
      const thirdSlot   = thirdSlots[0]
      const field = isEven ? 'home_id' : 'away_id'

      const ops: Promise<unknown>[] = []
      if (finalSlot && !finalSlot[field])
        ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', finalSlot.id))
      if (thirdSlot && !thirdSlot[field])
        ops.push(supabase.from('bracket_slots').update({ [field]: loser }).eq('id', thirdSlot.id))

      await Promise.all(ops)
      showToast('Uloženo ✓ — vítěz postoupil do finále')
    } else {
      // Earlier round: winner → next round slot floor(S/2), home if even, away if odd
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
      {/* Auto-generate section */}
      <div className="info-box" style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '.35rem', fontSize: '.82rem' }}>🏆 Automatické generování playoff</div>
        <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '.6rem' }}>
          Na základě tabulek skupin automaticky vytvoří pavouk:<br />
          <strong>≤ 10 týmů:</strong> 2 skupiny, top 2 → Semifinále → O 3. místo + Finále<br />
          <strong>≥ 11 týmů:</strong> 2 skupiny, top 4 → Čtvrtfinále → Semifinále → O 3. místo + Finále
        </div>
        <button className="btn btn-s" onClick={generatePlayoff} disabled={generating}>
          {generating ? 'Generuji…' : '⚡ Generovat playoff'}
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
      <button className="btn btn-s" onClick={addRound}>+ Přidat kolo</button>

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
              <button className="btn btn-d btn-sm" onClick={() => removeRound(round.id)}>Smazat kolo</button>
            </div>
            {rSlots.map(slot => (
              <SlotEditor key={slot.id} slot={slot} teams={teams}
                onSave={data => saveSlot(slot.id, data)} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
