import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTipsters } from '../../../hooks/useTipsters'
import { calcGroupStandings } from '../../../lib/standings'
import type { Team } from '../../../hooks/useTeams'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { Tournament } from '../../../hooks/useTournament'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'
import TipsGuideModal from '../TipsGuideModal'

interface Props {
  showToast: (msg: string) => void
  tournament: Tournament | null
  teams: Team[]
  groups: Group[]
  matches: Match[]
  bracketSlots: BracketSlot[]
  bracketRounds: BracketRound[]
}

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

async function recalcAllTips() {
  // Skupinové zápasy: 3/1 b.
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
      if (tip.predicted_home === m.home_score && tip.predicted_away === m.away_score) pts = 3
      else if (Math.sign(tip.predicted_home - tip.predicted_away) === Math.sign(m.home_score - m.away_score)) pts = 1
      await supabase.from('tips').update({ points_earned: pts, evaluated: true }).eq('id', tip.id)
    }
  }

  // Playoff zápasy: 5/2 b. (všechna kola včetně finále)
  const { data: playedSlots } = await supabase
    .from('bracket_slots').select('id, home_score, away_score').eq('played', true)
  if (playedSlots?.length) {
    const { data: allBTips } = await supabase
      .from('bracket_tips').select('id, slot_id, predicted_home, predicted_away')
      .in('slot_id', playedSlots.map(s => s.id))
    for (const tip of allBTips ?? []) {
      const s = playedSlots.find(s => s.id === tip.slot_id)
      if (!s) continue
      let pts = 0
      if (tip.predicted_home === s.home_score && tip.predicted_away === s.away_score) pts = 5
      else if (Math.sign(tip.predicted_home - tip.predicted_away) === Math.sign(s.home_score - s.away_score)) pts = 2
      await supabase.from('bracket_tips').update({ points_earned: pts, evaluated: true }).eq('id', tip.id)
    }
  }

  await recalcTipsterPoints()
}

// Vyhodnotí jeden tip_type s daným správným týmem
async function evaluateSpecialTip(tipType: string, correctTeamId: string) {
  const pts = getPoints(tipType)
  const { data: allTips } = await supabase
    .from('special_tips').select('id, predicted_team_id').eq('tip_type', tipType)
  if (!allTips?.length) return
  for (const t of allTips) {
    const earned = t.predicted_team_id === correctTeamId ? pts : 0
    await supabase.from('special_tips')
      .update({ evaluated: true, points_earned: earned })
      .eq('id', t.id)
  }
}

