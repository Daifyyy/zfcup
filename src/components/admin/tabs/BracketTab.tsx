import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'

interface Props {
  teams: Team[]
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

export default function BracketTab({ teams, bracketRounds, bracketSlots, showToast }: Props) {
  const [name, setName] = useState('')
  const [slotCount, setSlotCount] = useState('2')

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
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Uloženo ✓')
  }

  const sorted = [...bracketRounds].sort((a, b) => a.position - b.position)

  return (
    <div>
      <p style={{ fontSize: '.79rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
        Přidávej kola v pořadí: Čtvrtfinále → Semifinále → Finále.
      </p>
      <div className="sub-title">Přidat kolo</div>
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
