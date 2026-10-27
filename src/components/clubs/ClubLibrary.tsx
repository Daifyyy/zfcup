// Knihovna klubů organizátora („Moje kluby“) — mimo konkrétní turnaj.
// Klub: název, barva, logo, veřejná stránka /k/{slug}, soupiska (osoby), sloučení duplicit.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Merge, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TeamLogo } from '../ui/TeamLogo'
import { TEAM_COLORS } from '../../lib/constants'
import { clubAssetPath, removeAssetByUrl, storagePathFromUrl, uploadAsset } from '../../lib/storage'
import {
  createClub, fetchLibrary, libraryAvailable, mergeClubs, rosterOfClub, uniqueClubSlug,
  type LibraryClub, type LibraryPerson,
} from '../../lib/clubs'
import { normalizeName } from '../../lib/history'

interface Props { ownerId: string; onClose: () => void }

const ROLE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'captain', label: 'Kapitán' },
  { value: 'goalkeeper', label: 'Brankář' },
  { value: 'both', label: 'Kapitán + brankář' },
]

/** Dvojklikové potvrzení místo confirm() (blokuje i automatizaci) */
function useArm() {
  const [armed, setArmed] = useState<string | null>(null)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return { armed, arm: setArmed, isArmed: (k: string) => armed === k }
}

export default function ClubLibrary({ ownerId, onClose }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [clubs, setClubs] = useState<LibraryClub[]>([])
  const [persons, setPersons] = useState<LibraryPerson[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const { arm, isArmed } = useArm()

  const load = useCallback(async () => {
    try {
      const lib = await fetchLibrary(ownerId)
      setClubs(lib.clubs); setPersons(lib.persons)
    } catch (e) {
      setMsg({ text: 'Chyba načtení: ' + (e instanceof Error ? e.message : String(e)), error: true })
    }
  }, [ownerId])

  useEffect(() => {
    libraryAvailable().then(ok => { setAvailable(ok); if (ok) load() })
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!msg || msg.error) return
    const t = setTimeout(() => setMsg(null), 3000)
    return () => clearTimeout(t)
  }, [msg])

  async function run(label: string, fn: () => Promise<string | void>) {
    if (busy) return
    setBusy(label)
    try {
      const text = await fn()
      if (text) setMsg({ text })
      await load()
    } catch (e) {
      setMsg({ text: 'Chyba: ' + (e instanceof Error ? e.message : String(e)), error: true })
    } finally {
      setBusy(null)
    }
  }

  const filtered = useMemo(() => {
    const q = normalizeName(search)
    return q ? clubs.filter(c => normalizeName(c.name).includes(q)) : clubs
  }, [clubs, search])

  const selected = clubs.find(c => c.id === selectedId) ?? null

  const addClub = () => run('add', async () => {
    const name = newName.trim()
    if (!name) { setMsg({ text: 'Zadej název klubu', error: true }); return }
    if (clubs.some(c => normalizeName(c.name) === normalizeName(name))) { setMsg({ text: 'Klub s tímto názvem už v knihovně je', error: true }); return }
    const color = TEAM_COLORS[clubs.length % TEAM_COLORS.length]
    const c = await createClub(ownerId, { name, color })
    setNewName(''); setSelectedId(c.id)
    return `Klub ${c.name} založen`
  })

  return (
    <div className="lp-modal" onClick={onClose}>
      <div className="cl-panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Moje kluby">
        <header className="cl-head">
          <h2 className="cl-head__title">Moje kluby</h2>
          <span className="cl-head__sub">{clubs.length ? `${clubs.length} klubů · použitelné ve všech tvých turnajích` : 'Kluby a soupisky pro všechny tvé turnaje'}</span>
          <button type="button" className="tm-drawer__close" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
        </header>

        {available === false && (
          <div className="cl-body"><div className="warn-box">Knihovna klubů vyžaduje migraci <code>db-backup/13_clubs_library.sql</code> v Supabase.</div></div>
        )}
        {available === null && <div className="cl-body cl-muted">Načítám…</div>}

        {available && (
          <div className="cl-layout">
            <aside className="cl-list">
              <div className="cl-search">
                <Search size={15} />
                <input className="field-input" placeholder="Hledat klub" value={search} onChange={e => setSearch(e.target.value)} aria-label="Hledat klub" />
              </div>
              <form className="cl-new" onSubmit={e => { e.preventDefault(); addClub() }}>
                <input className="field-input" placeholder="Nový klub — název" value={newName} onChange={e => setNewName(e.target.value)} aria-label="Název nového klubu" />
                <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" style={{ opacity: busy ? 0.6 : 1 }}><Plus size={15} />Přidat</button>
              </form>
              <ul className="cl-items">
                {filtered.map(c => {
                  const n = persons.filter(p => p.club_id === c.id).length
                  return (
                    <li key={c.id}>
                      <button type="button" className={`cl-item${c.id === selectedId ? ' cl-item--on' : ''}`} onClick={() => setSelectedId(c.id)}>
                        <TeamLogo team={{ name: c.name, color: c.color ?? '#64748b', logo_url: c.logo_url }} size={30} />
                        <span className="cl-item__name">{c.name}</span>
                        <span className="cl-item__meta">{n}</span>
                      </button>
                    </li>
                  )
                })}
                {!filtered.length && <li className="cl-muted" style={{ padding: '1rem' }}>{clubs.length ? 'Nic nenalezeno.' : 'Zatím žádné kluby. Přidej první, nebo ulož tým z turnaje (Admin → Týmy).'}</li>}
              </ul>
            </aside>

            <section className="cl-detail">
              {selected ? (
                <ClubDetail
                  key={selected.id}
                  club={selected}
                  roster={rosterOfClub(persons, selected.id)}
                  others={clubs.filter(c => c.id !== selected.id)}
                  ownerId={ownerId}
                  busy={busy}
                  run={run}
                  arm={arm}
                  isArmed={isArmed}
                  setMsg={setMsg}
                  onDeleted={() => setSelectedId(null)}
                />
              ) : (
                <div className="cl-muted cl-empty">Vyber klub vlevo.</div>
              )}
            </section>
          </div>
        )}

        {msg && <div className={`cl-msg${msg.error ? ' cl-msg--err' : ''}`} role="status">{msg.text}</div>}
      </div>
    </div>
  )
}

