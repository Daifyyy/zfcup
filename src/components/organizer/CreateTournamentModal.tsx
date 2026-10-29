import { useState } from 'react'
import { CalendarDays, Globe, Lock, Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SPORTS, type SportId } from '../../lib/sports'
import { useCompetitions } from '../../hooks/useCompetitions'
import { useAuthRole } from '../../hooks/useAuthRole'
import { carryOverTeams, lastEdition, nextEditionNumber } from '../../lib/editions'
import { formatColumns, getFormatDef } from '../../lib/formats'
import { generateAccessCode } from '../../lib/accessCodes'
import { isMissingColumnError } from '../../lib/partners'
import { useBackClose } from '../../lib/useBackClose'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/** Založení turnaje (samostatný turnaj nebo další ročník vlastní soutěže). */
export default function CreateTournamentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (tournamentId: string) => void }) {
  useBackClose(true, onClose, 'create-tournament')
  const { competitions } = useCompetitions()
  const { userId, isPlatformAdmin } = useAuthRole()
  // Do soutěže smí přidat ročník jen její vlastník (nebo správce platformy)
  const myCompetitions = competitions.filter(c => isPlatformAdmin || (!!userId && c.owner_id === userId))

  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newSport, setNewSport] = useState<SportId>('football')
  const [newMode, setNewMode] = useState<'day' | 'season'>('day')
  const [newPrivate, setNewPrivate] = useState(false)
  const [newCompetitionId, setNewCompetitionId] = useState('')
  const [newCarryOver, setNewCarryOver] = useState(true)
  const [slugManual, setSlugManual] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  function handleNameChange(val: string) {
    setNewName(val)
    if (!slugManual) setNewSlug(toSlug(val))
  }

  function handleSlugChange(val: string) {
    setSlugManual(true)
    setNewSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) { setCreateError('Zadej název turnaje'); return }
    if (!newSlug.trim()) { setCreateError('Zadej slug (URL)'); return }
    if (creating) return
    setCreating(true)
    setCreateError('')
    let data: { id: string } | null = null
    try {
      const user = (await supabase.auth.getUser()).data.user
      const competition = myCompetitions.find(c => c.id === newCompetitionId)
      const [edition, prev] = competition
        ? await Promise.all([nextEditionNumber(competition.id), lastEdition(competition.id)])
        : [null, null]
      // Nový ročník přebírá formát, časy, moduly a vzhled z minulého ročníku.
      // Sezóna se hraje po kolech → musí být ligový formát (jinak chybí generátor rozpisu sezóny).
      const leagueDef = getFormatDef('league')
      const formatSettings = {
        ...(prev?.settings ?? {}),
        ...(newMode === 'season' && prev?.settings.format !== 'league' && leagueDef ? formatColumns(leagueDef) : {}),
      }
      const res = await supabase
        .from('tournament')
        .insert({
          name: newName.trim(), slug: newSlug.trim(), sport: competition?.sport ?? newSport, owner_id: user?.id ?? null,
          ...formatSettings,
          // Nové sloupce (migrace 09) posílat jen když jsou potřeba — bez migrace jde založit běžný turnaj
          ...(newMode === 'season' ? { schedule_mode: 'season' } : {}),
          // Migrace 15 — posílat jen u soukromého (bez migrace jde založit veřejný turnaj)
          ...(newPrivate ? { visibility: 'private', access_code: generateAccessCode() } : {}),
          ...(competition ? { competition_id: competition.id, edition } : {}),
        })
        .select('id')
        .single()
      if (res.error) {
        setCreateError(
          newPrivate && (isMissingColumnError(res.error, 'visibility') || isMissingColumnError(res.error, 'access_code'))
            ? 'Soukromé turnaje vyžadují migraci 15 — založte turnaj jako veřejný.'
            : res.error.message.includes('unique') ? 'Slug již existuje, zvol jiný.' : res.error.message,
        )
        return
      }
      data = res.data
      // Převzít týmy a soupisky z posledního ročníku soutěže
      if (competition && newCarryOver && prev) {
        try { await carryOverTeams(prev.id, data.id, competition.id) }
        catch (e) { setCreateError('Turnaj založen, ale převzetí týmů selhalo: ' + (e instanceof Error ? e.message : String(e))) }
      }
    } finally {
      setCreating(false)
    }
    if (data) onCreated(data.id)
  }

  return (
    <div className="lp-modal" onClick={onClose}>
      <div className="lp-modal__panel" onClick={e => e.stopPropagation()}>
        <h2 className="lp-modal__title">Nový turnaj</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
          <div>
            <label className="field-label">Sport</label>
            <div className="lp-sportpick">
              {SPORTS.map(s => {
                const Icon = s.Icon
                return (
                  <button key={s.id} type="button" onClick={() => setNewSport(s.id)}
                    className={newSport === s.id ? 'lp-sportpick__btn lp-sportpick__btn--on' : 'lp-sportpick__btn'}>
                    <Icon size={22} />{s.label}
                  </button>
                )
              })}
            </div>
            <p className="lp-modal__hint">Sport nelze po založení turnaje změnit.</p>
          </div>
          <div>
            <label className="field-label">Průběh</label>
            <div className="lp-sportpick">
              <button type="button" onClick={() => setNewMode('day')} className={newMode === 'day' ? 'lp-sportpick__btn lp-sportpick__btn--on' : 'lp-sportpick__btn'}>
                <CalendarDays size={20} />Jednodenní turnaj
              </button>
              <button type="button" onClick={() => setNewMode('season')} className={newMode === 'season' ? 'lp-sportpick__btn lp-sportpick__btn--on' : 'lp-sportpick__btn'}>
                <Trophy size={20} />Sezóna (kola v různé dny)
              </button>
            </div>
            <p className="lp-modal__hint">{newMode === 'season' ? 'Liga po kolech s datem každého zápasu (např. okresní liga).' : 'Všechny zápasy v jeden den (např. firemní turnaj).'}</p>
          </div>
          <div>
            <label className="field-label">Viditelnost</label>
            <div className="lp-sportpick">
              <button type="button" onClick={() => setNewPrivate(false)} className={!newPrivate ? 'lp-sportpick__btn lp-sportpick__btn--on' : 'lp-sportpick__btn'}>
                <Globe size={20} />Veřejný
              </button>
              <button type="button" onClick={() => setNewPrivate(true)} className={newPrivate ? 'lp-sportpick__btn lp-sportpick__btn--on' : 'lp-sportpick__btn'}>
                <Lock size={20} />Soukromý (s kódem)
              </button>
            </div>
            <p className="lp-modal__hint">{newPrivate ? 'Uvidí ho jen ten, komu pošlete přístupový kód. Lze později změnit v Nastavení.' : 'Kdokoli ho najde ve vyhledávání. Lze později změnit v Nastavení.'}</p>
          </div>
          {myCompetitions.filter(c => c.sport === newSport).length > 0 && (
            <div>
              <label className="field-label">Soutěž</label>
              <select className="field-input field-select" value={newCompetitionId} onChange={e => setNewCompetitionId(e.target.value)}>
                <option value="">Samostatný turnaj</option>
                {myCompetitions.filter(c => c.sport === newSport).map(c => (
                  <option key={c.id} value={c.id}>Další ročník: {c.name}</option>
                ))}
              </select>
              {newCompetitionId && (
                <label className="chk-item" style={{ marginTop: '.45rem' }}>
                  <input type="checkbox" checked={newCarryOver} onChange={e => setNewCarryOver(e.target.checked)} />
                  <span style={{ fontSize: '.84rem' }}>Převzít týmy a soupisky z posledního ročníku</span>
                </label>
              )}
            </div>
          )}
          <div>
            <label className="field-label">Název turnaje</label>
            <input className="field-input" type="text" placeholder="např. Firemní pohár 2027" value={newName} onChange={e => handleNameChange(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="field-label">Slug (URL adresa)</label>
            <input className="field-input" type="text" placeholder="firemni-pohar-2027" value={newSlug} onChange={e => handleSlugChange(e.target.value)} required />
            <p className="lp-modal__hint">Interní identifikátor turnaje: {newSlug || 'firemni-pohar-2027'}</p>
          </div>
          {createError && <p className="lp-modal__err">{createError}</p>}
          <button type="submit" className="ui-btn ui-btn--primary ui-btn--block" style={{ opacity: creating ? 0.6 : 1 }}>
            {creating ? 'Vytvářím…' : 'Vytvořit turnaj'}
          </button>
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={onClose}>
            Zrušit
          </button>
        </form>
      </div>
    </div>
  )
}