// ── EvalRow: ruční override (nebo informační řádek po auto-vyhodnocení) ─────────
function EvalRow({ tipType, label, teamPool, showToast, autoWinnerId }: {
  tipType: string
  label: string
  teamPool: Team[]
  showToast: (m: string) => void
  autoWinnerId?: string | null
}) {
  const [selected, setSelected] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)
  const pts = getPoints(tipType)

  // Load current evaluated state from DB on mount
  useEffect(() => {
    supabase.from('special_tips')
      .select('id').eq('tip_type', tipType).eq('evaluated', true).limit(1)
      .then(({ data }) => { if (data && data.length > 0) setDone(true) })
  }, [tipType])

  // Sync done state when auto-winner is detected
  useEffect(() => {
    if (autoWinnerId) setDone(true)
  }, [autoWinnerId])

  const evaluate = async () => {
    if (!selected) { showToast('Vyber tým'); return }
    setEvaluating(true)
    await evaluateSpecialTip(tipType, selected)
    await recalcTipsterPoints()
    setEvaluating(false)
    setDone(true)
    showToast(`${label} vyhodnoceno ✓`)
  }

  const resetEval = async () => {
    if (!confirm(`Zrušit vyhodnocení "${label}"? Body za tento tip budou vymazány.`)) return
    setResetting(true)
    await supabase.from('special_tips')
      .update({ evaluated: false, points_earned: 0 })
      .eq('tip_type', tipType)
    await recalcTipsterPoints()
    setResetting(false)
    setDone(false)
    showToast('Vyhodnocení zrušeno ✓')
  }

  const autoTeam = autoWinnerId ? teamPool.find(t => t.id === autoWinnerId) : null

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.78rem', color: 'var(--success)', fontWeight: 600 }}>
              {autoTeam ? `✓ Auto: ${autoTeam.name}` : '✓ Vyhodnoceno'}
            </div>
          </div>
          <button type="button" className="btn btn-d btn-sm" onClick={resetEval}
            style={{ opacity: resetting ? .6 : 1 }}>
            {resetting ? '…' : 'Zrušit'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
          {autoWinnerId ? (
            <span style={{ fontSize: '.73rem', color: 'var(--accent)' }}>Vyhodnocuji…</span>
          ) : (
            <>
              <select
                className="field-input field-select"
                style={{ width: 'auto', minWidth: 130, fontSize: '.78rem', padding: '.3rem .5rem' }}
                value={selected}
                onChange={e => setSelected(e.target.value)}
              >
                <option value="">— správný tým —</option>
                {teamPool.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="button" className="btn btn-s btn-sm" onClick={evaluate}
                style={{ opacity: evaluating ? .6 : 1, whiteSpace: 'nowrap' }}>
                {evaluating ? '…' : 'Vyhodnotit'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stav auto-vyhodnocení skupiny ─────────────────────────────────────────────
type GroupEvalStatus = 'pending' | 'running' | 'done' | 'incomplete'

export default function TipsAdminTab({ showToast, tournament, teams, groups, matches, bracketSlots, bracketRounds }: Props) {
  const { tipsters } = useTipsters()
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const [recalcing, setRecalcing] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [groupStatus, setGroupStatus] = useState<Record<string, GroupEvalStatus>>({})
  const [groupWinners, setGroupWinners] = useState<Record<string, { winner: string; last: string }>>({})
  const autoRunRef = useRef(false)
  const tournamentAutoRunRef = useRef(false)
  // ID vítěze finále detekovaného automaticky
  const [autoTournamentWinnerId, setAutoTournamentWinnerId] = useState<string | null>(null)

  // Auto-vyhodnocení skupin při načtení / změně dat
  useEffect(() => {
    if (!groups.length || !matches.length) return
    if (autoRunRef.current) return
    autoRunRef.current = true

    const runAutoEval = async () => {
      let anyEvaluated = false

      for (const group of sortedGroups) {
        const groupMatches = matches.filter(m => m.group_id === group.id)
        if (!groupMatches.length || !groupMatches.every(m => m.played)) {
          setGroupStatus(s => ({ ...s, [group.id]: 'incomplete' }))
          continue
        }

        const rows = calcGroupStandings(group, matches)
        if (rows.length < 2) {
          setGroupStatus(s => ({ ...s, [group.id]: 'incomplete' }))
          continue
        }

        const winnerId = rows[0].id
        const lastId = rows[rows.length - 1].id
        const winnerName = teams.find(t => t.id === winnerId)?.name ?? '—'
        const lastName = teams.find(t => t.id === lastId)?.name ?? '—'

        setGroupStatus(s => ({ ...s, [group.id]: 'running' }))
        setGroupWinners(w => ({ ...w, [group.id]: { winner: winnerName, last: lastName } }))

        await evaluateSpecialTip(`group_winner:${group.id}`, winnerId)
        await evaluateSpecialTip(`group_last:${group.id}`, lastId)

        setGroupStatus(s => ({ ...s, [group.id]: 'done' }))
        anyEvaluated = true
      }

      if (anyEvaluated) {
        await recalcTipsterPoints()
        showToast('Skupinové tipy auto-vyhodnoceny ✓')
      }
    }

    runAutoEval()
  }, [groups.length, matches.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-vyhodnocení vítěze turnaje po odehrání finále
  useEffect(() => {
    if (!bracketSlots.length || !bracketRounds.length) return
    if (tournamentAutoRunRef.current) return

    const maxPos = Math.max(...bracketRounds.map(r => r.position))
    const finalRound = bracketRounds.find(r =>
      r.position === maxPos && !/3|třet|bronze/i.test(r.name)
    )
    if (!finalRound) return
    const finalSlot = bracketSlots.find(s => s.round_id === finalRound.id && s.played)
    if (!finalSlot || !finalSlot.home_id || !finalSlot.away_id) return
    if (finalSlot.home_score === finalSlot.away_score) return // remíza ve finále

    const winnerId = finalSlot.home_score > finalSlot.away_score
      ? finalSlot.home_id
      : finalSlot.away_id

    tournamentAutoRunRef.current = true
    setAutoTournamentWinnerId(winnerId)

    const run = async () => {
      await evaluateSpecialTip('tournament_winner', winnerId)
      await recalcTipsterPoints()
      showToast('Vítěz turnaje auto-vyhodnocen ✓')
    }
    run()
  }, [bracketSlots, bracketRounds]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecalcAll = async () => {
    setRecalcing(true)
    await recalcAllTips()
    setRecalcing(false)
    showToast('Body přepočítány ✓')
  }

  const resetAll = async () => {
    if (!confirm('Smazat všechny tipy a vynulovat body? Tuto akci nelze vrátit.')) return
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('tips').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('bracket_tips').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('special_tips').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('tipsters').update({ total_points: 0 }).neq('id', '00000000-0000-0000-0000-000000000000'),
    ])
    const err = r1.error ?? r2.error ?? r3.error ?? r4.error
    if (err) { showToast('Chyba reset: ' + err.message); return }
    autoRunRef.current = false
    tournamentAutoRunRef.current = false
    setAutoTournamentWinnerId(null)
    showToast('Tipy resetovány ✓')
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
      {/* Návod k tipovačce */}
      <div style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.2)', borderRadius: 10, padding: '.85rem 1rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '.8rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, marginBottom: '.15rem' }}>📋 Návod k tipovačce</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
            Vygeneruje leták s QR kódem a pravidly — vytiskni nebo ulož jako PDF a vyvěs na informační tabuli.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-p btn-sm"
          onClick={() => setShowGuide(true)}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          🖨️ Otevřít leták
        </button>
      </div>

      {showGuide && (
        <TipsGuideModal
          tournament={tournament}
          groups={groups}
          onClose={() => setShowGuide(false)}
        />
      )}

      {/* Vyhodnocení speciálních tipů */}
      <div className="sub-title">Vyhodnocení speciálních tipů</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.8rem' }}>
        Skupiny a vítěz turnaje se vyhodnotí automaticky. Ručním „Vyhodnotit" lze výsledek přepsat.
      </p>

      <div className="card" style={{ overflow: 'hidden', marginBottom: '1.4rem' }}>
        {/* Vítěz turnaje — auto po finále, ruční override */}
        <EvalRow
          tipType="tournament_winner"
          label="🏆 Vítěz turnaje"
          teamPool={teams}
          showToast={showToast}
          autoWinnerId={autoTournamentWinnerId}
        />

        {/* Skupiny — automaticky */}
        {sortedGroups.map(g => {
          const status = groupStatus[g.id] ?? 'pending'
          const info = groupWinners[g.id]
          const isLiga = g.name === 'Liga'
          return (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: '.6rem',
              padding: '.6rem .9rem', borderBottom: '1px solid var(--border)',
              background: status === 'done' ? 'rgba(22,163,74,.04)' : 'transparent',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{isLiga ? 'Ligová fáze' : `Skupina ${g.name}`}</div>
                <div style={{ fontSize: '.67rem', color: 'var(--muted)' }}>
                  🥇 vítěz 5 b. &nbsp;·&nbsp; ⬇️ poslední 3 b.
                </div>
              </div>
              {status === 'incomplete' && (
                <span style={{ fontSize: '.73rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                  Čeká na dokončení skupiny…
                </span>
              )}
              {status === 'pending' && (
                <span style={{ fontSize: '.73rem', color: 'var(--muted)' }}>…</span>
              )}
              {status === 'running' && (
                <span style={{ fontSize: '.73rem', color: 'var(--accent)' }}>Vyhodnocuji…</span>
              )}
              {status === 'done' && info && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '.75rem', color: '#15803d', fontWeight: 600 }}>
                    ✓ 🥇 {info.winner}
                  </div>
                  <div style={{ fontSize: '.75rem', color: '#15803d', fontWeight: 600 }}>
                    ✓ ⬇️ {info.last}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Přepočet bodů */}
      <hr className="divider" />
      <div className="sub-title">Přepočet bodů</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Přepočítá body za všechny skupinové i playoff tipy podle aktuálních výsledků zápasů. Použij po opravě chybného výsledku.
      </p>
      <button type="button" className="btn btn-s" onClick={handleRecalcAll} style={{ opacity: recalcing ? .6 : 1 }}>
        {recalcing ? 'Přepočítávám…' : '🔄 Přepočítat tipy ze zápasů'}
      </button>

      {/* Nebezpečná zóna */}
      <hr className="divider" />
      <div className="sub-title">Nebezpečná zóna</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Smaže všechny tipy (skupiny, playoff, speciální) a vynuluje body všem tipérům. Účty tipérů zůstanou.
      </p>
      <button type="button" className="btn btn-d" onClick={resetAll}>
        🗑 Resetovat tipy
      </button>

      {/* Tipéři — až dole */}
      <hr className="divider" />
      <div className="sub-title">Tipéři ({tipsters.length})</div>
      {!tipsters.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '1rem' }}>Zatím žádní tipéři.</p>
      ) : (
        <div className="a-list" style={{ marginBottom: '1rem' }}>
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
    </div>
  )
}
