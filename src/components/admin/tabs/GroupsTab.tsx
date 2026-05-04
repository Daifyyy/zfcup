import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { Tournament } from '../../../hooks/useTournament'
import { matchCount, addMinutes } from '../../../lib/constants'
import { generateLeagueSchedule, leagueMatchCount, leagueSlotCount } from '../../../lib/leagueSchedule'

interface Props {
  teams: Team[]
  groups: Group[]
  matches: Match[]
  tournament: Tournament | null
  refetchGroups: () => void
  refetchMatches: () => void
  showToast: (msg: string) => void
}

interface GroupForm {
  name: string
  teamIds: string[]
  schedule: 'once' | 'twice'
  tiebreaker: 'score_first' | 'h2h_first' | 'score_then_h2h'
  start_time: string
  match_duration: string
  break_between: string
}

function generatePairs(teamIds: string[], schedule: 'once' | 'twice') {
  // Generate all pairs
  const base: { home_id: string; away_id: string }[] = []
  for (let i = 0; i < teamIds.length; i++)
    for (let j = i + 1; j < teamIds.length; j++)
      base.push({ home_id: teamIds[i], away_id: teamIds[j] })

  const all = schedule === 'twice'
    ? [...base, ...base.map(p => ({ home_id: p.away_id, away_id: p.home_id }))]
    : base

  // Greedy re-order: vždy preferuj zápas kde ani jeden tým nehrál předchozí zápas
  // Minimalizuje situace kdy tým hraje dvakrát za sebou
  const result: { home_id: string; away_id: string }[] = []
  const remaining = [...all]

  while (remaining.length > 0) {
    const prev = result[result.length - 1]
    const busy = prev ? new Set([prev.home_id, prev.away_id]) : new Set<string>()
    // Najdi zápas kde oba týmy mají pauzu
    const idx = remaining.findIndex(m => !busy.has(m.home_id) && !busy.has(m.away_id))
    result.push(...remaining.splice(idx !== -1 ? idx : 0, 1))
  }

  return result
}

