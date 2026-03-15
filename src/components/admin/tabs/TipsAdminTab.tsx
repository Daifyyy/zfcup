import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTipsters } from '../../../hooks/useTipsters'
import type { Team } from '../../../hooks/useTeams'
import type { Group } from '../../../hooks/useGroups'

interface Props {
  showToast: (msg: string) => void
  teams: Team[]
  groups: Group[]
}

// Points per special tip type
const SPECIAL_POINTS: Record<string, number> = {
  tournament_winner: 10,
  group_winner: 5,
  group_last: 3,
}

function getPoints(tipType: string): number {
  if (tipType === 'tournament_winner') return SPECIAL_POINTS.tournament_winner
  if (tipType.startsWith('group_winner:')) return SPECIAL_POINTS.group_winner
  if (tipType.startsWith('group_last:')) return SPECIAL_POINTS.group_last
  return 0
}

async function recalcTipsterPoints() {
  const { data: tipsters } = await supabase.from('tipsters').select('id')
  if (!tipsters) return
  for (const tipster of tipsters) {
    const [{ data: tips }, { data: bTips }, { data: sTips }] = await Promise.all([
      supabase.from('tips').select('points_earned').eq('tipster_id', tipster.id),
      supabase.from('bracket_tips').select('points_earned').eq('tipster_id', tipster.id),
      supabase.from('special_tips').select('points_earned').eq('tipster_id', tipster.id),
    ])
    const total =
      (tips ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
      (bTips ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
      (sTips ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0)
    await supabase.from('tipsters').update({ total_points: total }).eq('id', tipster.id)
  }
}

// Re-evaluate all tips from scratch based on current match/slot results
async function recalcAllTips() {
  // --- Group match tips (3 exact / 1 correct outcome) ---
  const { data: playedMatches } = await supabase
    .from('matches').select('id, home_score, away_score').eq('played', true)
  if (playedMatches?.length) {
    const { data: allTips } = await supabase
      .from('tips').select('id, match_id, predicted_home, predicted_away')
      .in('match_id', playedMatches.map(m => m.id))
    for (const tip of allTips ?? []) {
      const m = playedMatches.find(m => m.id === tip.match_id)
      if (!m) continue
      let pts = 0
      if (tip.predicted_home === m.home_score && tip.predicted_away === m.away_score) {
        pts = 3
      } else if (Math.sign(tip.predicted_home - tip.predicted_away) === Math.sign(m.home_score - m.away_score)) {
        pts = 1
      }
      await supabase.from('tips').update({ points_earned: pts, evaluated: true }).eq('id', tip.id)
    }
  }

  // --- Bracket tips (final: 8 exact / 3 correct, other: 5 exact / 2 correct) ---
  const { data: playedSlots } = await supabase
    .from('bracket_slots').select('id, round_id, home_score, away_score').eq('played', true)
  if (playedSlots?.length) {
    const roundIds = [...new Set(playedSlots.map(s => s.round_id))]
    const { data: rounds } = await supabase
      .from('bracket_rounds').select('id, name, position').in('id', roundIds)
    const maxPos = Math.max(...(rounds ?? []).map(r => r.position))
    const isFinal = (roundId: string) => {
      const r = rounds?.find(r => r.id === roundId)
      return r?.position === maxPos && !/3|třet|bronze/i.test(r.name ?? '')
    }
    const { data: allBTips } = await supabase
      .from('bracket_tips').select('id, slot_id, predicted_home, predicted_away')
      .in('slot_id', playedSlots.map(s => s.id))
    for (const tip of allBTips ?? []) {
      const s = playedSlots.find(s => s.id === tip.slot_id)
      if (!s) continue
      const fin = isFinal(s.round_id)
      let pts = 0
      if (tip.predicted_home === s.home_score && tip.predicted_away === s.away_score) {
        pts = fin ? 8 : 5
      } else if (Math.sign(tip.predicted_home - tip.predicted_away) === Math.sign(s.home_score - s.away_score)) {
        pts = fin ? 3 : 2
      }
      await supabase.from('bracket_tips').update({ points_earned: pts, evaluated: true }).eq('id', tip.id)
    }
  }

  await recalcTipsterPoints()
}

// ── Special tip evaluation row ─────────────────────────────────────────────────

function EvalRow({ tipType, label, teamPool, showToast }: {
  tipType: string
  label: string
  teamPool: Team[]
  showToast: (m: string) => void
}) {
  const [selected, setSelected] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [done, setDone] = useState(false)
  const pts = getPoints(tipType)

  const evaluate = async () => {
    if (!selected) { showToast('Vyber tým'); return }
    setEvaluating(true)

    // Fetch all special_tips of this type
    const { data: allTips } = await supabase
      .from('special_tips').select('id, predicted_team_id').eq('tip_type', tipType)

    if (allTips && allTips.length > 0) {
      for (const t of allTips) {
        const earned = t.predicted_team_id === selected ? pts : 0
        await supabase.from('special_tips')
          .update({ evaluated: true, points_earned: earned })
          .eq('id', t.id)
      }
    }

    await recalcTipsterPoints()
    setEvaluating(false)
    setDone(true)
    showToast(`${label} vyhodnoceno ✓`)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '.6rem',
      padding: '.6rem .9rem', borderBottom: '1px solid var(--border)',
      background: done ? 'rgba(22,163,74,.04)' : 'transparent',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '.67rem', color: 'var(--muted)' }}>{pts} b. za správný tip</div>
      </div>
      {done ? (
        <span style={{ fontSize: '.78rem', color: 'var(--success)', fontWeight: 600 }}>
          ✓ Vyhodnoceno
        </span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
          <select
            className="field-input field-select"
            style={{ width: 'auto', minWidth: 130, fontSize: '.78rem', padding: '.3rem .5rem' }}
            value={selected}
            onChange={e => setSelected(e.target.value)}
          >
            <option value="">— správný tým —</option>
            {teamPool.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-s btn-sm"
            onClick={evaluate}
            style={{ opacity: evaluating ? .6 : 1, whiteSpace: 'nowrap' }}
          >
            {evaluating ? '…' : 'Vyhodnotit'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TipsAdminTab({ showToast, teams, groups }: Props) {
  const { tipsters } = useTipsters()
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const [recalcing, setRecalcing] = useState(false)

  const handleRecalcAll = async () => {
    setRecalcing(true)
    await recalcAllTips()
    setRecalcing(false)
    showToast('Body přepočítány ✓')
  }

  const resetAll = async () => {
    if (!confirm('Smazat všechny tipy a vynulovat body? Tuto akci nelze vrátit.')) return
    await supabase.from('tips').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('bracket_tips').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('special_tips').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('tipsters').update({ total_points: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
    showToast('Tipy resetovány')
  }

  const deleteTipster = async (id: string, name: string) => {
    if (!confirm(`Smazat tipéra "${name}" včetně jeho tipů?`)) return
    await supabase.from('tips').delete().eq('tipster_id', id)
    await supabase.from('bracket_tips').delete().eq('tipster_id', id)
    await supabase.from('special_tips').delete().eq('tipster_id', id)
    await supabase.from('tipsters').delete().eq('id', id)
    showToast('Tipér smazán')
  }

  return (
    <div>
      {/* Tipsters list */}
      <div className="sub-title">Tipéři ({tipsters.length})</div>

      {!tipsters.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '1rem' }}>Zatím žádní tipéři.</p>
      ) : (
        <div className="a-list" style={{ marginBottom: '1.4rem' }}>
          {tipsters.map((t, i) => (
            <div key={t.id} className="a-item">
              <span style={{ fontSize: '.72rem', color: 'var(--muted)', width: 20, flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
              <span className="a-item-main" style={{ fontSize: '.85rem' }}>{t.name}</span>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem',
                color: 'var(--accent)', flexShrink: 0, marginRight: '.2rem',
              }}>{t.total_points} b.</span>
              <button type="button" className="btn btn-d btn-sm" onClick={() => deleteTipster(t.id, t.name)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Special tips evaluation */}
      <hr className="divider" />
      <div className="sub-title">Vyhodnocení speciálních tipů</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.8rem' }}>
        Vyber správný tým pro každý speciální tip. Body se automaticky přidělí tipérům a aktualizuje se žebříček.
      </p>

      <div className="card" style={{ overflow: 'hidden', marginBottom: '1.4rem' }}>
        <EvalRow
          tipType="tournament_winner"
          label="🏆 Vítěz turnaje"
          teamPool={teams}
          showToast={showToast}
        />
        {sortedGroups.map(g => {
          const groupTeams = teams.filter(t => g.team_ids.includes(t.id))
          return (
            <div key={g.id}>
              <EvalRow
                tipType={`group_winner:${g.id}`}
                label={`🥇 Vítěz skupiny ${g.name}`}
                teamPool={groupTeams}
                showToast={showToast}
              />
              <EvalRow
                tipType={`group_last:${g.id}`}
                label={`⬇️ Poslední skupiny ${g.name}`}
                teamPool={groupTeams}
                showToast={showToast}
              />
            </div>
          )
        })}
      </div>

      {/* Manual recalc */}
      <hr className="divider" />
      <div className="sub-title">Přepočet bodů</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Přepočítá body za všechny skupinové i playoff tipy podle aktuálních výsledků zápasů. Použij po opravě chybného výsledku.
      </p>
      <button type="button" className="btn btn-s" onClick={handleRecalcAll} style={{ opacity: recalcing ? .6 : 1 }}>
        {recalcing ? 'Přepočítávám…' : '🔄 Přepočítat tipy ze zápasů'}
      </button>

      {/* Danger zone */}
      <hr className="divider" />
      <div className="sub-title">Nebezpečná zóna</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Smaže všechny tipy (skupiny, playoff, speciální) a vynuluje body všem tipérům. Účty tipérů zůstanou.
      </p>
      <button type="button" className="btn btn-d" onClick={resetAll}>
        🗑 Resetovat tipy
      </button>
    </div>
  )
}
