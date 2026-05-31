import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import type { Match } from '../../../hooks/useMatches'
import type { Goal } from '../../../hooks/useGoals'
import type { Assist } from '../../../hooks/useAssists'
import type { Card } from '../../../hooks/useCards'
import type { Group } from '../../../hooks/useGroups'
import type { BracketRound, BracketSlot } from '../../../hooks/useBracket'
import type { Tournament } from '../../../hooks/useTournament'
import type { Referee } from '../../../hooks/useReferees'
import { calcGroupStandings } from '../../../lib/standings'
import { exportSchedule, exportRefCards } from '../../../lib/exportExcel'
import { checkGroupSpecialTips, checkLeagueTournamentWinner } from '../../../lib/tipsEval'

interface Props {
  teams: Team[]
  players: Player[]
  matches: Match[]
  goals: Goal[]
  assists: Assist[]
  cards: Card[]
  groups: Group[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  tournament: Tournament | null
  referees?: Referee[]
  refetchMatches: () => void
  refetchGoals: () => void
  refetchAssists: () => void
  refetchCards: () => void
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
  match, group, teams, players, goals, assists, cards, tournament, groups, referees,
  showToast, onClose, refetchMatches, refetchGoals, refetchAssists, refetchCards,
}: {
  match: Match
  group: Group | null
  teams: Team[]
  players: Player[]
  goals: Goal[]
  assists: Assist[]
  cards: Card[]
  tournament: Tournament | null
  groups: Group[]
  referees: Referee[]
  showToast: (m: string) => void
  onClose: () => void
  refetchMatches: () => void
  refetchGoals: () => void
  refetchAssists: () => void
  refetchCards: () => void
}) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? 0)
  const [awayScore, setAwayScore] = useState(match.away_score ?? 0)
  const [played, setPlayed] = useState(Boolean(match.played))
  const [scheduledTime, setScheduledTime] = useState(match.scheduled_time || '')
  const [refereeId, setRefereeId] = useState<string>(match.referee_id ?? '')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

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

  const initAssistCounts = () => {
    const c: Record<string, number> = {}
    for (const p of allPlayers) {
      const a = assists.find(a => a.player_id === p.id && a.match_id === match.id)
      c[p.id] = a?.count ?? 0
    }
    return c
  }
  const [assistCounts, setAssistCounts] = useState<Record<string, number>>(initAssistCounts)

  const initCardData = () => {
    const c: Record<string, { yellow: number; red: number }> = {}
    for (const p of allPlayers) {
      const card = cards.find(c => c.player_id === p.id && c.match_id === match.id)
      c[p.id] = {
        yellow: card?.type === 'yellow' ? 1 : card?.type === 'yellow_red' ? 2 : 0,
        red: card?.type === 'red' ? 1 : 0,
      }
    }
    return c
  }
  const [cardData, setCardData] = useState<Record<string, { yellow: number; red: number }>>(initCardData)

  const changeGoal = (pid: string, delta: number) =>
    setCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))

  const changeAssist = (pid: string, delta: number) =>
    setAssistCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))

  const changeYellow = (pid: string, delta: number) =>
    setCardData(c => {
      const cur = c[pid] ?? { yellow: 0, red: 0 }
      const next = Math.max(0, Math.min(2, cur.yellow + delta))
      return { ...c, [pid]: { ...cur, yellow: next, red: next === 2 ? 0 : cur.red } }
    })

  const toggleRed = (pid: string) =>
    setCardData(c => {
      const cur = c[pid] ?? { yellow: 0, red: 0 }
      return { ...c, [pid]: { ...cur, red: cur.red === 1 ? 0 : 1, yellow: cur.red === 0 ? 0 : cur.yellow } }
    })

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
    if (savingRef.current) return
    savingRef.current = true
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

    if (matchErr) { showToast('Chyba skóre: ' + matchErr.message); savingRef.current = false; setSaving(false); return }

    // 2) Uložit góly hráčů — paralelně
    const goalResults = await Promise.all(
      Object.entries(counts).map(([player_id, count]) =>
        count > 0
          ? supabase.from('goals').upsert({ player_id, match_id: match.id, count, tournament_id: tournament?.id }, { onConflict: 'player_id,match_id' })
          : supabase.from('goals').delete().match({ player_id, match_id: match.id })
      )
    )
    const goalErr = goalResults.find(r => r.error)?.error
    if (goalErr) { showToast('Chyba gólů: ' + goalErr.message); savingRef.current = false; setSaving(false); return }

    // 3) Asistence (pokud modul zapnut)
    if (tournament?.assists_enabled) {
      const assistResults = await Promise.all(
        Object.entries(assistCounts).map(([player_id, count]) =>
          count > 0
            ? supabase.from('assists').upsert({ player_id, match_id: match.id, count, tournament_id: tournament?.id }, { onConflict: 'player_id,match_id' })
            : supabase.from('assists').delete().match({ player_id, match_id: match.id })
        )
      )
      const assistErr = assistResults.find(r => r.error)?.error
      if (assistErr) { showToast('Chyba asistencí: ' + assistErr.message); savingRef.current = false; setSaving(false); return }
      refetchAssists()
    }

    // 4) Kartičky (pokud modul zapnut) — smazat staré, vložit nové
    if (tournament?.cards_enabled) {
      await supabase.from('cards').delete().eq('match_id', match.id)
      const newCards = Object.entries(cardData).flatMap(([player_id, { yellow, red }]) => {
        if (yellow === 2) return [{ player_id, match_id: match.id, type: 'yellow_red' as const, tournament_id: tournament?.id }]
        if (red === 1) return [{ player_id, match_id: match.id, type: 'red' as const, tournament_id: tournament?.id }]
        if (yellow === 1) return [{ player_id, match_id: match.id, type: 'yellow' as const, tournament_id: tournament?.id }]
        return []
      })
      if (newCards.length > 0) {
        const { error: cardErr } = await supabase.from('cards').insert(newCards)
        if (cardErr) { showToast('Chyba kartiček: ' + cardErr.message); savingRef.current = false; setSaving(false); return }
      }
      refetchCards()
    }

    refetchMatches()
    refetchGoals()
    try {
      if (autoPlayed && match.group_id && group)
        await checkGroupSpecialTips(match.group_id, group)
      const isLeagueNoPlayoff = tournament?.format === 'league' && !(tournament?.league_has_playoff ?? true)
      if (isLeagueNoPlayoff && autoPlayed) {
        const ligaGroup = groups.find(g => g.name === 'Liga')
        if (ligaGroup) {
          const evaluated = await checkLeagueTournamentWinner(ligaGroup)
          if (evaluated) { showToast('Uloženo ✓ · 🏆 Vítěz ligy vyhodnocen'); return }
        }
      }
      showToast('Uloženo ✓')
    } catch {
      showToast('Uloženo ✓ (tipy neaktualizovány)')
    } finally {
      savingRef.current = false
      setSaving(false)
      onClose()
    }
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

      {/* Asistence (modul zapnut) */}
      {tournament?.assists_enabled && allPlayers.length > 0 && (
        <>
          <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.5rem', marginTop: '.65rem' }}>
            🅰 Asistence
          </div>
          <div style={{ marginBottom: '.75rem' }}>
            {ht && homePlayers.length > 0 && (
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: '.15rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="team-dot" style={{ background: ht.color }} />{ht.name}
              </div>
            )}
            {homePlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.38rem 0', borderBottom: '1px solid var(--border)' }}>
                <span className="team-dot" style={{ background: ht?.color ?? '#94a3b8' }} />
                <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button type="button" onClick={() => changeAssist(p.id, -1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--muted)' }}>−</button>
                  <span style={{ width: 28, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: assistCounts[p.id] > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                    {assistCounts[p.id] ?? 0}
                  </span>
                  <button type="button" onClick={() => changeAssist(p.id, +1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--accent)' }}>+</button>
                </div>
              </div>
            ))}
            {at && awayPlayers.length > 0 && (
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.55rem', marginBottom: '.15rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="team-dot" style={{ background: at.color }} />{at.name}
              </div>
            )}
            {awayPlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.38rem 0', borderBottom: '1px solid var(--border)' }}>
                <span className="team-dot" style={{ background: at?.color ?? '#94a3b8' }} />
                <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button type="button" onClick={() => changeAssist(p.id, -1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--muted)' }}>−</button>
                  <span style={{ width: 28, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: assistCounts[p.id] > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                    {assistCounts[p.id] ?? 0}
                  </span>
                  <button type="button" onClick={() => changeAssist(p.id, +1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--accent)' }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Kartičky (modul zapnut) */}
      {tournament?.cards_enabled && allPlayers.length > 0 && (
        <>
          <div style={{ fontSize: '.67rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', fontWeight: 600, marginBottom: '.5rem', marginTop: '.65rem' }}>
            🟡 Kartičky
          </div>
          <div style={{ marginBottom: '.75rem' }}>
            {[...homePlayers, ...awayPlayers].map(p => {
              const cd = cardData[p.id] ?? { yellow: 0, red: 0 }
              const teamColor = homePlayers.includes(p) ? ht?.color ?? '#94a3b8' : at?.color ?? '#94a3b8'
              const cardBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
                padding: '2px 8px', borderRadius: 5, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${active ? color : 'var(--border)'}`,
                background: active ? color : '#f8fafc',
                color: active ? '#fff' : 'var(--muted)',
              })
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="team-dot" style={{ background: teamColor }} />
                  <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" style={cardBtnStyle(cd.yellow >= 1, '#d97706')} onClick={() => changeYellow(p.id, cd.yellow >= 1 ? -1 : +1)}>
                      🟡 {cd.yellow > 0 ? `×${cd.yellow}` : ''}
                    </button>
                    {cd.yellow === 2 && (
                      <span style={{ fontSize: '.72rem', color: '#dc2626', fontWeight: 700 }}>→🔴</span>
                    )}
                    {cd.yellow < 2 && (
                      <button type="button" style={cardBtnStyle(cd.red === 1, '#dc2626')} onClick={() => toggleRed(p.id)}>
                        🔴
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
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

export default function MatchesTab({ teams, players, matches, goals, assists, cards, groups, bracketRounds, bracketSlots, tournament, referees = [], refetchMatches, refetchGoals, refetchAssists, refetchCards, showToast }: Props) {
  const [form, setForm] = useState<MatchForm>(DEF_FORM)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const isLeague = tournament?.format === 'league'
  const groupMatches = matches.filter(m => groups.some(g => g.id === m.group_id))
  const allGroupsComplete = groupMatches.length > 0 && groupMatches.every(m => m.played)
  const hasBracket = bracketRounds.length > 0

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
      tournament_id: tournament?.id,
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
      {/* Cross-tab hint pro playoff nasazení — odkazuje do záložky Play-off */}
      {!isLeague && groupMatches.length > 0 && allGroupsComplete && !bracketSlots.some(s => s.home_id || s.away_id) && (
        <div className="info-box" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '.78rem' }}>
            ✅ Všechny skupinové zápasy odehrány — přejdi do záložky <strong>Play-off</strong> a nasaď týmy (Krok 2).
          </div>
        </div>
      )}
      {!isLeague && groupMatches.length > 0 && !allGroupsComplete && !hasBracket && (
        <div className="info-box" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
            ⏳ Odehráno {groupMatches.filter(m => m.played).length}/{groupMatches.length} skupinových zápasů. Nasazení do playoff bude dostupné po dokončení skupin v záložce <strong>Play-off</strong>.
          </div>
        </div>
      )}

      {/* Export tlačítka */}
      {matches.length > 0 && (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-d btn-sm"
            onClick={() => exportSchedule(matches, groups, teams, tournament?.num_pitches ?? 2, tournament ? { match_duration: tournament.match_duration ?? 20, round_break: tournament.round_break ?? 5 } : undefined)}
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
                        group={groups.find(g => g.id === m.group_id) ?? null}
                        teams={teams}
                        players={players}
                        goals={goals}
                        assists={assists}
                        cards={cards}
                        tournament={tournament}
                        groups={groups}
                        referees={referees}
                        showToast={showToast}
                        onClose={() => setInlineEditId(null)}
                        refetchMatches={refetchMatches}
                        refetchGoals={refetchGoals}
                        refetchAssists={refetchAssists}
                        refetchCards={refetchCards}
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