export default function GroupsTab({ teams, groups, matches, tournament, refetchGroups, refetchMatches, showToast }: Props) {
  const [form, setForm] = useState<GroupForm>({
    name: '', teamIds: [], schedule: 'once', tiebreaker: 'score_then_h2h',
    start_time: '', match_duration: '20', break_between: '5',
  })

  // League mode state
  const [leagueTeamIds, setLeagueTeamIds] = useState<string[]>([])
  const [leagueStart, setLeagueStart] = useState('')
  const [leagueDur, setLeagueDur] = useState(String(tournament?.match_duration ?? 20))
  const [leagueBreak, setLeagueBreak] = useState(String(tournament?.round_break ?? 5))
  const [leagueBreakWindowStart, setLeagueBreakWindowStart] = useState('')
  const [leagueBreakWindowDur, setLeagueBreakWindowDur] = useState('60')
  const [leagueGenerating, setLeagueGenerating] = useState(false)

  const leagueGroup = groups.find(g => g.name === 'Liga')
  const isLeague = tournament?.format === 'league'

  const toggleLeagueTeam = (id: string) =>
    setLeagueTeamIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  const leaguePreview = () => {
    const n = leagueTeamIds.length
    if (n < 2) return null
    const dur = parseInt(leagueDur) || 20
    const brk = parseInt(leagueBreak) || 5
    const slots = leagueSlotCount(n)
    const endTime = leagueStart ? addMinutes(leagueStart, slots * (dur + brk) - brk) : null
    return `${n} týmů · ${leagueMatchCount(n)} zápasů · ${slots} time slotů${endTime ? ` · ${leagueStart}–${endTime}` : ''}`
  }

  const generateLeague = async () => {
    if (leagueTeamIds.length < 3) { showToast('Vyber alespoň 3 týmy'); return }
    if (!confirm(leagueGroup
      ? `Smazat stávající ligový rozpis a vygenerovat nový pro ${leagueTeamIds.length} týmů?`
      : `Vygenerovat ligový rozpis pro ${leagueTeamIds.length} týmů?`)) return

    setLeagueGenerating(true)
    try {
      // Smazat existující ligovou skupinu a zápasy
      if (leagueGroup) {
        await supabase.from('matches').delete().eq('group_id', leagueGroup.id)
        await supabase.from('groups').delete().eq('id', leagueGroup.id)
      }

      // Vytvořit skupinu "Liga"
      const { data: grp, error: grpErr } = await supabase.from('groups').insert({
        name: 'Liga',
        team_ids: leagueTeamIds,
        schedule: 'once',
        tiebreaker: 'score_then_h2h',
        start_time: leagueStart,
        match_duration: parseInt(leagueDur) || 20,
        break_between: parseInt(leagueBreak) || 5,
      }).select().single()
      if (grpErr) throw grpErr

      const schedule = generateLeagueSchedule(
        leagueTeamIds, leagueStart,
        parseInt(leagueDur) || 20,
        parseInt(leagueBreak) || 5,
        leagueBreakWindowStart || undefined,
        leagueBreakWindowStart ? (parseInt(leagueBreakWindowDur) || 60) : undefined,
      )

      const matchRows = schedule.map(m => ({
        group_id: grp.id,
        round: 'Liga',
        home_id: m.home_id,
        away_id: m.away_id,
        home_score: 0,
        away_score: 0,
        played: false,
        scheduled_time: m.scheduled_time,
      }))

      const { error: mErr } = await supabase.from('matches').insert(matchRows)
      if (mErr) throw mErr

      showToast(`Ligový rozpis vygenerován — ${matchRows.length} zápasů ✓`)
      refetchGroups(); refetchMatches()
    } catch (e: unknown) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLeagueGenerating(false)
    }
  }

  const toggle = (id: string) =>
    setForm(f => ({ ...f, teamIds: f.teamIds.includes(id) ? f.teamIds.filter(x => x !== id) : [...f.teamIds, id] }))

  const previewEnd = () => {
    if (!form.start_time || !form.teamIds.length) return null
    const n = form.teamIds.length
    const total = matchCount(n, form.schedule)
    const dur = parseInt(form.match_duration) || 20
    const brk = parseInt(form.break_between) || 5
    const end = addMinutes(form.start_time, total * (dur + brk) - brk)
    return `${total} zápasů · ${form.start_time}–${end}`
  }

  const createGroup = async () => {
    if (!form.name.trim()) { showToast('Zadej název skupiny'); return }
    if (form.teamIds.length < 2) { showToast('Vyber alespoň 2 týmy'); return }

    const { data: grp, error: grpErr } = await supabase.from('groups').insert({
      name: form.name.trim(),
      team_ids: form.teamIds,
      schedule: form.schedule,
      tiebreaker: form.tiebreaker,
      start_time: form.start_time,
      match_duration: parseInt(form.match_duration) || 20,
      break_between: parseInt(form.break_between) || 5,
    }).select().single()

    if (grpErr) { showToast('Chyba: ' + grpErr.message); return }

    const pairs = generatePairs(form.teamIds, form.schedule)
    const dur = parseInt(form.match_duration) || 20
    const brk = parseInt(form.break_between) || 5
    const matchRows = pairs.map((p, i) => ({
      group_id: grp.id,
      round: form.name.trim(),
      home_id: p.home_id,
      away_id: p.away_id,
      home_score: 0,
      away_score: 0,
      played: false,
      scheduled_time: form.start_time ? addMinutes(form.start_time, i * (dur + brk)) : '',
    }))

    const { error: mErr } = await supabase.from('matches').insert(matchRows)
    if (mErr) { showToast('Skupina vytvořena, chyba při generování zápasů: ' + mErr.message); return }

    setForm({ name: '', teamIds: [], schedule: 'once', tiebreaker: 'score_then_h2h', start_time: '', match_duration: '20', break_between: '5' })
    showToast(`Skupina přidána, vygenerováno ${matchRows.length} zápasů ✓`)
    refetchGroups(); refetchMatches()
  }

  const removeGroup = async (g: Group) => {
    if (!confirm(`Smazat skupinu "${g.name}" a všechny její zápasy?`)) return
    // Delete matches FIRST — otherwise DB cascade sets group_id=null and we lose the filter
    await supabase.from('matches').delete().eq('group_id', g.id)
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) { showToast('Chyba: ' + error.message); return }
    showToast('Skupina smazána')
    refetchGroups(); refetchMatches()
  }

  const preview = previewEnd()

  // Týmy které jsou již zařazeny do nějaké skupiny
  const assignedTeamIds = new Set(groups.flatMap(g => g.team_ids))

  return (
    <div>
      {!teams.length && (
        <div className="warn-box"><strong>Nejsou žádné týmy.</strong> Nejprve přidej týmy v záložce Týmy.</div>
      )}

      {isLeague && (
        <>
          <div className="sub-title">Liga — generovat rozpis</div>
          <div className="info-box" style={{ marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              Circle-method: každý tým hraje s každým 1×. Vždy 2 souběžné zápasy,
              algoritmus minimalizuje hrání dvakrát za sebou. Délka zápasu a přestávka se přebírají z Nastavení nebo je lze přepsat níže.
            </div>
          </div>

          {leagueGroup && (
            <div className="warn-box" style={{ marginBottom: '.75rem' }}>
              ⚠️ Ligový rozpis existuje: <strong>{matches.filter(m => m.group_id === leagueGroup.id).length} zápasů</strong>
              {' '}({matches.filter(m => m.group_id === leagueGroup.id && m.played).length} odehráno).
              Generování smaže stávající rozpis.
            </div>
          )}

          <div className="field-group">
            <label className="field-label">Týmy v lize</label>
            <div className="chk-list">
              {teams.map(t => (
                <div key={t.id} className="chk-item" onClick={() => toggleLeagueTeam(t.id)} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" readOnly checked={leagueTeamIds.includes(t.id)} />
                  <label style={{ cursor: 'pointer' }}>
                    <span className="team-dot" style={{ background: t.color }} />{t.name}
                  </label>
                </div>
              ))}
            </div>
            {leagueTeamIds.length >= 2 && (
              <div className="gen-preview">✓ {leaguePreview()}</div>
            )}
          </div>

          <div className="field-group">
            <label className="field-label">Začátek (čas)</label>
            <input className="field-input" type="time" value={leagueStart}
              onChange={e => setLeagueStart(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Délka zápasu (min)</label>
              <input className="field-input" type="number" min="1" value={leagueDur}
                onChange={e => setLeagueDur(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Přestávka mezi zápasy (min)</label>
              <input className="field-input" type="number" min="0" value={leagueBreak}
                onChange={e => setLeagueBreak(e.target.value)} />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Okno přestávky (oběd apod.) — volitelné</label>
            <div className="field-row" style={{ marginTop: '.3rem' }}>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ fontSize: '.7rem' }}>Začátek</label>
                <input className="field-input" type="time" value={leagueBreakWindowStart}
                  onChange={e => setLeagueBreakWindowStart(e.target.value)}
                  placeholder="12:00" />
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ fontSize: '.7rem' }}>Délka (min)</label>
                <input className="field-input" type="number" min="1" value={leagueBreakWindowDur}
                  onChange={e => setLeagueBreakWindowDur(e.target.value)}
                  disabled={!leagueBreakWindowStart} />
              </div>
            </div>
            {leagueBreakWindowStart && (
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.3rem' }}>
                Zápasy, které by zasáhly do tohoto okna, se přesunou na jeho konec.
                {' '}
                <button type="button" onClick={() => setLeagueBreakWindowStart('')}
                  style={{ fontSize: '.7rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Odebrat
                </button>
              </div>
            )}
          </div>

          <button type="button" className="btn btn-p" onClick={generateLeague} style={{ opacity: leagueGenerating ? 0.6 : 1 }}>
            {leagueGenerating ? 'Generuji…' : '⚡ Generovat ligový rozpis'}
          </button>

          <hr className="divider" />
          <div className="sub-title">Existující zápasy</div>
          {!leagueGroup ? (
            <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Ligový rozpis nebyl vygenerován.</p>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.85rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.4rem' }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '.95rem', letterSpacing: '.06em', flex: 1 }}>Liga</span>
                <button type="button" className="btn btn-d btn-sm" onClick={() => removeGroup(leagueGroup)}>Smazat</button>
              </div>
              <div style={{ fontSize: '.71rem', color: 'var(--muted)' }}>
                {leagueGroup.team_ids.length} týmů · {matches.filter(m => m.group_id === leagueGroup.id).length} zápasů
                {' '}({matches.filter(m => m.group_id === leagueGroup.id && m.played).length} odehráno)
                {leagueGroup.start_time && ` · od ${leagueGroup.start_time}`}
              </div>
            </div>
          )}
        </>
      )}

      {!isLeague && (
        <>
          <div className="sub-title">Vytvořit skupinu</div>
      <div className="field-group">
        <label className="field-label">Název skupiny</label>
        <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Skupina A" />
      </div>
      <div className="field-group">
        <label className="field-label">Týmy ve skupině</label>
        <div className="chk-list">
          {!teams.length ? <span style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Nejsou týmy.</span>
            : teams.map(t => {
              const assigned = assignedTeamIds.has(t.id)
              const groupName = assigned ? groups.find(g => g.team_ids.includes(t.id))?.name : undefined
              return (
                <div
                  key={t.id}
                  className="chk-item"
                  onClick={() => !assigned && toggle(t.id)}
                  style={{ opacity: assigned ? .45 : 1, cursor: assigned ? 'not-allowed' : 'pointer' }}
                >
                  <input type="checkbox" readOnly checked={form.teamIds.includes(t.id)} disabled={assigned} />
                  <label style={{ cursor: assigned ? 'not-allowed' : 'pointer' }}>
                    <span className="team-dot" style={{ background: t.color }} />
                    {t.name}
                    {assigned && <span style={{ fontSize: '.65rem', color: 'var(--muted)', marginLeft: 4 }}>({groupName})</span>}
                  </label>
                </div>
              )
            })}
        </div>
        {form.teamIds.length >= 2 && (
          <div className="gen-preview">
            ✓ {form.teamIds.length} týmů → {matchCount(form.teamIds.length, form.schedule)} zápasů
            {preview && ` · ${preview}`}
          </div>
        )}
      </div>
      <div className="field-group">
        <label className="field-label">Systém odehrání</label>
        <div className="radio-row">
          <div className="radio-item" onClick={() => setForm(f => ({ ...f, schedule: 'once' }))}>
            <input type="radio" readOnly checked={form.schedule === 'once'} />
            <label>1× každý s každým</label>
          </div>
          <div className="radio-item" onClick={() => setForm(f => ({ ...f, schedule: 'twice' }))}>
            <input type="radio" readOnly checked={form.schedule === 'twice'} />
            <label>2× každý s každým</label>
          </div>
        </div>
      </div>
      <div className="field-group">
        <label className="field-label">Tiebreaker (při rovnosti bodů)</label>
        <div className="radio-row" style={{ flexDirection: 'column', gap: '.3rem' }}>
          <div className="radio-item" onClick={() => setForm(f => ({ ...f, tiebreaker: 'score_first' }))}>
            <input type="radio" readOnly checked={form.tiebreaker === 'score_first'} />
            <label>A: Skóre → vstřelené góly</label>
          </div>
          <div className="radio-item" onClick={() => setForm(f => ({ ...f, tiebreaker: 'h2h_first' }))}>
            <input type="radio" readOnly checked={form.tiebreaker === 'h2h_first'} />
            <label>B: Vzájemný zápas → skóre → vstřelené</label>
          </div>
          <div className="radio-item" onClick={() => setForm(f => ({ ...f, tiebreaker: 'score_then_h2h' }))}>
            <input type="radio" readOnly checked={form.tiebreaker === 'score_then_h2h'} />
            <label>C: Skóre → vstřelené → vzájemný zápas</label>
          </div>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Začátek (čas)</label>
          <input className="field-input" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
        </div>
        <div className="field-group" />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Délka zápasu (min)</label>
          <input className="field-input" type="number" min="1" value={form.match_duration} onChange={e => setForm(f => ({ ...f, match_duration: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label">Přestávka (min)</label>
          <input className="field-input" type="number" min="0" value={form.break_between} onChange={e => setForm(f => ({ ...f, break_between: e.target.value }))} />
        </div>
      </div>
      <button type="button" className="btn btn-p" onClick={createGroup}>⚡ Vytvořit skupinu a generovat zápasy</button>

      <hr className="divider" />
      <div className="sub-title">Existující skupiny</div>
      {!groups.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádné skupiny.</p>
      ) : groups.map(g => {
        const cnt = matches.filter(m => m.group_id === g.id).length
        const playedCnt = matches.filter(m => m.group_id === g.id && m.played).length
        return (
          <div key={g.id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.85rem 1rem', marginBottom: '.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.4rem' }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '.95rem', letterSpacing: '.06em', flex: 1 }}>{g.name}</span>
              <button type="button" className="btn btn-d btn-sm" onClick={() => removeGroup(g)}>Smazat</button>
            </div>
            <div style={{ fontSize: '.71rem', color: 'var(--muted)', marginBottom: '.4rem' }}>
              {g.team_ids.length} týmů · {cnt} zápasů ({playedCnt} odehráno) · {g.schedule === 'twice' ? '2×' : '1×'} každý s každým
              {g.start_time && ` · od ${g.start_time}`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {g.team_ids.map(id => {
                const t = teams.find(t => t.id === id)
                return t ? (
                  <span key={id} style={{
                    fontSize: '.7rem', background: '#fff', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span className="team-dot" style={{ background: t.color }} />{t.name}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )
      })}
        </>
      )}
    </div>
  )
}
