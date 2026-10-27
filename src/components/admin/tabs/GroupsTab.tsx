import { Check } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { confirmDialog } from '../../ui/ConfirmDialog'
import { supabase } from '../../../lib/supabase'
import type { Team } from '../../../hooks/useTeams'
import type { Group } from '../../../hooks/useGroups'
import type { Match } from '../../../hooks/useMatches'
import type { Tournament } from '../../../hooks/useTournament'
import { matchCount, addMinutes } from '../../../lib/constants'
import { generateLeagueSchedule, generateSeasonSchedule, addDays, leagueMatchCount, leagueSlotCount } from '../../../lib/leagueSchedule'
import { getFormatDef } from '../../../lib/formats'

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
  // Sezónní režim (ročník = sezóna, kola v různé dny)
  const isSeason = tournament?.schedule_mode === 'season'
  const [seasonFirstDate, setSeasonFirstDate] = useState('')
  const [seasonInterval, setSeasonInterval] = useState('7')
  const [seasonKickoff, setSeasonKickoff] = useState('18:00')
  const [seasonTwice, setSeasonTwice] = useState(true)

  // Tiebreaker edit state
  const [editingTiebreakerGroupId, setEditingTiebreakerGroupId] = useState<string | null>(null)
  const [tiebreakerDraft, setTiebreakerDraft] = useState<'score_first' | 'h2h_first' | 'score_then_h2h'>('score_then_h2h')

  const leagueGroup = groups.find(g => g.name === 'Liga')
  const isLeague = tournament?.format === 'league'

  // Předvyplnit výběr týmů: existující liga → její týmy, jinak všechny týmy turnaje.
  // Čas začátku převzít z existující ligy.
  useEffect(() => {
    setLeagueTeamIds(ids => {
      if (ids.length > 0) return ids
      if (leagueGroup) return leagueGroup.team_ids
      return teams.map(t => t.id)
    })
    if (leagueGroup?.start_time) setLeagueStart(cur => cur || leagueGroup.start_time)
  }, [teams, leagueGroup?.id])
  const formatDef = getFormatDef(tournament?.format_id ?? '')

  const toggleLeagueTeam = (id: string) =>
    setLeagueTeamIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  const leaguePreview = () => {
    const n = leagueTeamIds.length
    if (n < 2) return null
    if (isSeason) {
      const rounds = (n % 2 === 0 ? n - 1 : n) * (seasonTwice ? 2 : 1)
      const total = leagueMatchCount(n) * (seasonTwice ? 2 : 1)
      const interval = Math.max(1, parseInt(seasonInterval) || 7)
      const last = /^\d{4}-\d{2}-\d{2}$/.test(seasonFirstDate) ? addDays(seasonFirstDate, (rounds - 1) * interval) : null
      const fmt = (d: string) => d.split('-').reverse().join('. ').replace(/^0/, '')
      return `${n} týmů · ${total} zápasů · ${rounds} kol${last ? ` · ${fmt(seasonFirstDate)} – ${fmt(last)}` : ''}`
    }
    const dur = parseInt(leagueDur) || 20
    const brk = parseInt(leagueBreak) || 5
    const numPitches = tournament?.num_pitches ?? 2
    const slots = leagueSlotCount(n, numPitches)
    const endTime = leagueStart ? addMinutes(leagueStart, slots * (dur + brk) - brk) : null
    return `${n} týmů · ${leagueMatchCount(n)} zápasů · ${slots} time slotů${endTime ? ` · ${leagueStart}–${endTime}` : ''}`
  }

  const generateLeague = async () => {
    if (leagueGenerating) return
    if (leagueTeamIds.length < 3) { showToast('Vyber alespoň 3 týmy'); return }
    if (isSeason) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(seasonFirstDate)) { showToast('Zadej datum 1. kola'); return }
      if (!/^\d{1,2}:\d{2}$/.test(seasonKickoff)) { showToast('Zadej čas začátku zápasů'); return }
    } else if (!/^\d{1,2}:\d{2}$/.test(leagueStart)) { showToast('Zadej čas začátku prvního zápasu'); return }
    if (!await confirmDialog(leagueGroup
      ? `Smazat stávající ligový rozpis a vygenerovat nový pro ${leagueTeamIds.length} týmů?`
      : `Vygenerovat ligový rozpis pro ${leagueTeamIds.length} týmů?`,
      { title: 'Ligový rozpis', danger: !!leagueGroup, confirmLabel: leagueGroup ? 'Smazat a vygenerovat' : 'Vygenerovat' })) return

    setLeagueGenerating(true)
    try {
      // Smazat existující ligovou skupinu a zápasy
      if (leagueGroup) {
        const { error: delMatchErr } = await supabase.from('matches').delete().eq('group_id', leagueGroup.id)
        if (delMatchErr) throw new Error('Nepodařilo se smazat staré zápasy: ' + delMatchErr.message)
        const { error: delGrpErr } = await supabase.from('groups').delete().eq('id', leagueGroup.id)
        if (delGrpErr) throw new Error('Nepodařilo se smazat starou skupinu: ' + delGrpErr.message)
      }

      // Vytvořit skupinu "Liga"
      const { data: grp, error: grpErr } = await supabase.from('groups').insert({
        name: 'Liga',
        team_ids: leagueTeamIds,
        schedule: isSeason && seasonTwice ? 'twice' : 'once',
        tiebreaker: 'score_then_h2h',
        start_time: isSeason ? seasonKickoff : leagueStart,
        match_duration: parseInt(leagueDur) || 20,
        break_between: parseInt(leagueBreak) || 5,
        tournament_id: tournament?.id,
      }).select().single()
      if (grpErr) throw grpErr

      if (isSeason) {
        const season = generateSeasonSchedule(leagueTeamIds, {
          twice: seasonTwice,
          firstDate: seasonFirstDate,
          intervalDays: Math.max(1, parseInt(seasonInterval) || 7),
          kickoffTime: seasonKickoff,
        })
        const rows = season.map(m => ({
          group_id: grp.id,
          round: m.round,
          home_id: m.home_id,
          away_id: m.away_id,
          home_score: 0,
          away_score: 0,
          played: false,
          scheduled_time: m.scheduled_time,
          match_date: m.match_date,
          tournament_id: tournament?.id,
        }))
        const { error: sErr } = await supabase.from('matches').insert(rows)
        if (sErr) throw sErr
        showToast(`Rozpis sezóny vygenerován — ${rows.length} zápasů v ${new Set(season.map(m => m.roundNo)).size} kolech`)
        refetchGroups(); refetchMatches()
        return
      }

      const schedule = generateLeagueSchedule(
        leagueTeamIds, leagueStart,
        parseInt(leagueDur) || 20,
        parseInt(leagueBreak) || 5,
        leagueBreakWindowStart || undefined,
        leagueBreakWindowStart ? (parseInt(leagueBreakWindowDur) || 60) : undefined,
        tournament?.num_pitches ?? 2,
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
        tournament_id: tournament?.id,
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

  const saveTiebreaker = async (groupId: string) => {
    const { error } = await supabase.from('groups').update({ tiebreaker: tiebreakerDraft }).eq('id', groupId)
    if (error) showToast('Chyba: ' + error.message)
    else { showToast('Tiebreaker uložen ✓'); refetchGroups(); setEditingTiebreakerGroupId(null) }
  }

  const previewEnd = () => {
    if (!form.start_time || !form.teamIds.length) return null
    const n = form.teamIds.length
    const total = matchCount(n, form.schedule)
    const dur = parseInt(form.match_duration) || 20
    const brk = parseInt(form.break_between) || 5
    const numPitches = tournament?.num_pitches ?? 2
    const numGroups = groups.length + 1
    const pitchesPerGroup = Math.max(1, Math.floor(numPitches / numGroups))
    const numSlots = Math.ceil(total / pitchesPerGroup)
    const end = addMinutes(form.start_time, numSlots * (dur + brk) - brk)
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
      tournament_id: tournament?.id,
    }).select().single()

    if (grpErr) { showToast('Chyba: ' + grpErr.message); return }

    const pairs = generatePairs(form.teamIds, form.schedule)
    const dur = parseInt(form.match_duration) || 20
    const brk = parseInt(form.break_between) || 5
    const numPitches = tournament?.num_pitches ?? 2
    const numGroups = groups.length > 0 ? groups.length + 1 : 1
    const pitchesPerGroup = Math.max(1, Math.floor(numPitches / numGroups))
    const matchRows = pairs.map((p, i) => ({
      group_id: grp.id,
      round: form.name.trim(),
      home_id: p.home_id,
      away_id: p.away_id,
      home_score: 0,
      away_score: 0,
      played: false,
      scheduled_time: form.start_time ? addMinutes(form.start_time, Math.floor(i / pitchesPerGroup) * (dur + brk)) : '',
      tournament_id: tournament?.id,
    }))

    const { error: mErr } = await supabase.from('matches').insert(matchRows)
    if (mErr) { showToast('Skupina vytvořena, chyba při generování zápasů: ' + mErr.message); return }

    setForm({ name: '', teamIds: [], schedule: 'once', tiebreaker: 'score_then_h2h', start_time: '', match_duration: '20', break_between: '5' })
    showToast(`Skupina přidána, vygenerováno ${matchRows.length} zápasů ✓`)
    refetchGroups(); refetchMatches()
  }

  const removeGroup = async (g: Group) => {
    if (!await confirmDialog(`Smazat skupinu "${g.name}" a všechny její zápasy?`, { danger: true })) return
    // Delete matches FIRST — otherwise DB cascade sets group_id=null and we lose the filter
    await supabase.from('matches').delete().eq('group_id', g.id)
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) { showToast('Chyba: ' + error.message); return }
    showToast('Skupina smazána')
    refetchGroups(); refetchMatches()
  }

  const preview = previewEnd()

  const assignedTeamIds = useMemo(() => new Set(groups.flatMap(g => g.team_ids)), [groups])

  return (
    <div>
      {!teams.length && (
        <div className="warn-box"><strong>Nejsou žádné týmy.</strong> Nejprve přidej týmy v záložce Týmy.</div>
      )}

      {isLeague && (
        <>
          <div className="sub-title">{isSeason ? 'Sezóna — generovat rozpis kol' : 'Liga — generovat rozpis'}</div>
          <div className="info-box" style={{ marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {isSeason
                ? 'Každý s každým po kolech v různé dny. Dvoukolově = doma i venku. Domácí zápasy jsou rozložené rovnoměrně, každý tým hraje v kole nejvýš jednou.'
                : 'Circle-method: každý tým hraje s každým 1×. Vždy 2 souběžné zápasy, algoritmus minimalizuje hrání dvakrát za sebou. Délka zápasu a přestávka se přebírají z Nastavení nebo je lze přepsat níže.'}
            </div>
          </div>

          {leagueGroup && (
            <div className="warn-box" style={{ marginBottom: '.75rem' }}>
              Ligový rozpis existuje: <strong>{matches.filter(m => m.group_id === leagueGroup.id).length} zápasů</strong>
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
              <div className="gen-preview"><Check size={14} style={{ verticalAlign: '-2px' }} /> {leaguePreview()}</div>
            )}
          </div>

          {isSeason && (
            <>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Datum 1. kola</label>
                  <input className="field-input" type="date" value={seasonFirstDate} onChange={e => setSeasonFirstDate(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Rozestup kol (dní)</label>
                  <input className="field-input" type="number" min="1" value={seasonInterval} onChange={e => setSeasonInterval(e.target.value)} />
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Čas zápasů</label>
                  <input className="field-input" type="time" value={seasonKickoff} onChange={e => setSeasonKickoff(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Systém</label>
                  <select className="field-input field-select" value={seasonTwice ? 'twice' : 'once'} onChange={e => setSeasonTwice(e.target.value === 'twice')}>
                    <option value="twice">Dvoukolově (doma i venku)</option>
                    <option value="once">Jednokolově</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.9rem' }}>
                Datum a čas jednotlivých zápasů lze po vygenerování upravit v záložce Zápasy.
              </div>
            </>
          )}

          {!isSeason && <>
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
          </>}

          <button type="button" className="btn btn-p" onClick={generateLeague} style={{ opacity: leagueGenerating ? 0.6 : 1 }}>
            {leagueGenerating ? 'Generuji…' : isSeason ? 'Generovat rozpis sezóny' : 'Generovat ligový rozpis'}
          </button>

          <hr className="divider" />
          <div className="sub-title">Existující zápasy</div>
          {!leagueGroup ? (
            <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Ligový rozpis nebyl vygenerován.</p>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.85rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.4rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '.95rem', letterSpacing: '.06em', flex: 1 }}>Liga</span>
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
          {/* Hint o formátu */}
          {formatDef && formatDef.groupConfig.defaultGroups > 0 && (
            <div style={{
              padding: '.55rem .8rem', borderRadius: 8, marginBottom: '.75rem', fontSize: '.76rem',
              background: groups.length === formatDef.groupConfig.defaultGroups
                ? 'rgba(22,163,74,.07)' : 'rgba(245,158,11,.09)',
              border: `1px solid ${groups.length === formatDef.groupConfig.defaultGroups
                ? 'rgba(22,163,74,.25)' : 'rgba(245,158,11,.3)'}`,
              color: groups.length === formatDef.groupConfig.defaultGroups ? '#166534' : '#92400e',
            }}>
              {groups.length === formatDef.groupConfig.defaultGroups
                ? `✓ Formát „${formatDef.label}" — počet skupin odpovídá (${groups.length})`
                : `Formát „${formatDef.label}" doporučuje ${formatDef.groupConfig.defaultGroups} skupin — aktuálně vytvořeno ${groups.length}`}
            </div>
          )}
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
      <button type="button" className="btn btn-p" onClick={createGroup}>Vytvořit skupinu a generovat zápasy</button>

      <hr className="divider" />
      <div className="sub-title">Existující skupiny</div>
      {!groups.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Žádné skupiny.</p>
      ) : groups.map(g => {
        const gMatches = matches.filter(m => m.group_id === g.id)
        const cnt = gMatches.length
        const playedCnt = gMatches.filter(m => m.played).length
        return (
          <div key={g.id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.85rem 1rem', marginBottom: '.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.4rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '.95rem', letterSpacing: '.06em', flex: 1 }}>{g.name}</span>
              <button type="button" className="btn btn-s btn-sm" onClick={() => {
                setEditingTiebreakerGroupId(editingTiebreakerGroupId === g.id ? null : g.id)
                setTiebreakerDraft(g.tiebreaker as typeof tiebreakerDraft)
              }}>Tiebreaker</button>
              <button type="button" className="btn btn-d btn-sm" onClick={() => removeGroup(g)}>Smazat</button>
            </div>
            <div style={{ fontSize: '.71rem', color: 'var(--muted)', marginBottom: '.4rem' }}>
              {g.team_ids.length} týmů · {cnt} zápasů ({playedCnt} odehráno) · {g.schedule === 'twice' ? '2×' : '1×'} každý s každým
              {g.start_time && ` · od ${g.start_time}`}
              {' · '}{g.tiebreaker === 'score_first' ? 'Tiebreaker A' : g.tiebreaker === 'h2h_first' ? 'Tiebreaker B' : 'Tiebreaker C'}
            </div>
            {editingTiebreakerGroupId === g.id && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 7, padding: '.6rem .75rem', marginBottom: '.5rem' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '.4rem' }}>Změnit tiebreaker</div>
                {([
                  ['score_first', 'A: Skóre → vstřelené góly'],
                  ['h2h_first', 'B: Vzájemný zápas → skóre → vstřelené'],
                  ['score_then_h2h', 'C: Skóre → vstřelené → vzájemný zápas'],
                ] as const).map(([val, label]) => (
                  <div key={val} className="radio-item" onClick={() => setTiebreakerDraft(val)} style={{ marginBottom: '.2rem' }}>
                    <input type="radio" readOnly checked={tiebreakerDraft === val} />
                    <label style={{ fontSize: '.76rem' }}>{label}</label>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
                  <button type="button" className="btn btn-p btn-sm" onClick={() => saveTiebreaker(g.id)}>Uložit</button>
                  <button type="button" className="btn btn-s btn-sm" onClick={() => setEditingTiebreakerGroupId(null)}>Zrušit</button>
                </div>
              </div>
            )}
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
