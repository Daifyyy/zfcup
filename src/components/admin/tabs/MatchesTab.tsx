import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import type { Match } from '../../../hooks/useMatches'
import type { Goal } from '../../../hooks/useGoals'
import type { Group } from '../../../hooks/useGroups'

interface Props {
  teams: Team[]
  players: Player[]
  matches: Match[]
  goals: Goal[]
  groups: Group[]
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

function GoalEditor({
  match, teams, players, goals, showToast, onClose,
}: {
  match: Match
  teams: Team[]
  players: Player[]
  goals: Goal[]
  showToast: (m: string) => void
  onClose: () => void
}) {
  const homePlayers = players.filter(p => p.team_id === match.home_id).sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
  const awayPlayers = players.filter(p => p.team_id === match.away_id).sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
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

  const change = (pid: string, delta: number) =>
    setCounts(c => ({ ...c, [pid]: Math.max(0, (c[pid] ?? 0) + delta) }))

  const saveGoals = async () => {
    const ops = Object.entries(counts)
    for (const [player_id, count] of ops) {
      if (count > 0) {
        const { error } = await supabase.from('goals').upsert(
          { player_id, match_id: match.id, count },
          { onConflict: 'player_id,match_id' }
        )
        if (error) { showToast('Chyba: ' + error.message); return }
      } else {
        await supabase.from('goals').delete().match({ player_id, match_id: match.id })
      }
    }
    showToast('Góly uloženy ✓')
    onClose()
  }

  const ht = teams.find(t => t.id === match.home_id)
  const at = teams.find(t => t.id === match.away_id)

  const PlayerRow = ({ p, color }: { p: Player; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
      <span className="team-dot" style={{ background: color }} />
      {p.number !== null && (
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '.85rem', color: 'var(--muted)', width: 24, textAlign: 'center', flexShrink: 0 }}>{p.number}</span>
      )}
      <span style={{ flex: 1, fontSize: '.83rem', fontWeight: 500 }}>{p.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          type="button"
          onClick={() => change(p.id, -1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--muted)' }}
        >−</button>
        <span style={{ width: 28, textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: counts[p.id] > 0 ? 'var(--accent)' : 'var(--muted)' }}>
          {counts[p.id] ?? 0}
        </span>
        <button
          type="button"
          onClick={() => change(p.id, +1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, color: 'var(--accent)' }}
        >+</button>
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

export default function MatchesTab({ teams, players, matches, goals, groups, showToast }: Props) {
  const [form, setForm] = useState<MatchForm>(DEF_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [goalMatchId, setGoalMatchId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'

  // Auto-check played when score > 0 is entered
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

  const saveMatch = async () => {
    if (!form.home_id || !form.away_id) { showToast('Vyberte oba týmy'); return }
    if (form.home_id === form.away_id) { showToast('Týmy musí být různé'); return }

    const homeScore = parseInt(form.home_score) || 0
    const awayScore = parseInt(form.away_score) || 0
    // Auto-mark as played when any score is non-zero
    const played = form.played || homeScore > 0 || awayScore > 0

    // Use empty string (not null) for text columns — avoids 400 on NOT NULL columns
    const data = {
      round: form.round || '',
      home_id: form.home_id,
      away_id: form.away_id,
      home_score: homeScore,
      away_score: awayScore,
      played,
      scheduled_time: form.scheduled_time || '',
    }

    if (editId) {
      const { error } = await supabase.from('matches').update(data).eq('id', editId)
      if (error) { showToast('Chyba: ' + error.message); return }
    } else {
      const { error } = await supabase.from('matches').insert(data)
      if (error) { showToast('Chyba: ' + error.message); return }
    }
    setForm(DEF_FORM); setEditId(null)
    showToast('Zápas uložen ✓')
  }

  const editMatch = (m: Match) => {
    setForm({
      round: m.round || '',
      home_id: m.home_id,
      away_id: m.away_id,
      home_score: String(m.home_score ?? 0),
      away_score: String(m.away_score ?? 0),
      played: Boolean(m.played),
      scheduled_time: m.scheduled_time || '',
    })
    setEditId(m.id)
    setGoalMatchId(null)
    // Scroll to form — uses scrollIntoView so it works inside the panel's own scroll container
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const removeMatch = async (id: string) => {
    if (!confirm('Smazat zápas?')) return
    await supabase.from('goals').delete().eq('match_id', id)
    const { error } = await supabase.from('matches').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message)
    else showToast('Smazáno')
  }

  const f = (k: keyof MatchForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  // Group matches by round — sorted alphabetically for stable display order
  const roundsMap: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Bez skupiny'
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  }
  const roundEntries = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))

  return (
    <div>
      {/* Form section — ref used for scrollIntoView */}
      <div ref={formRef}>
        <div className="sub-title">{editId ? '✎ Upravit zápas' : 'Přidat zápas'}</div>
        {editId && (
          <div style={{ fontSize: '.72rem', color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(37,99,235,.2)', borderRadius: 6, padding: '.35rem .75rem', marginBottom: '.7rem' }}>
            Editační mód — upraven bude existující zápas
          </div>
        )}
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
            <input
              type="checkbox"
              checked={form.played}
              onChange={e => setForm(p => ({ ...p, played: e.target.checked }))}
              style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
            />
            Zápas odehrán
            {form.played && <span style={{ color: 'var(--success)', marginLeft: 2 }}>✓</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <label className="field-label" style={{ margin: 0 }}>Čas:</label>
            <input className="field-input" type="time" value={form.scheduled_time} onChange={f('scheduled_time')}
              style={{ width: 110 }} />
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-p" onClick={saveMatch}>
            {editId ? '💾 Uložit změny' : '+ Přidat zápas'}
          </button>
          {editId && (
            <button type="button" className="btn btn-d btn-sm" onClick={() => { setEditId(null); setForm(DEF_FORM) }}>✕ Zrušit</button>
          )}
        </div>
      </div>

      <hr className="divider" />
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
                return (
                  <div key={m.id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
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
                      <button type="button" className="btn btn-s btn-sm"
                        onClick={() => setGoalMatchId(goalMatchId === m.id ? null : m.id)}>
                        ⚽ Góly
                      </button>
                      <button type="button" className="btn btn-d btn-sm" onClick={() => editMatch(m)}>Upravit</button>
                      <button type="button" className="btn btn-d btn-sm" onClick={() => removeMatch(m.id)}>Smazat</button>
                    </div>
                    {goalMatchId === m.id && (
                      <div style={{ padding: '0 .85rem .65rem' }}>
                        <GoalEditor
                          match={m} teams={teams} players={players} goals={goals}
                          showToast={showToast} onClose={() => setGoalMatchId(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
