import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import type { Team } from '../../../hooks/useTeams'
import { useCompetitions, useCompetitionEditions, type Club } from '../../../hooks/useCompetitions'
import { useAuthRole } from '../../../hooks/useAuthRole'
import { carryOverTeams, ensureIdentities, nextEditionNumber, slugify } from '../../../lib/editions'
import { normalizeName } from '../../../lib/history'

interface Props {
  tournament: Tournament | null
  teams: Team[]
  refetchTournament: () => void
  refetchTeams: () => void
  refetchPlayers: () => void
  showToast: (msg: string) => void
}

/** Admin → Nastavení → Soutěž a ročník. */
export default function CompetitionSection({ tournament, teams, refetchTournament, refetchTeams, refetchPlayers, showToast }: Props) {
  const { competitions, available, refetch: refetchCompetitions } = useCompetitions()
  const { userId, isPlatformAdmin } = useAuthRole()
  // Přiřadit ročník lze jen do vlastní soutěže (RLS by jinak zápis odmítla)
  const myCompetitions = competitions.filter(c => isPlatformAdmin || (!!userId && c.owner_id === userId))
  const competitionId = tournament?.competition_id ?? ''
  const competition = competitions.find(c => c.id === competitionId)
  const { editions } = useCompetitionEditions(competitionId)

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [pickId, setPickId] = useState('')
  const [newName, setNewName] = useState('')
  const [edition, setEdition] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [pairing, setPairing] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setEdition(tournament?.edition ? String(tournament.edition) : '')
    setSeasonLabel(tournament?.season_label ?? '')
  }, [tournament?.id, tournament?.edition, tournament?.season_label])

  useEffect(() => {
    if (!pickId && myCompetitions.length) setPickId(myCompetitions[0].id)
    if (!myCompetitions.length) setMode('new')
  }, [myCompetitions.length, pickId])

  // Návrh čísla ročníku pro vybranou soutěž
  useEffect(() => {
    if (competitionId || mode !== 'existing' || !pickId) return
    nextEditionNumber(pickId).then(n => setEdition(cur => cur || String(n)))
  }, [pickId, mode, competitionId])

  // Výchozí zdroj převzetí = nejbližší předchozí ročník
  useEffect(() => {
    const others = editions.filter(e => e.id !== tournament?.id)
    const prev = [...others].filter(e => (e.edition ?? 0) < (tournament?.edition ?? Infinity)).pop() ?? others[others.length - 1]
    setSourceId(prev?.id ?? '')
  }, [editions, tournament?.id, tournament?.edition])

  async function loadClubs() {
    if (!competitionId) { setClubs([]); return }
    const { data, error } = await supabase.from('clubs').select('*').eq('competition_id', competitionId).order('name')
    if (!error) setClubs((data ?? []) as Club[])
  }
  useEffect(() => { loadClubs() }, [competitionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPairing(Object.fromEntries(teams.map(t => [t.id, t.club_id ?? ''])))
  }, [teams])

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return
    setBusy(label)
    try { await fn() } catch (e) { showToast('Chyba: ' + (e instanceof Error ? e.message : String(e))) } finally { setBusy(null) }
  }

  if (!available) {
    return (
      <div>
        <div className="sub-title">Soutěž a ročník</div>
        <div className="warn-box">Soutěže s ročníky vyžadují migraci <code>db-backup/09_competitions_seasons.sql</code> v Supabase.</div>
      </div>
    )
  }

  const assign = () => run('assign', async () => {
    if (!tournament) return
    // Nová soutěž bez vyplněného čísla = 1. ročník (pole ukazuje „1“ jako nápovědu)
    const ed = edition.trim() === '' && mode === 'new' ? 1 : parseInt(edition)
    if (!ed || ed < 1) { showToast('Zadej číslo ročníku'); return }
    let compId = pickId
    if (mode === 'new') {
      const name = newName.trim()
      if (!name) { showToast('Zadej název soutěže'); return }
      const ownerId = (await supabase.auth.getUser()).data.user?.id ?? null
      const { data, error } = await supabase.from('competitions')
        .insert({ name, slug: slugify(name), sport: tournament.sport, logo_url: tournament.logo_url, owner_id: ownerId })
        .select('id').single()
      if (error) { showToast(error.message.includes('unique') || error.code === '23505' ? 'Soutěž s tímto názvem už existuje' : 'Chyba: ' + error.message); return }
      compId = data.id as string
    } else {
      const comp = competitions.find(c => c.id === compId)
      if (!comp) { showToast('Vyber soutěž'); return }
      if (comp.sport !== tournament.sport) { showToast('Soutěž je pro jiný sport'); return }
    }
    const { error } = await supabase.from('tournament')
      .update({ competition_id: compId, edition: ed, season_label: seasonLabel.trim() })
      .eq('id', tournament.id)
    if (error) { showToast(error.code === '23505' ? `${ed}. ročník v této soutěži už existuje` : 'Chyba: ' + error.message); return }
    const res = await ensureIdentities(tournament.id, compId)
    refetchCompetitions(); refetchTournament(); refetchTeams(); refetchPlayers()
    showToast(`Ročník přiřazen · nové kluby: ${res.clubs}, hráči: ${res.persons}`)
  })

  const saveEdition = () => run('edition', async () => {
    if (!tournament) return
    const ed = parseInt(edition)
    if (!ed || ed < 1) { showToast('Zadej číslo ročníku'); return }
    const { error } = await supabase.from('tournament').update({ edition: ed, season_label: seasonLabel.trim() }).eq('id', tournament.id)
    if (error) { showToast(error.code === '23505' ? `${ed}. ročník v této soutěži už existuje` : 'Chyba: ' + error.message); return }
    refetchTournament(); showToast('Uloženo')
  })

  const carryOver = () => run('carry', async () => {
    if (!tournament || !competitionId || !sourceId) return
    const src = editions.find(e => e.id === sourceId)
    if (!confirm(`Převzít týmy a soupisky z ${src?.edition ?? ''}. ročníku (${src?.name})? Týmy, které už v tomto ročníku jsou, se přeskočí.`)) return
    const res = await carryOverTeams(sourceId, tournament.id, competitionId)
    refetchTeams(); refetchPlayers(); loadClubs()
    showToast(res.teams ? `Převzato ${res.teams} týmů a ${res.players} hráčů` : 'Všechny týmy už v ročníku jsou')
  })

  const autoLink = () => run('auto', async () => {
    if (!tournament || !competitionId) return
    const res = await ensureIdentities(tournament.id, competitionId)
    refetchTeams(); refetchPlayers(); loadClubs()
    showToast(`Propojeno · nové kluby: ${res.clubs}, nové osoby: ${res.persons}`)
  })

  const savePairing = () => run('pair', async () => {
    const changed = teams.filter(t => (pairing[t.id] ?? '') !== (t.club_id ?? '') && pairing[t.id])
    for (const t of changed) {
      const { error } = await supabase.from('teams').update({ club_id: pairing[t.id] }).eq('id', t.id)
      if (error) throw new Error(error.message)
    }
    refetchTeams(); showToast(changed.length ? `Spárováno ${changed.length} týmů` : 'Beze změn')
  })

  const detach = () => run('detach', async () => {
    if (!tournament || !confirm('Odebrat tento turnaj ze soutěže? Týmy a hráči zůstanou, jen se přestanou počítat do historie soutěže.')) return
    const { error } = await supabase.from('tournament').update({ competition_id: null, edition: null }).eq('id', tournament.id)
    if (error) { showToast('Chyba: ' + error.message); return }
    refetchTournament(); showToast('Odebráno ze soutěže')
  })

  const sameSport = myCompetitions.filter(c => c.sport === tournament?.sport)

  return (
    <div>
      <div className="sub-title">Soutěž a ročník</div>

      {!competition ? (
        <>
          <div className="info-box">
            Opakuje se turnaj každý rok? Přiřaď ho do <strong>soutěže</strong> jako ročník — vznikne veřejná stránka
            soutěže se síní vítězů, věčnou tabulkou, rekordy a historickými statistikami hráčů.
          </div>
          <div className="radio-row" style={{ marginBottom: '.7rem' }}>
            {sameSport.length > 0 && (
              <label className="radio-item"><input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} /><span>Existující soutěž</span></label>
            )}
            <label className="radio-item"><input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /><span>Nová soutěž</span></label>
          </div>
          {mode === 'existing' && sameSport.length > 0 ? (
            <div className="field-group">
              <label className="field-label">Soutěž</label>
              <select className="field-input field-select" value={pickId} onChange={e => { setPickId(e.target.value); setEdition('') }}>
                {sameSport.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="field-group">
              <label className="field-label">Název soutěže</label>
              <input className="field-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="např. Hokejová liga okres Jablonec" />
            </div>
          )}
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Číslo ročníku</label>
              <input className="field-input" type="number" min={1} value={edition} onChange={e => setEdition(e.target.value)} placeholder="1" />
            </div>
            <div className="field-group">
              <label className="field-label">Sezóna (volitelně)</label>
              <input className="field-input" value={seasonLabel} onChange={e => setSeasonLabel(e.target.value)} placeholder="2025/26" />
            </div>
          </div>
          <button type="button" className="btn btn-p" onClick={assign} style={{ opacity: busy ? 0.6 : 1 }}>
            {busy === 'assign' ? 'Ukládám…' : 'Přiřadit do soutěže'}
          </button>
        </>
      ) : (
        <>
          <div className="a-item" style={{ marginBottom: '.8rem' }}>
            <div className="a-item-main">
              {competition.name}
              <div className="a-item-sub">{tournament?.edition}. ročník{tournament?.season_label ? ` · ${tournament.season_label}` : ''} · celkem ročníků: {editions.length}</div>
            </div>
            <a className="btn btn-s btn-sm" href={`/s/${competition.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Stránka soutěže</a>
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Číslo ročníku</label>
              <input className="field-input" type="number" min={1} value={edition} onChange={e => setEdition(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Sezóna</label>
              <input className="field-input" value={seasonLabel} onChange={e => setSeasonLabel(e.target.value)} placeholder="2025/26" />
            </div>
          </div>
          <div className="btn-row" style={{ marginBottom: '1rem' }}>
            <button type="button" className="btn btn-s" onClick={saveEdition} style={{ opacity: busy ? 0.6 : 1 }}>Uložit ročník</button>
            <button type="button" className="btn btn-d btn-sm" onClick={detach}>Odebrat ze soutěže</button>
          </div>

          {editions.filter(e => e.id !== tournament?.id).length > 0 && (
            <>
              <div className="sub-title">Převzít týmy a soupisky</div>
              <div className="field-group">
                <select className="field-input field-select" value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  {editions.filter(e => e.id !== tournament?.id).map(e => (
                    <option key={e.id} value={e.id}>{e.edition}. ročník — {e.name}{e.season_label ? ` (${e.season_label})` : ''}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-p" onClick={carryOver} style={{ opacity: busy ? 0.6 : 1 }}>
                {busy === 'carry' ? 'Přebírám…' : 'Převzít týmy a hráče'}
              </button>
            </>
          )}

          {teams.length > 0 && (
            <>
              <div className="sub-title">Párování týmů s kluby</div>
              <div style={{ fontSize: '.76rem', color: 'var(--ink-muted)', marginBottom: '.5rem' }}>
                Klub spojuje tým napříč ročníky (např. při přejmenování). Bez ručního párování se tým spáruje podle jména.
              </div>
              <div className="a-list">
                {teams.map(t => {
                  const suggestion = clubs.find(c => normalizeName(c.name) === normalizeName(t.name))
                  return (
                    <div key={t.id} className="a-item">
                      <span className="team-dot" style={{ background: t.color }} />
                      <span className="a-item-main" style={{ minWidth: 0 }}>{t.name}</span>
                      <select className="field-input field-select" style={{ width: 200, fontSize: '.8rem', padding: '.35rem 1.8rem .35rem .55rem' }}
                        value={pairing[t.id] ?? ''} onChange={e => setPairing(p => ({ ...p, [t.id]: e.target.value }))}>
                        <option value="">{suggestion ? `(automaticky: ${suggestion.name})` : '(nový klub)'}</option>
                        {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-s" onClick={savePairing} style={{ opacity: busy ? 0.6 : 1 }}>Uložit párování</button>
                <button type="button" className="btn btn-s" onClick={autoLink} style={{ opacity: busy ? 0.6 : 1 }}>
                  {busy === 'auto' ? 'Propojuji…' : 'Doplnit kluby a hráče automaticky'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