interface DetailProps {
  club: LibraryClub
  roster: LibraryPerson[]
  others: LibraryClub[]
  ownerId: string
  busy: string | null
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>
  arm: (k: string | null) => void
  isArmed: (k: string) => boolean
  setMsg: (m: { text: string; error?: boolean } | null) => void
  onDeleted: () => void
}

function ClubDetail({ club, roster, others, ownerId, busy, run, arm, isArmed, setMsg, onDeleted }: DetailProps) {
  const [name, setName] = useState(club.name)
  const [color, setColor] = useState(club.color ?? '#1d4ed8')
  const [mergeId, setMergeId] = useState('')
  const [pName, setPName] = useState('')
  const [pNumber, setPNumber] = useState('')
  const dirty = name.trim() !== club.name || color !== (club.color ?? '#1d4ed8')
  const publicUrl = club.slug ? `${window.location.origin}/k/${club.slug}` : null

  const save = () => run('save', async () => {
    const n = name.trim()
    if (!n) { setMsg({ text: 'Název nesmí být prázdný', error: true }); return }
    const patch: Record<string, unknown> = { name: n, color }
    if (!club.slug || n !== club.name) patch.slug = await uniqueClubSlug(n, club.id)
    if (!club.owner_id) patch.owner_id = ownerId
    const { error } = await supabase.from('clubs').update(patch).eq('id', club.id)
    if (error) throw new Error(error.message)
    return 'Uloženo'
  })

  const uploadLogo = (file: File) => run('logo', async () => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setMsg({ text: 'Logo musí být PNG nebo JPG', error: true }); return }
    if (file.size > 500 * 1024) { setMsg({ text: 'Logo může mít nejvýš 500 KB', error: true }); return }
    const res = await uploadAsset(clubAssetPath(club.id, file.type === 'image/png' ? 'png' : 'jpg'), file)
    if ('error' in res) throw new Error(res.error)
    const { error } = await supabase.from('clubs').update({ logo_url: res.url }).eq('id', club.id)
    if (error) throw new Error(error.message)
    if (storagePathFromUrl(club.logo_url) !== storagePathFromUrl(res.url)) await removeAssetByUrl(club.logo_url)
    return 'Logo nahráno'
  })

  const addPerson = () => run('person', async () => {
    const n = pName.trim()
    if (!n) { setMsg({ text: 'Zadej jméno hráče', error: true }); return }
    if (roster.some(p => normalizeName(p.name) === normalizeName(n))) { setMsg({ text: 'Hráč s tímto jménem už v soupisce je', error: true }); return }
    const num = pNumber.trim() ? parseInt(pNumber) : null
    const { error } = await supabase.from('persons').insert({ owner_id: ownerId, club_id: club.id, name: n, number: Number.isFinite(num) ? num : null })
    if (error) throw new Error(error.message)
    setPName(''); setPNumber('')
  })

  const updatePerson = (p: LibraryPerson, patch: Partial<LibraryPerson>) => run('person', async () => {
    if (patch.name !== undefined && !patch.name.trim()) { setMsg({ text: 'Jméno nesmí být prázdné', error: true }); return }
    const { error } = await supabase.from('persons').update(patch).eq('id', p.id)
    if (error) throw new Error(error.message)
  })

  // Odebrání ze soupisky klubu: osoba zůstává (historie hráče), jen bez klubu
  const removePerson = (p: LibraryPerson) => {
    const k = `rm-${p.id}`
    if (!isArmed(k)) { arm(k); return }
    arm(null)
    run('person', async () => {
      const { error } = await supabase.from('persons').update({ club_id: null }).eq('id', p.id)
      if (error) throw new Error(error.message)
      return `${p.name} odebrán ze soupisky`
    })
  }

  const merge = () => {
    const other = others.find(o => o.id === mergeId)
    if (!other) { setMsg({ text: 'Vyber klub ke sloučení', error: true }); return }
    if (!isArmed('merge')) { arm('merge'); return }
    arm(null)
    run('merge', async () => {
      const res = await mergeClubs(club.id, other.id)
      setMergeId('')
      return `Sloučeno: ${other.name} → ${club.name} (týmy ${res.teams}, hráči ${res.persons})`
    })
  }

  const remove = () => {
    if (!isArmed('delete')) { arm('delete'); return }
    arm(null)
    run('delete', async () => {
      const { error } = await supabase.from('clubs').delete().eq('id', club.id)
      if (error) throw new Error(error.message)
      await removeAssetByUrl(club.logo_url)
      onDeleted()
      return `Klub ${club.name} smazán`
    })
  }

  return (
    <div className="cl-d">
      <div className="cl-d__head" style={{ borderLeftColor: color }}>
        <label className="cl-d__logo" title="Nahrát logo (PNG/JPG, max 500 KB)">
          <TeamLogo team={{ name: club.name, color, logo_url: club.logo_url }} size={64} radius={8} />
          <span className="cl-d__logo-btn"><Upload size={13} /></span>
          <input type="file" accept="image/png,image/jpeg" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadLogo(f) }} />
        </label>
        <div className="cl-d__fields">
          <label className="field-label" htmlFor="cl-name">Název</label>
          <div className="cl-row">
            <input id="cl-name" className="field-input" value={name} onChange={e => setName(e.target.value)} />
            <input type="color" className="cl-color" value={color} onChange={e => setColor(e.target.value)} aria-label="Barva klubu" />
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={save} style={{ opacity: dirty && !busy ? 1 : 0.5 }}>Uložit</button>
          </div>
          {publicUrl && (
            <a className="cl-d__link" href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} />/k/{club.slug}
            </a>
          )}
        </div>
      </div>

      <h3 className="cl-h3">Soupiska <span className="cl-muted">({roster.length})</span></h3>
      <p className="cl-hint">Hráči se zkopírují do turnaje, když klub přidáš v Admin → Týmy → Přidat z knihovny.</p>
      <div className="cl-roster">
        {roster.map(p => (
          <div key={p.id} className="cl-person">
            <input
              className="field-input cl-person__num" defaultValue={p.number ?? ''} inputMode="numeric" aria-label={`Číslo — ${p.name}`}
              onBlur={e => {
                const v = e.target.value.trim(); const num = v ? parseInt(v) : null
                if ((Number.isFinite(num) ? num : null) !== p.number) updatePerson(p, { number: Number.isFinite(num) ? num : null })
              }}
            />
            <input
              className="field-input" defaultValue={p.name} aria-label="Jméno hráče"
              onBlur={e => { if (e.target.value.trim() !== p.name) updatePerson(p, { name: e.target.value.trim() }) }}
            />
            <select className="field-input field-select cl-person__role" value={p.role ?? ''} onChange={e => updatePerson(p, { role: e.target.value || null })} aria-label={`Role — ${p.name}`}>
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" className={`ui-btn ui-btn--sm ${isArmed(`rm-${p.id}`) ? 'ui-btn--danger' : 'ui-btn--ghost'}`} onClick={() => removePerson(p)} title="Odebrat ze soupisky">
              {isArmed(`rm-${p.id}`) ? 'Opravdu?' : <Trash2 size={14} />}
            </button>
          </div>
        ))}
        <form className="cl-person cl-person--new" onSubmit={e => { e.preventDefault(); addPerson() }}>
          <input className="field-input cl-person__num" placeholder="#" value={pNumber} onChange={e => setPNumber(e.target.value)} inputMode="numeric" aria-label="Číslo nového hráče" />
          <input className="field-input" placeholder="Jméno nového hráče" value={pName} onChange={e => setPName(e.target.value)} aria-label="Jméno nového hráče" />
          <button type="submit" className="ui-btn ui-btn--secondary ui-btn--sm" style={{ opacity: busy ? 0.6 : 1 }}><Plus size={14} />Přidat</button>
        </form>
      </div>

      {others.length > 0 && (
        <>
          <h3 className="cl-h3">Sloučit duplicitu</h3>
          <p className="cl-hint">Vznikl stejný klub dvakrát (např. z různých soutěží)? Vybraný klub se sloučí do tohoto: jeho týmy, historie a hráči přejdou sem, hráči se stejným jménem se spojí.</p>
          <div className="cl-row">
            <select className="field-input field-select" value={mergeId} onChange={e => { setMergeId(e.target.value); arm(null) }} aria-label="Klub ke sloučení">
              <option value="">Vyber klub…</option>
              {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button type="button" className={`ui-btn ui-btn--sm ${isArmed('merge') ? 'ui-btn--danger' : 'ui-btn--secondary'}`} onClick={merge} style={{ opacity: mergeId && !busy ? 1 : 0.5 }}>
              <Merge size={14} />{isArmed('merge') ? 'Opravdu sloučit?' : 'Sloučit sem'}
            </button>
          </div>
        </>
      )}

      <div className="cl-danger">
        <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={remove} style={{ opacity: busy ? 0.6 : 1 }}>
          <Trash2 size={14} />{isArmed('delete') ? 'Opravdu smazat klub?' : 'Smazat klub'}
        </button>
        <span className="cl-hint">Týmy v turnajích zůstanou, jen se odpojí od klubu.</span>
      </div>
    </div>
  )
}
