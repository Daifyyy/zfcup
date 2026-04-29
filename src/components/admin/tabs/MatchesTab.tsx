import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import type { Match } from '../../../hooks/useMatches'
import type { Goal } from '../../../hooks/useGoals'
import type { Group } from '../../../hooks/useGroups'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'
import type { Tournament } from '../../../hooks/useTournament'
import type { Referee } from '../../../hooks/useReferees'
import { calcGroupStandings } from '../../../lib/standings'
import { exportSchedule, exportRefCards } from '../../../lib/exportExcel'

interface Props {
  teams: Team[]
  players: Player[]
  matches: Match[]
  goals: Goal[]
  groups: Group[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  tournament: Tournament | null
  referees?: Referee[]
  refetchMatches: () => void
  refetchGoals: () => void
  showToast: (msg: string) => void
}

interface MatchForm {
  round: string
  home_id: string
  away_id: string
  home_score: string
  away_score: string
  played: boolean
  scheduled_time: string
}

const DEF_FORM: MatchForm = { round: '', home_id: '', away_id: '', home_score: '0', away_score: '0', played: false, scheduled_time: '' }

// ── Inline editor: skóre + góly v jednom panelu ────────────────────────────
function InlineMatchEditor({
  match, teams, players, goals, referees, showToast, onClose, refetchMatches, refetchGoals,
}: {
  match: Match
  teams: Team[]
  players: Player[]
  goals: Goal[]
  referees: Referee[]
  showToast: (m: string) => void
  onClose: () => void
  refetchMatches: () => void
  refetchGoals: () => void
}) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? 0)
  const [awayScore, setAwayScore] = useState(match.away_score ?? 0)
  const [played, setPlayed] = useState(Boolean(match.played))
  const [scheduledTime, setScheduledTime] = useState(match.scheduled_time || '')
  const [refereeId, setRefereeId] = useState<string>(match.referee_id ?? '')
  const [saving, setSaving] = useState(false)

  const homePlayers = players.filter(p => p.team_id === match.home_id).sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const awayPlayers = players.filter(p => p.team_id === match.away_id).sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const allPlayers = [...homePlayers, ...awayPlayers]

  const initCounts = () => {
    const c: Record<string, number> = {}
    for (const p of allPlayers) {
      const g = goals.find(g => g.player_id === p.id && g.match_id === match.id)
      c[p.id] = g?.count ?? 0
    }
    return c
  }
  const [counts, setCounts] = useState<Record<string, number>>(initCounts)

  const changeGoal = (pid: string, delta: number) =>
    setCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))

  const changeScore = (side: 'home' | 'away', delta: number) => {
    if (side === 'home') {
      const next = Math.max(0, homeScore + delta)
      setHomeScore(next)
      if (next > 0) setPlayed(true)
    } else {
      const next = Math.max(0, awayScore + delta)
      setAwayScore(next)
      if (next > 0) setPlayed(true)
    }
  }

  const saveAll = async () => {
    setSaving(true)
    const autoPlayed = played || homeScore > 0 || awayScore > 0

    // 1) Uložit skóre zápasu
    const { error: matchErr } = await supabase.from('matches').update({
      home_score: homeScore,
      away_score: awayScore,
      played: autoPlayed,
      scheduled_time: scheduledTime || '',
      round: match.round || '',
      referee_id: refereeId || null,
    }).eq('id', match.id)

    if (matchErr) { showToast('Chyba skóre: ' + matchErr.message); setSaving(false); return }

    // 2) Uložit góly hráčů
    for (const [player_id, count] of Object.entries(counts)) {
      if (count > 0) {
        const { error } = await supabase.from('goals').upsert(
          { player_id, match_id: match.id, count },
          { onConflict: 'player_id,match_id' }
        )
        if (error) { showToast('Chyba gólů: ' + error.message); setSaving(false); return }
      } else {
        await supabase.from('goals').delete().match({ player_id, match_id: match.id })
      }
    }

    refetchMatches()
    refetchGoals()
    showToast('Uloženo ✓')
    setSaving(false)
    onClose()
  }

  const ht = teams.find(t => t.id === match.home_id)
  const at = teams.find(t => t.id === match.away_id)

  const PlayerRow = ({ p, color }: { p: Player; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.38rem 0', borderBottom: '1px solid var(--border)' }}>
      <span className="team-dot" style={{ background: color }} />
      <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button type="button" onClick={() => changeGoal(p.id, -1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--muted)' }}>−</button>
        <span style={{ width: 28, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: counts[p.id] > 0 ? 'var(--accent)' : 'var(--muted)' }}>
          {counts[p.id] ?? 0}
        </span>
        <button type="button" onClick={() => changeGoal(p.id, +1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--accent)' }}>+</button>
      </div>
    </div>
  )

  const scoreBtn = (variant: 'minus' | 'plus') => ({
    width: 36, height: 36, borderRadius: 7, cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700,
    border: variant === 'plus' ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: variant === 'plus' ? 'var(--accent-dim)' : '#f8fafc',
    color: variant === 'plus' ? 'var(--accent)' : 'var(--muted)',
    flexShrink: 0,
  } as React.CSSProperties)

  return (
    <div style={{ padding: '.75rem .85rem .85rem', borderTop: '2px solid rgba(37,99,235,.15)', background: 'var(--accent-dim)' }}>

      {/* Skóre — každý tým na vlastním řádku */}
      <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.55rem' }}>
        📝 Skóre zápasu
      </div>

      {/* Domácí */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.3rem' }}>
        <span className="team-dot" style={{ background: ht?.color ?? '#94a3b8', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {ht?.name ?? '—'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button" style={scoreBtn('minus')} onClick={() => changeScore('home', -1)}>−</button>
          <span style={{ width: 38, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>
            {homeScore}
          </span>
          <button type="button" style={scoreBtn('plus')} onClick={() => changeScore('home', +1)}>+</button>
        </div>
      </div>

      {/* Hostující */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.6rem' }}>
        <span className="team-dot" style={{ background: at?.color ?? '#94a3b8', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {at?.name ?? '—'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button" style={scoreBtn('minus')} onClick={() => changeScore('away', -1)}>−</button>
          <span style={{ width: 38, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>
            {awayScore}
          </span>
          <button type="button" style={scoreBtn('plus')} onClick={() => changeScore('away', +1)}>+</button>
        </div>
      </div>

      {/* Odehrán + čas — jeden řádek */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.65rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer', fontSize: '.82rem' }}>
          <input type="checkbox" checked={played} onChange={e => setPlayed(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
          Odehrán {played && <span style={{ color: 'var(--success)' }}>✓</span>}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>🕐</span>
          <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
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

      {/* Góly hráčů */}
      <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.5rem' }}>
        ⚽ Góly hráčů
      </div>
      {allPlayers.length === 0 ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.65rem' }}>
          Hráči nejsou zadáni. Přidej je v záložce Týmy → Soupiska.
        </p>
      ) : (
        <div style={{ marginBottom: '.75rem' }}>
          {ht && homePlayers.length > 0 && (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.15rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="team-dot" style={{ background: ht.color }} />{ht.name}
            </div>
          )}
          {homePlayers.map(p => <PlayerRow key={p.id} p={p} color={ht?.color ?? '#94a3b8'} />)}
          {at && awayPlayers.length > 0 && (
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.55rem', marginBottom: '.15rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="team-dot" style={{ background: at.color }} />{at.name}
            </div>
          )}
          {awayPlayers.map(p => <PlayerRow key={p.id} p={p} color={at?.color ?? '#94a3b8'} />)}
        </div>
      )}

      <div style={{ display: 'flex', gap: '.4rem' }}>
        <button type="button" className="btn btn-p btn-sm" onClick={saveAll}>
          {saving ? 'Ukládám…' : '💾 Uložit vše'}
        </button>
        <button type="button" className="btn btn-d btn-sm" onClick={onClose}>Zavřít</button>
      </div>
    </div>
  )
}

export default function MatchesTab({ teams, players, matches, goals, groups, bracketRounds, bracketSlots, tournament, referees = [], refetchMatches, refetchGoals, showToast }: Props) {
  const [form, setForm] = useState<MatchForm>(DEF_FORM)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const isLeague = tournament?.format === 'league'
  const groupMatches = matches.filter(m => groups.some(g => g.id === m.group_id))
  const allGroupsComplete = groupMatches.length > 0 && groupMatches.every(m => m.played)
  const hasBracket = bracketRounds.length > 0

  const seedPlayoff = async () => {
    if (!allGroupsComplete) { showToast('Nejdříve dohraj všechny zápasy'); return }
    if (!hasBracket) { showToast('Nejdříve vytvoř strukturu playoff v záložce Play-off'); return }
    if (!confirm('Nasadit týmy do playoff dle tabulky?')) return

    setSeeding(true)
    try {
      const fill = (arr: string[], i: number): string | null => arr[i] ?? null
      const slotsOf = (roundId: string) =>
        [...bracketSlots].filter(s => s.round_id === roundId).sort((a, b) => a.position - b.position)
      const firstRound = [...bracketRounds].sort((a, b) => a.position - b.position)[0]
      const firstSlots = slotsOf(firstRound.id)

      if (isLeague) {
        const ligaGroup = groups.find(g => g.name === 'Liga')
        if (!ligaGroup) { showToast('Skupinu "Liga" nenalezena'); return }
        const standings = calcGroupStandings(ligaGroup, matches).slice(0, 6).map(r => r.id)
        const qfPairs = [
          { home: fill(standings, 2), away: fill(standings, 5) },
          { home: fill(standings, 3), away: fill(standings, 4) },
        ]
        for (let i = 0; i < qfPairs.length; i++) {
          const slot = firstSlots[i]
          if (!slot) continue
          await supabase.from('bracket_slots').update({ home_id: qfPairs[i].home, away_id: qfPairs[i].away }).eq('id', slot.id)
        }
        const sfRound = [...bracketRounds].sort((a, b) => a.position - b.position)[1]
        if (sfRound) {
          const sfSlots = slotsOf(sfRound.id)
          const sfSeeds = [fill(standings, 1), fill(standings, 0)]
          for (let i = 0; i < sfSeeds.length; i++) {
            const slot = sfSlots[i]
            if (!slot) continue
            await supabase.from('bracket_slots').update({ home_id: sfSeeds[i], away_id: null }).eq('id', slot.id)
          }
        }
      } else {
        const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
        const isSingle = groups.length === 1
        if (isSingle) {
          const standings = calcGroupStandings(groups[0], matches).slice(0, 4).map(r => r.id)
          const pairs = [
            { home: fill(standings, 0), away: fill(standings, 3) },
            { home: fill(standings, 1), away: fill(standings, 2) },
          ]
          for (let i = 0; i < pairs.length; i++) {
            const slot = firstSlots[i]; if (!slot) continue
            await supabase.from('bracket_slots').update({ home_id: pairs[i].home, away_id: pairs[i].away }).eq('id', slot.id)
          }
        } else {
          const adv = teams.length <= 10 ? 2 : 4
          const grouped = sortedGroups.map(g => calcGroupStandings(g, matches).slice(0, adv).map(r => r.id))
          const A = grouped[0] ?? []; const B = grouped[1] ?? []
          const pairs = adv === 2
            ? [{ home: fill(A, 0), away: fill(B, 1) }, { home: fill(B, 0), away: fill(A, 1) }]
            : [{ home: fill(A, 0), away: fill(B, 3) }, { home: fill(B, 1), away: fill(A, 2) },
               { home: fill(B, 0), away: fill(A, 3) }, { home: fill(A, 1), away: fill(B, 2) }]
          for (let i = 0; i < pairs.length; i++) {
            const slot = firstSlots[i]; if (!slot) continue
            await supabase.from('bracket_slots').update({ home_id: pairs[i].home, away_id: pairs[i].away }).eq('id', slot.id)
          }
        }
      }
      showToast('Týmy nasazeny do playoff ✓')
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSeeding(false)
    }
  }

  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'

  const handleScore = (k: 'home_score' | 'away_score') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const num = parseInt(val) || 0
    setForm(p => ({ ...p, [k]: val, played: num > 0 ? true : p.played }))
  }

  const changeScore = (k: 'home_score' | 'away_score', delta: number) => {
    setForm(p => {
      const next = Math.max(0, (parseInt(p[k]) || 0) + delta)
      return { ...p, [k]: String(next), played: next > 0 ? true : p.played }
    })
  }

  const addMatch = async () => {
    if (!form.home_id || !form.away_id) { showToast('Vyberte oba týmy'); return }
    if (form.home_id === form.away_id) { showToast('Týmy musí být různé'); return }

    const homeScore = parseInt(form.home_score) || 0
    const awayScore = parseInt(form.away_score) || 0
    const played = form.played || homeScore > 0 || awayScore > 0

    const { error } = await supabase.from('matches').insert({
      round: form.round || '',
      home_id: form.home_id,
      away_id: form.away_id,
      home_score: homeScore,
      away_score: awayScore,
      played,
      scheduled_time: form.scheduled_time || '',
    })
    if (error) { showToast('Chyba: ' + error.message); return }
    refetchMatches()
    setForm(DEF_FORM)
    showToast('Zápas přidán ✓')
  }

  const removeMatch = async (id: string) => {
    if (!confirm('Smazat zápas?')) return
    await supabase.from('goals').delete().eq('match_id', id)
    const { error } = await supabase.from('matches').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else { if (inlineEditId === id) setInlineEditId(null); showToast('Smazáno') }
  }

  const f = (k: keyof MatchForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const roundsMap: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Bez skupiny'
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  }
  const roundEntries = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))

  return (
    <div>
      {/* Playoff nasazení — zobrazit pouze když existuje bracket struktura */}
      {hasBracket && (
        <div className={allGroupsComplete ? 'info-box' : 'warn-box'} style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: '.3rem' }}>🏆 Nasadit týmy do playoff</div>
          <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: '.55rem' }}>
            {allGroupsComplete
              ? `✅ Všechny zápasy odehrány — lze nasadit týmy${isLeague ? ' (top 6 do QF/SF)' : ''}.`
              : `⏳ Odehráno ${groupMatches.filter(m => m.played).length}/${groupMatches.length} zápasů.`}
          </div>
          <button type="button" className="btn btn-p" onClick={seedPlayoff}
            style={{ opacity: allGroupsComplete && !seeding ? 1 : 0.5 }}>
            {seeding ? 'Nasazuji…' : '🏆 Nasadit týmy'}
          </button>
        </div>
      )}

      {/* Export tlačítka */}
      {matches.length > 0 && (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-d btn-sm"
            onClick={() => exportSchedule(matches, groups, teams, tournament ? { match_duration: tournament.match_duration ?? 20, round_break: tournament.round_break ?? 5 } : undefined)}
          >
            📥 Exportovat rozpis (Excel)
          </button>
          <button
            type="button"
            className="btn btn-d btn-sm"
            onClick={() => exportRefCards(matches, groups, teams, players)}
          >
            📋 Karty rozhodčího (Excel)
          </button>
        </div>
      )}

      <div className="sub-title">Přehled zápasů</div>
      {!matches.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádné zápasy.</p>
      ) : (
        roundEntries.map(([round, ms]) => (
          <div key={round} style={{ marginBottom: '.9rem' }}>
            <div style={{
              fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.11em',
              color: 'var(--muted)', padding: '.3rem 0', marginBottom: '.3rem',
              borderBottom: '1px solid var(--border)', fontWeight: 600,
            }}>
              {round}
            </div>
            <div className="a-list">
              {ms.map(m => {
                const matchGoals = goals.filter(g => g.match_id === m.id)
                const totalGoals = matchGoals.reduce((s, g) => s + g.count, 0)
                const isOpen = inlineEditId === m.id
                return (
                  <div key={m.id} style={{ background: '#f8fafc', border: `1px solid ${isOpen ? 'rgba(37,99,235,.35)' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '.5rem .85rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div className="a-item-main" style={{ fontSize: '.8rem' }}>
                          {tn(m.home_id)} <span style={{ color: 'var(--muted)' }}>vs</span> {tn(m.away_id)}
                        </div>
                        <div className="a-item-sub">
                          {m.played ? (
                            <span style={{ color: 'var(--success)' }}>✓ {m.home_score}:{m.away_score}</span>
                          ) : 'Plánováno'}
                          {m.scheduled_time && <> · {m.scheduled_time}</>}
                          {totalGoals > 0 && <> · ⚽ {totalGoals} gólů</>}
                        </div>
                      </div>
                      <button type="button" className={`btn btn-sm ${isOpen ? 'btn-p' : 'btn-d'}`}
                        onClick={() => setInlineEditId(isOpen ? null : m.id)}>
                        {isOpen ? '✕ Zavřít' : '✎ Upravit'}
                      </button>
                      <button type="button" className="btn btn-d btn-sm" onClick={() => removeMatch(m.id)}>Smazat</button>
                    </div>
                    {isOpen && (
                      <InlineMatchEditor
                        match={m}
                        teams={teams}
                        players={players}
                        goals={goals}
                        referees={referees}
                        showToast={showToast}
                        onClose={() => setInlineEditId(null)}
                        refetchMatches={refetchMatches}
                        refetchGoals={refetchGoals}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <hr className="divider" />
      {/* Formulář — pouze přidání nového zápasu */}
      <div ref={formRef}>
        <div className="sub-title">Přidat zápas</div>
        <div className="field-group">
          <label className="field-label">Kolo / skupina</label>
          <input className="field-input" value={form.round} onChange={f('round')} placeholder="Skupina A, Semifinále…" />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Domácí tým</label>
            <select className="field-input field-select" value={form.home_id} onChange={f('home_id')}>
              <option value="">— Vyberte —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Hostující tým</label>
            <select className="field-input field-select" value={form.away_id} onChange={f('away_id')}>
              <option value="">— Vyberte —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row3">
          <div className="field-group">
            <label className="field-label">Skóre (domácí)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={() => changeScore('home_score', -1)}
                style={{ width: 34, height: 34, borderRadius: 7, border: '1px solid var(--border)', background: '#f8fafc', fontSize: '1.1rem', fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>−</button>
              <input className="field-input" type="number" min="0" value={form.home_score} onChange={handleScore('home_score')}
                style={{ width: 56, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem' }} />
              <button type="button" onClick={() => changeScore('home_score', +1)}
                style={{ width: 34, height: 34, borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--accent-dim)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div className="field-sep">:</div>
          <div className="field-group">
            <label className="field-label">Skóre (hosté)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={() => changeScore('away_score', -1)}
                style={{ width: 34, height: 34, borderRadius: 7, border: '1px solid var(--border)', background: '#f8fafc', fontSize: '1.1rem', fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>−</button>
              <input className="field-input" type="number" min="0" value={form.away_score} onChange={handleScore('away_score')}
                style={{ width: 56, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem' }} />
              <button type="button" onClick={() => changeScore('away_score', +1)}
                style={{ width: 34, height: 34, borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--accent-dim)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>+</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', marginBottom: '.85rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.82rem' }}>
            <input type="checkbox" checked={form.played} onChange={e => setForm(p => ({ ...p, played: e.target.checked }))}
              style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
            Zápas odehrán {form.played && <span style={{ color: 'var(--success)' }}>✓</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <label className="field-label" style={{ margin: 0 }}>Čas:</label>
            <input className="field-input" type="time" value={form.scheduled_time} onChange={f('scheduled_time')} style={{ width: 110 }} />
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-p" onClick={addMatch}>+ Přidat zápas</button>
        </div>
      </div>
    </div>
  )
}
