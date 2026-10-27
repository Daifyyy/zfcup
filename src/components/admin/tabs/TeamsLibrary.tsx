// Admin → Týmy: propojení s knihovnou klubů organizátora (migrace 13).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Check, Library, Plus } from 'lucide-react'
import type { Team } from '../../../hooks/useTeams'
import type { Player } from '../../../hooks/usePlayers'
import { TeamLogo } from '../../ui/TeamLogo'
import { normalizeName } from '../../../lib/history'
import { playersLabel } from '../../public/TeamDetailDrawer'
import {
  addClubToTournament, fetchLibrary, libraryAvailable, rosterOfClub, saveTeamToLibrary,
  type LibraryClub, type LibraryPerson,
} from '../../../lib/clubs'

/** Stav knihovny vlastníka turnaje; `available === false` = chybí migrace 13 nebo vlastník. */
export function useOwnerLibrary(ownerId: string | null | undefined) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [clubs, setClubs] = useState<LibraryClub[]>([])
  const [persons, setPersons] = useState<LibraryPerson[]>([])

  const reload = useCallback(async () => {
    if (!ownerId) return
    try {
      const lib = await fetchLibrary(ownerId)
      setClubs(lib.clubs); setPersons(lib.persons)
    } catch { /* chybu ukáže až akce */ }
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) { setAvailable(false); return }
    libraryAvailable().then(ok => { setAvailable(ok); if (ok) reload() })
  }, [ownerId, reload])

  return { available, clubs, persons, reload }
}

type Lib = ReturnType<typeof useOwnerLibrary>

interface PickerProps {
  lib: Lib
  tournamentId: string
  teams: Team[]
  onAdded: () => void
  showToast: (m: string) => void
}

/** Seznam klubů z knihovny, které v turnaji ještě nejsou → jedním klikem tým i se soupiskou. */
export function LibraryPicker({ lib, tournamentId, teams, onAdded, showToast }: PickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const inTournament = useMemo(() => new Set(teams.map(t => t.club_id).filter(Boolean)), [teams])
  const teamNames = useMemo(() => new Set(teams.map(t => normalizeName(t.name))), [teams])
  const candidates = lib.clubs
    .filter(c => !inTournament.has(c.id))
    .filter(c => !search || normalizeName(c.name).includes(normalizeName(search)))

  if (!lib.available) return null

  const add = async (club: LibraryClub) => {
    if (busyId) return
    setBusyId(club.id)
    try {
      const roster = rosterOfClub(lib.persons, club.id)
      const res = await addClubToTournament(tournamentId, club, roster)
      if (!res.created) { showToast('Tento klub už v turnaji je'); return }
      showToast(`Přidán ${club.name} · ${res.players} hráčů`)
      onAdded()
    } catch (e) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="tl-lib">
      <button type="button" className="btn btn-s btn-sm" onClick={() => { setOpen(o => !o); lib.reload() }}>
        <Library size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        {open ? 'Skrýt knihovnu' : `Přidat z knihovny (${lib.clubs.filter(c => !inTournament.has(c.id)).length})`}
      </button>
      {open && (
        <div className="tl-lib__box">
          {lib.clubs.length === 0 ? (
            <p className="tl-lib__hint">Knihovna je prázdná. Kluby založíš na úvodní stránce v „Moje kluby“, nebo ulož tým níže tlačítkem „Uložit do knihovny“.</p>
          ) : (
            <>
              <input className="field-input" placeholder="Hledat klub" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '.5rem' }} />
              {candidates.length === 0 && <p className="tl-lib__hint">Všechny kluby z knihovny už v turnaji jsou.</p>}
              <ul className="tl-lib__list">
                {candidates.map(c => {
                  const n = lib.persons.filter(p => p.club_id === c.id).length
                  const nameClash = teamNames.has(normalizeName(c.name))
                  return (
                    <li key={c.id}>
                      <TeamLogo team={{ name: c.name, color: c.color ?? '#64748b', logo_url: c.logo_url }} size={24} />
                      <span className="tl-lib__name">{c.name}</span>
                      <span className="tl-lib__meta">{playersLabel(n)}{nameClash ? ' · tým stejného jména už v turnaji je' : ''}</span>
                      <button type="button" className="btn btn-p btn-sm" onClick={() => add(c)} style={{ opacity: busyId ? 0.6 : 1 }}>
                        <Plus size={13} style={{ verticalAlign: '-2px' }} />{busyId === c.id ? 'Přidávám…' : 'Přidat'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface SaveProps {
  lib: Lib
  ownerId: string
  team: Team
  players: Player[]
  onSaved: () => void
  showToast: (m: string) => void
}

/** U týmu: uložit/aktualizovat klub a soupisku v knihovně. */
export function SaveToLibraryButton({ lib, ownerId, team, players, onSaved, showToast }: SaveProps) {
  const [busy, setBusy] = useState(false)
  if (!lib.available) return null
  const linked = !!team.club_id && lib.clubs.some(c => c.id === team.club_id)

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      const roster = players.filter(p => p.team_id === team.id)
      const res = await saveTeamToLibrary(ownerId, team, roster)
      showToast(res.newClub
        ? `${res.club.name} uložen do knihovny · ${roster.length} hráčů`
        : `Soupiska v knihovně aktualizována · nových hráčů: ${res.persons}`)
      await lib.reload()
      onSaved()
    } catch (e) {
      showToast('Chyba: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tl-save">
      {linked && <span className="tl-save__ok"><Check size={13} />V knihovně klubů</span>}
      <button type="button" className="btn btn-s btn-sm" onClick={save} style={{ opacity: busy ? 0.6 : 1 }} title="Klub a soupiska se uloží do knihovny pro další turnaje">
        <BookmarkPlus size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        {busy ? 'Ukládám…' : linked ? 'Aktualizovat soupisku v knihovně' : 'Uložit do knihovny'}
      </button>
    </div>
  )
}
