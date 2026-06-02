import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import { TOURNAMENT_FORMATS, getFormatDef } from '../../../lib/formats'

interface Props {
  tournament: Tournament | null
  refetchTournament: () => void
  refetchGroups: () => void
  refetchMatches: () => void
  refetchGoals: () => void
  refetchBracket: () => void
  refetchBracketGoals: () => void
  showToast: (msg: string) => void
}

export default function SettingsTab({ tournament, refetchTournament, refetchGroups, refetchMatches, refetchGoals, refetchBracket, refetchBracketGoals, showToast }: Props) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [loading, setLoading] = useState(false)
  const [leagueParams, setLeagueParams] = useState({
    match_duration: 20,
    halves: 1,
    playoff_kickoff: '',
    round_break: 5,
  })
  const [advancingPerGroup, setAdvancingPerGroup] = useState(2)
  const [numPitches, setNumPitches] = useState(2)
  const [savingFormat, setSavingFormat] = useState(false)

  useEffect(() => {
    if (!tournament) return
    setLeagueParams({
      match_duration: tournament.match_duration ?? 20,
      halves: tournament.halves ?? 1,
      playoff_kickoff: tournament.playoff_kickoff ?? '',
      round_break: tournament.round_break ?? 5,
    })
    setAdvancingPerGroup(tournament.advancing_per_group ?? 2)
    setNumPitches(tournament.num_pitches ?? 2)
  }, [tournament?.id])

  const toggleTips = async () => {
    if (!tournament) return
    const { error } = await supabase
      .from('tournament')
      .update({ tips_enabled: !tournament.tips_enabled })
      .eq('id', tournament.id)
    if (error) showToast('Chyba: ' + error.message)
    else { showToast(tournament.tips_enabled ? 'Tipovačka vypnuta' : 'Tipovačka zapnuta ✓'); refetchTournament() }
  }

  const selectFormat = async (formatId: string) => {
    if (!tournament) return
    if (savingFormat) return
    setSavingFormat(true)
    try {
      const def = getFormatDef(formatId)
      if (!def) return

      const updates: Record<string, unknown> = {
        format_id: formatId,
        format: def.groupConfig.tournamentFormat,
        num_groups: def.groupConfig.defaultGroups,
        advancing_per_group: def.groupConfig.defaultAdvancingPerGroup,
      }
      if (def.groupConfig.leagueHasPlayoff !== undefined) {
        updates.league_has_playoff = def.groupConfig.leagueHasPlayoff
      }
      if (def.groupConfig.tournamentFormat === 'league') {
        updates.playoff_style = 'standard'
      }

      const { error } = await supabase.from('tournament').update(updates).eq('id', tournament.id)
      if (error) showToast('Chyba: ' + error.message)
      else {
        setAdvancingPerGroup(def.groupConfig.defaultAdvancingPerGroup)
        showToast(`Formát: ${def.label} ✓`)
        refetchTournament()
      }
    } finally {
      setSavingFormat(false)
    }
  }

  const toggleLeaguePlayoff = async () => {
    if (!tournament) return
    const next = !(tournament.league_has_playoff ?? true)
    const { error } = await supabase.from('tournament').update({ league_has_playoff: next }).eq('id', tournament.id)
    if (error) showToast('Chyba: ' + error.message)
    else { showToast(next ? 'Liga s playoff ✓' : 'Liga bez playoff ✓'); refetchTournament() }
  }

  const saveLeagueParams = async () => {
    if (!tournament) return
    const { error } = await supabase.from('tournament').update({
      match_duration: leagueParams.match_duration,
      halves: leagueParams.halves,
      playoff_kickoff: leagueParams.playoff_kickoff,
      round_break: leagueParams.round_break,
    }).eq('id', tournament.id)
    if (error) showToast('Chyba: ' + error.message)
    else { showToast('Parametry uloženy ✓'); refetchTournament() }
  }

  const isLeagueFormat = tournament?.format === 'league'
  const leagueHasPlayoff = tournament?.league_has_playoff ?? true
  const currentFormatDef = getFormatDef(tournament?.format_id ?? '')
  const formatPreviewText = currentFormatDef?.description ?? ''

  const changePassword = async () => {
    if (!p1) { showToast('Zadejte nové heslo'); return }
    if (p1 !== p2) { showToast('Hesla se neshodují'); return }
    if (p1.length < 6) { showToast('Heslo musí mít alespoň 6 znaků'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 })
      if (error) { showToast('Chyba: ' + error.message); return }
      setP1(''); setP2('')
      showToast('Heslo změněno ✓')
    } finally {
      setLoading(false)
    }
  }

  const resetTournamentData = async () => {
    if (!tournament) return
    if (!confirm('Smazat zápasy, skupiny, góly a tipy? Týmy a hráči zůstanou.')) return
    if (!confirm('Opravdu? Tato akce je nevratná.')) return

    const tid = tournament.id
    // Soft tables: ignore errors (may not exist or have missing RLS)
    const softTables = ['bracket_goals', 'bracket_slots', 'bracket_rounds', 'bracket_tips', 'special_tips']
    // Hard tables: must succeed
    const hardTables = ['goals', 'tips', 'matches', 'groups']
    for (const table of softTables) {
      const { error } = await supabase.from(table).delete().eq('tournament_id', tid)
      if (error) console.warn(`Soft delete ${table}:`, error.message)
    }
    for (const table of hardTables) {
      const { error } = await supabase.from(table).delete().eq('tournament_id', tid)
      if (error) { showToast('Chyba (' + table + '): ' + error.message); return }
    }
    await supabase.from('tipsters').update({ total_points: 0 }).eq('tournament_id', tid)
    refetchGroups(); refetchMatches(); refetchGoals(); refetchBracket(); refetchBracketGoals()
    showToast('Zápasy, skupiny, góly a tipy smazány ✓')
  }

  const resetData = async () => {
    if (!tournament) return
    if (!confirm('Opravdu smazat VŠECHNA data? Tuto akci nelze vrátit!')) return
    if (!confirm('Opravdu? Poslední potvrzení — smazat vše?')) return

    const tid = tournament.id
    const tables = [
      'bracket_goals', 'goals',
      'tips', 'bracket_tips', 'special_tips',
      'bracket_slots', 'bracket_rounds',
      'matches', 'groups',
      'players', 'teams',
      'announcements',
    ]
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('tournament_id', tid)
      if (error) { showToast('Chyba (' + table + '): ' + error.message); return }
    }
    await supabase.from('tipsters').update({ total_points: 0 }).eq('tournament_id', tid)
    await supabase.from('tournament').update({ name: '', subtitle: '', date: '', venue: '', description: '' })
      .eq('id', tid)
    refetchGroups(); refetchMatches(); refetchGoals(); refetchBracket(); refetchBracketGoals(); refetchTournament()
    showToast('Vše smazáno')
  }

  return (
    <div>
      {/* ── Format Picker ─────────────────────────────────────────────────── */}
      <div className="sub-title">Formát turnaje</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginBottom: '1rem' }}>
        {TOURNAMENT_FORMATS.map(def => {
          const isSelected = tournament?.format_id === def.id ||
            (!tournament?.format_id && (() => {
              if (def.id === 'league' && tournament?.format === 'league' && !(tournament?.league_has_playoff ?? true)) return true
              if (def.id === 'league_playoff' && tournament?.format === 'league' && (tournament?.league_has_playoff ?? true)) return true
              if (tournament?.format !== 'league') {
                const adv = (tournament?.advancing_per_group ?? 2) * (tournament?.num_groups ?? 2)
                const cross = tournament?.playoff_style === 'cross'
                if (def.id === 'groups_sf' && adv <= 4) return true
                if (def.id === 'groups_six' && adv === 6 && !cross) return true
                if (def.id === 'groups_six_cross' && adv === 6 && cross) return true
                if (def.id === 'groups_qf' && adv > 6) return true
              }
              return false
            })())
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => selectFormat(def.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '.75rem',
                padding: '.65rem .85rem', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected ? 'var(--accent-dim)' : '#f8fafc',
                opacity: savingFormat && !isSelected ? 0.6 : 1,
                transition: 'border-color .15s, background .15s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected ? 'var(--accent)' : '#fff',
              }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '.85rem', color: isSelected ? 'var(--accent)' : 'inherit' }}>
                  {def.label}
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                  {def.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Počet hřišť — vždy viditelné, platí pro skupiny i ligu */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.75rem .95rem', marginBottom: '.75rem' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>
          Počet hřišť
        </div>
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field-group">
            <label className="field-label">Hřiště k dispozici (1–4)</label>
            <input
              className="field-input"
              type="number"
              min="1"
              max="4"
              value={numPitches}
              onChange={e => setNumPitches(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="field-group" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-s" onClick={async () => {
              if (!tournament) return
              const { error } = await supabase.from('tournament').update({ num_pitches: numPitches }).eq('id', tournament.id)
              if (error) showToast('Chyba: ' + error.message)
              else { showToast(`Počet hřišť: ${numPitches} ✓`); refetchTournament() }
            }}>💾 Uložit</button>
          </div>
        </div>
        <div style={{ fontSize: '.69rem', color: 'var(--muted)', marginTop: '.25rem' }}>
          Určuje kolik zápasů probíhá současně — ovlivňuje časový harmonogram skupin i ligy.
        </div>
      </div>

      {/* Postupující — jen pro skupinový formát */}
      {!isLeagueFormat && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.75rem .95rem', marginBottom: '.75rem' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>
            Postupující z každé skupiny
          </div>
          <div className="field-row" style={{ alignItems: 'flex-end' }}>
            <div className="field-group">
              <label className="field-label">Počet postupujících (1–4)</label>
              <input
                className="field-input"
                type="number"
                min="1"
                max="4"
                value={advancingPerGroup}
                onChange={e => setAdvancingPerGroup(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="field-group" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-s" onClick={async () => {
                if (!tournament) return
                const { error } = await supabase.from('tournament').update({ advancing_per_group: advancingPerGroup }).eq('id', tournament.id)
                if (error) showToast('Chyba: ' + error.message)
                else { showToast(`Postupující: ${advancingPerGroup} ✓`); refetchTournament() }
              }}>💾 Uložit</button>
            </div>
          </div>
          {formatPreviewText && (
            <div style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 7, padding: '.4rem .65rem', fontSize: '.74rem', color: 'var(--accent)', marginTop: '.5rem' }}>
              🏆 {formatPreviewText}
            </div>
          )}
          <div style={{ fontSize: '.69rem', color: 'var(--muted)', marginTop: '.35rem' }}>
            Ovlivňuje zbarvení tabulky skupin (zelená = postupující). Výběr formátu nastaví výchozí hodnotu.
          </div>
        </div>
      )}

      {tournament?.format === 'league' && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.85rem .95rem', marginBottom: '.75rem' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.6rem' }}>
            Parametry ligového zápasu
          </div>
          {/* Playoff toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.55rem .75rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '.7rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.82rem' }}>Playoff po ligové fázi</div>
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>
                {leagueHasPlayoff ? 'Top-6 → QF + SF + Finále' : 'Bez playoff — vítěz = 1. místo tabulky'}
              </div>
            </div>
            <button type="button" className={`btn btn-sm ${leagueHasPlayoff ? 'btn-p' : 'btn-s'}`} onClick={toggleLeaguePlayoff}>
              {leagueHasPlayoff ? 'Ano' : 'Ne'}
            </button>
          </div>
          {/* Playoff preview */}
          {formatPreviewText && (
            <div style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 7, padding: '.45rem .65rem', fontSize: '.74rem', color: 'var(--accent)', marginBottom: '.7rem' }}>
              🏆 {formatPreviewText}
            </div>
          )}
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Délka zápasu (min)</label>
              <input className="field-input" type="number" min="1" value={leagueParams.match_duration}
                onChange={e => setLeagueParams(p => ({ ...p, match_duration: parseInt(e.target.value) || 20 }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Přestávka mezi sloty (min)</label>
              <input className="field-input" type="number" min="0" value={leagueParams.round_break}
                onChange={e => setLeagueParams(p => ({ ...p, round_break: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Poločasy</label>
              <select className="field-input field-select" value={leagueParams.halves}
                onChange={e => setLeagueParams(p => ({ ...p, halves: parseInt(e.target.value) }))}>
                <option value={1}>1 poločas</option>
                <option value={2}>2 poločasy</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Playoff — čas výkopu</label>
              <input className="field-input" type="time" value={leagueParams.playoff_kickoff}
                onChange={e => setLeagueParams(p => ({ ...p, playoff_kickoff: e.target.value }))} />
            </div>
          </div>
          <button type="button" className="btn btn-s" onClick={saveLeagueParams}>💾 Uložit parametry</button>
        </div>
      )}

      <hr className="divider" />
      <div className="sub-title">Volitelné moduly</div>
      {[
        {
          key: 'assists_enabled' as const,
          enabled: tournament?.assists_enabled ?? false,
          title: 'Asistence',
          desc: (on: boolean) => on ? 'Pole pro asistenci viditelné při zadávání zápasů a v přehledu střelců' : 'Asistence jsou skryté — zadávají se jen góly',
        },
        {
          key: 'cards_enabled' as const,
          enabled: tournament?.cards_enabled ?? false,
          title: 'Kartičky & disciplína',
          desc: (on: boolean) => on ? 'Záložka Disciplína viditelná; kartičky se zadávají u každého zápasu' : 'Kartičky jsou vypnuté',
        },
        {
          key: 'sponsors_enabled' as const,
          enabled: tournament?.sponsors_enabled ?? false,
          title: 'Sponzoři',
          desc: (on: boolean) => on ? 'Záložka Sponzoři viditelná; loga sponzorů se zobrazí po stranách stránky' : 'Sponzoři jsou skrytí',
        },
      ].map(({ key, enabled, title, desc }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.7rem .9rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, marginBottom: '.55rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{title}</div>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>{desc(enabled)}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!tournament) return
              const { error } = await supabase.from('tournament').update({ [key]: !enabled }).eq('id', tournament.id)
              if (error) showToast('Chyba: ' + error.message)
              else { showToast((enabled ? `${title} vypnuto` : `${title} zapnuto ✓`)); refetchTournament() }
            }}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: enabled ? 'var(--accent)' : '#cbd5e1',
              position: 'relative', transition: 'background .2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, borderRadius: '50%',
              width: 18, height: 18, background: '#fff',
              left: enabled ? 23 : 3,
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>
      ))}

      <hr className="divider" />
      <div className="sub-title">Tipovačka</div>
      <div style={{ marginBottom: '.75rem' }}>
        <label className="field-label">Datum turnaje (uzamkne tipy v čas výkopu)</label>
        <input
          className="field-input"
          type="date"
          value={tournament?.tips_lock_from ?? ''}
          onChange={async e => {
            if (!tournament) return
            const { error } = await supabase.from('tournament').update({ tips_lock_from: e.target.value }).eq('id', tournament.id)
            if (error) showToast('Chyba: ' + error.message)
            else refetchTournament()
          }}
        />
        <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.28rem' }}>
          Tipy se uzamknou v čas zápasu pouze v tento den. Bez data se zamykají podle času každý den.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.7rem .9rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '.85rem' }}>Zobrazit tipovačku uživatelům</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
            {tournament?.tips_enabled ? 'Tipovačka je viditelná v navigaci' : 'Tipovačka je skrytá — jen ty ji vidíš'}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTips}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: tournament?.tips_enabled ? 'var(--accent)' : '#cbd5e1',
            position: 'relative', transition: 'background .2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, borderRadius: '50%',
            width: 18, height: 18, background: '#fff',
            left: tournament?.tips_enabled ? 23 : 3,
            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </button>
      </div>

      <hr className="divider" />
      <div className="info-box">
        <strong>Supabase</strong> je nakonfigurováno a data se ukládají do databáze v reálném čase.
        Přihlašování probíhá přes Supabase Auth (email + heslo).
      </div>

      <div className="sub-title">Změna hesla</div>
      <div className="field-group">
        <label className="field-label">Nové heslo</label>
        <input className="field-input" type="password" value={p1} onChange={e => setP1(e.target.value)} placeholder="Nové heslo (min. 6 znaků)" />
      </div>
      <div className="field-group">
        <label className="field-label">Potvrdit heslo</label>
        <input className="field-input" type="password" value={p2} onChange={e => setP2(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && changePassword()} placeholder="Znovu nové heslo" />
      </div>
      <button type="button" className="btn btn-s" onClick={changePassword} style={{ opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Ukládám…' : '🔑 Změnit heslo'}
      </button>

      <hr className="divider" />
      <div className="sub-title">Nebezpečná zóna</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Tyto akce jsou nevratné.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.75rem .9rem' }}>
          <div style={{ fontWeight: 600, fontSize: '.84rem', marginBottom: '.25rem' }}>🔄 Čistý start (zachovat týmy)</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.55rem' }}>
            Smaže zápasy, skupiny, góly, play-off a tipy všech uživatelů. Týmy a hráči zůstanou.
          </div>
          <button
            type="button"
            className="btn btn-d"
            style={{ border: '1px solid rgba(217,119,6,.4)', color: '#b45309' }}
            onClick={resetTournamentData}
          >
            🔄 Resetovat zápasy &amp; tipy
          </button>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, padding: '.75rem .9rem' }}>
          <div style={{ fontWeight: 600, fontSize: '.84rem', marginBottom: '.25rem' }}>🗑 Vymazat úplně vše</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.55rem' }}>
            Smaže veškerá data včetně týmů. Účet Supabase Auth zůstane zachován.
          </div>
          <button
            type="button"
            className="btn btn-d"
            style={{ border: '1px solid var(--border)' }}
            onClick={resetData}
          >
            🗑 Vymazat vše
          </button>
        </div>
      </div>
    </div>
  )
}
