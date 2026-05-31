import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTipsters } from '../../../hooks/useTipsters'
import { calcGroupStandings } from '../../../lib/standings'
import { evaluateSpecialTip, evaluateSpecialTipPlayer, recalcTipsterPoints, checkTopScorer } from '../../../lib/tipsEval'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { Tournament } from '../../../hooks/useTournament'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'
import TipsGuideModal from '../TipsGuideModal'

interface Props {
  showToast: (msg: string) => void
  tournament: Tournament | null
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  bracketSlots: BracketSlot[]
  bracketRounds: BracketRound[]
}

function getPoints(tipType: string): number {
  if (tipType === 'tournament_winner' || tipType === 'top_scorer') return 10
  if (tipType.startsWith('group_winner:') || tipType === 'most_goals_team') return 5
  if (tipType.startsWith('group_last:')) return 3
  return 0
}

async function recalcAllTips(showToast: (m: string) => void, tournamentId: string) {
  try {
    // Skupinové zápasy: 3/1/0 b. — batch UPDATE dle bodů (N tipů → 3 volání)
    const { data: playedMatches, error: mErr } = await supabase
      .from('matches').select('id, home_score, away_score').eq('played', true).eq('tournament_id', tournamentId)
    if (mErr) throw mErr
    if (playedMatches?.length) {
      const { data: allTips, error: tErr } = await supabase
        .from('tips').select('id, match_id, predicted_home, predicted_away')
        .in('match_id', playedMatches.map(m => m.id))
      if (tErr) throw tErr
      const byPts = new Map<number, string[]>([[3, []], [1, []], [0, []]])
      for (const tip of allTips ?? []) {
        const m = playedMatches.find(m => m.id === tip.match_id)
        if (!m) continue
        let pts = 0
        if (tip.predicted_home === m.home_score && tip.predicted_away === m.away_score) pts = 3
        else if (Math.sign(tip.predicted_home - tip.predicted_away) === Math.sign(m.home_score - m.away_score)) pts = 1
        byPts.get(pts)!.push(tip.id)
      }
      const tipOps = [...byPts.entries()]
        .filter(([, ids]) => ids.length > 0)
        .map(([pts, ids]) => supabase.from('tips').update({ points_earned: pts, evaluated: true }).in('id', ids))
      const tipResults = await Promise.all(tipOps)
      const tipErr = tipResults.find(r => r.error)?.error
      if (tipErr) throw tipErr
    }

    // Playoff zápasy: 5/2/0 b. — batch UPDATE dle bodů
    const { data: playedSlots, error: sErr } = await supabase
      .from('bracket_slots').select('id, home_score, away_score').eq('played', true).eq('tournament_id', tournamentId)
    if (sErr) throw sErr
    if (playedSlots?.length) {
      const { data: allBTips, error: btErr } = await supabase
        .from('bracket_tips').select('id, slot_id, predicted_home, predicted_away')
        .in('slot_id', playedSlots.map(s => s.id))
      if (btErr) throw btErr
      const byPts = new Map<number, string[]>([[5, []], [2, []], [0, []]])
      for (const tip of allBTips ?? []) {
        const s = playedSlots.find(s => s.id === tip.slot_id)
        if (!s) continue
        let pts = 0
        if (tip.predicted_home === s.home_score && tip.predicted_away === s.away_score) pts = 5
        else if (Math.sign(tip.predicted_home - tip.predicted_away) === Math.sign(s.home_score - s.away_score)) pts = 2
        byPts.get(pts)!.push(tip.id)
      }
      const btOps = [...byPts.entries()]
        .filter(([, ids]) => ids.length > 0)
        .map(([pts, ids]) => supabase.from('bracket_tips').update({ points_earned: pts, evaluated: true }).in('id', ids))
      const btResults = await Promise.all(btOps)
      const btErr2 = btResults.find(r => r.error)?.error
      if (btErr2) throw btErr2
    }

    await recalcTipsterPoints(tournamentId)
    showToast('Body přepočítány ✓')
  } catch (e: unknown) {
    showToast('Chyba přepočtu: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ── EvalRow: ruční override (nebo informační řádek po auto-vyhodnocení) ─────────
function EvalRow({ tipType, label, teamPool, showToast, autoWinnerId, tournamentId }: {
  tipType: string
  label: string
  teamPool: Team[]
  showToast: (m: string) => void
  autoWinnerId?: string | null
  tournamentId: string
}) {
  const [selected, setSelected] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)
  const pts = getPoints(tipType)

  // Load current evaluated state from DB on mount
  useEffect(() => {
    supabase.from('special_tips')
      .select('id').eq('tip_type', tipType).eq('tournament_id', tournamentId).eq('evaluated', true).limit(1)
      .then(({ data }) => { if (data && data.length > 0) setDone(true) })
  }, [tipType, tournamentId])

  // Sync done state when auto-winner is detected
  useEffect(() => {
    if (autoWinnerId) setDone(true)
  }, [autoWinnerId])

  const evaluate = async () => {
    if (!selected) { showToast('Vyber tým'); return }
    setEvaluating(true)
    try {
      await evaluateSpecialTip(tipType, selected, tournamentId)
      await recalcTipsterPoints(tournamentId)
      setDone(true)
      showToast(`${label} vyhodnoceno ✓`)
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setEvaluating(false)
    }
  }

  const resetEval = async () => {
    if (!confirm(`Zrušit vyhodnocení "${label}"? Body za tento tip budou vymazány.`)) return
    setResetting(true)
    try {
      await supabase.from('special_tips')
        .update({ evaluated: false, points_earned: 0 })
        .eq('tip_type', tipType).eq('tournament_id', tournamentId)
      await recalcTipsterPoints(tournamentId)
      setDone(false)
      showToast('Vyhodnocení zrušeno ✓')
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setResetting(false)
    }
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

// ── EvalRowPlayer: ruční vyhodnocení hráčského tipu (top_scorer) ─────────────
function EvalRowPlayer({ tipType, label, playerPool, showToast, tournamentId }: {
  tipType: string; label: string; playerPool: Player[]
  showToast: (m: string) => void
  tournamentId: string
}) {
  const [selected, setSelected] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)
  const pts = getPoints(tipType)

  useEffect(() => {
    supabase.from('special_tips')
      .select('id').eq('tip_type', tipType).eq('tournament_id', tournamentId).eq('evaluated', true).limit(1)
      .then(({ data }) => { if (data && data.length > 0) setDone(true) })
  }, [tipType, tournamentId])

  const evaluate = async () => {
    setEvaluating(true)
    try {
      if (tipType === 'top_scorer') {
        // Auto-detect: najde všechny hráče s max góly (ošetří ties)
        const changed = await checkTopScorer(tournamentId)
        if (!changed && selected) {
          // Fallback: manuální override pokud auto nenašlo žádné tipy
          await evaluateSpecialTipPlayer(tipType, [selected], pts, tournamentId)
          await recalcTipsterPoints(tournamentId)
        }
      } else {
        if (!selected) { showToast('Vyber hráče'); setEvaluating(false); return }
        await evaluateSpecialTipPlayer(tipType, [selected], pts, tournamentId)
        await recalcTipsterPoints(tournamentId)
      }
      setDone(true)
      showToast(`${label} vyhodnoceno ✓`)
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setEvaluating(false) }
  }

  const resetEval = async () => {
    if (!confirm(`Zrušit vyhodnocení "${label}"?`)) return
    setResetting(true)
    try {
      await supabase.from('special_tips').update({ evaluated: false, points_earned: 0 }).eq('tip_type', tipType).eq('tournament_id', tournamentId)
      await recalcTipsterPoints(tournamentId)
      setDone(false)
      showToast('Vyhodnocení zrušeno ✓')
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setResetting(false) }
  }

  const sortedPlayers = [...playerPool].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem .9rem', borderBottom: '1px solid var(--border)', background: done ? 'rgba(22,163,74,.04)' : 'transparent' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.8rem', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '.67rem', color: 'var(--muted)' }}>{pts} b. za správný tip</div>
      </div>
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
          <span style={{ fontSize: '.78rem', color: 'var(--success)', fontWeight: 600 }}>✓ Vyhodnoceno</span>
          <button type="button" className="btn btn-d btn-sm" onClick={resetEval} style={{ opacity: resetting ? .6 : 1 }}>
            {resetting ? '…' : 'Zrušit'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
          {tipType === 'top_scorer' ? (
            <span style={{ fontSize: '.7rem', color: 'var(--muted)', maxWidth: 160 }}>
              Auto-detekce z dat (zvládne remízy)
            </span>
          ) : (
            <select className="field-input field-select" style={{ width: 'auto', minWidth: 140, fontSize: '.78rem', padding: '.3rem .5rem' }}
              value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— správný hráč —</option>
              {sortedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-s btn-sm" onClick={evaluate} style={{ opacity: evaluating ? .6 : 1, whiteSpace: 'nowrap' }}>
            {evaluating ? '…' : 'Vyhodnotit'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Stav auto-vyhodnocení skupiny ─────────────────────────────────────────────
type GroupEvalStatus = 'pending' | 'running' | 'done' | 'incomplete'

export default function TipsAdminTab({ showToast, tournament, teams, players, groups, matches, bracketSlots, bracketRounds }: Props) {
  const { tipsters } = useTipsters(tournament.id)
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const [recalcing, setRecalcing] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [groupStatus, setGroupStatus] = useState<Record<string, GroupEvalStatus>>({})
  const [groupWinners, setGroupWinners] = useState<Record<string, { winner: string; last: string }>>({})
  // ID vítěze finále detekovaného automaticky
  const [autoTournamentWinnerId, setAutoTournamentWinnerId] = useState<string | null>(null)

  // Záložní auto-vyhodnocení skupin při načtení záložky Tipovačka
  useEffect(() => {
    if (!groups.length || !matches.length) return

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

        const changedW = await evaluateSpecialTip(`group_winner:${group.id}`, winnerId, tournament.id)
        const changedL = await evaluateSpecialTip(`group_last:${group.id}`, lastId, tournament.id)

        setGroupStatus(s => ({ ...s, [group.id]: 'done' }))
        if (changedW || changedL) anyEvaluated = true
      }

      if (anyEvaluated) {
        await recalcTipsterPoints(tournament.id)
        showToast('Skupinové tipy auto-vyhodnoceny ✓')
      }
    }

    runAutoEval().catch(e => showToast('Chyba auto-vyhodnocení: ' + String(e)))
  }, [groups.length, matches.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Záložní auto-vyhodnocení vítěze turnaje při načtení záložky Tipovačka
  useEffect(() => {
    if (!bracketSlots.length || !bracketRounds.length) return

    const maxPos = Math.max(...bracketRounds.map(r => r.position))
    const finalRound = bracketRounds.find(r =>
      r.position === maxPos && !/3|třet|bronze/i.test(r.name)
    )
    if (!finalRound) return
    const finalSlot = bracketSlots.find(s => s.round_id === finalRound.id && s.played)
    if (!finalSlot || !finalSlot.home_id || !finalSlot.away_id) return
    if (finalSlot.home_score === finalSlot.away_score) return

    const winnerId = finalSlot.home_score > finalSlot.away_score
      ? finalSlot.home_id
      : finalSlot.away_id

    setAutoTournamentWinnerId(winnerId)

    const run = async () => {
      const changed = await evaluateSpecialTip('tournament_winner', winnerId, tournament.id)
      if (changed) {
        await recalcTipsterPoints(tournament.id)
        showToast('Vítěz turnaje auto-vyhodnocen ✓')
      }
    }
    run()
  }, [bracketSlots, bracketRounds]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecalcAll = async () => {
    setRecalcing(true)
    await recalcAllTips(showToast, tournament.id)
    setRecalcing(false)
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
    setAutoTournamentWinnerId(null)
    setGroupStatus({})
    setGroupWinners({})
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
      {/* Workflow přehled */}
      <div style={{ background: 'rgba(0,0,0,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '.75rem 1rem', marginBottom: '1rem', fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.55 }}>
        <div style={{ fontWeight: 700, color: '#374151', marginBottom: '.3rem', fontSize: '.78rem' }}>ℹ️ Co je automatické a co ruční</div>
        <div style={{ marginBottom: '.4rem' }}>
          <span style={{ fontWeight: 600, color: '#15803d' }}>Automaticky</span> (bez zásahu):{' '}
          skupinové tipy po každém zápase · playoff tipy po každém slotu · Vítěz skupiny / Poslední při otevření této záložky
        </div>
        <div>
          <span style={{ fontWeight: 600, color: '#b45309' }}>Ručně</span> (tlačítkem níže):{' '}
          Nejlepší střelec · Tým s nejvíce góly · Vítěz turnaje (záloha) · Přepočet bodů po manuálních změnách
        </div>
      </div>

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
          tournamentId={tournament.id}
        />
        <EvalRow
          tipType="most_goals_team"
          label="⚽ Tým s nejvíce góly"
          teamPool={teams}
          showToast={showToast}
          tournamentId={tournament.id}
        />
        <EvalRowPlayer
          tipType="top_scorer"
          label="🏅 Nejlepší střelec"
          playerPool={players}
          showToast={showToast}
          tournamentId={tournament.id}
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
