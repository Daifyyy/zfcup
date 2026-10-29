// Můj prostor organizátora (/moje): turnaje, soutěže, knihovna klubů, nový turnaj, platforma.
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ExternalLink, Landmark, Lock, LogOut, Plus, Settings, Settings2, Shield, Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { getSportDef } from '../../lib/sports'
import { useAuthRole } from '../../hooks/useAuthRole'
import { useCompetitions } from '../../hooks/useCompetitions'
import { lazyComponent } from '../../lib/lazyComponent'
import SiteFooter from '../layout/SiteFooter'

const ClubLibrary = lazyComponent(() => import('../clubs/ClubLibrary'))
const CreateTournamentModal = lazyComponent(() => import('./CreateTournamentModal'))
const PlatformModal = lazyComponent(() => import('./PlatformModal'))

interface MyTournament {
  id: string
  name: string
  subtitle: string | null
  date: string | null
  venue: string | null
  sport: string
  logo_url: string | null
  competition_id: string | null
  edition: number | null
  owner_id: string | null
  visibility?: 'public' | 'private'
  created_at: string
}

interface Props {
  onHome: () => void
  /** admin = otevřít rovnou administraci */
  onOpenTournament: (id: string, opts?: { admin?: boolean }) => void
  onOpenCompetition: (slug: string) => void
}

export default function OrganizerHome({ onHome, onOpenTournament, onOpenCompetition }: Props) {
  const { session, userId, isPlatformAdmin, ready } = useAuthRole()
  const { competitions } = useCompetitions()
  const [tournaments, setTournaments] = useState<MyTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'clubs' | 'platform' | null>(null)

  useEffect(() => { document.title = `Můj prostor · ${BRAND.name}` }, [])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false
    let q = supabase.from('tournament')
      .select('id,name,subtitle,date,venue,sport,logo_url,competition_id,edition,owner_id,visibility,created_at')
      .order('created_at', { ascending: false })
    if (!isPlatformAdmin) q = q.eq('owner_id', userId)
    q.then(({ data, error }) => {
      if (cancelled) return
      if (!error) setTournaments((data ?? []) as MyTournament[])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [userId, isPlatformAdmin])

  const myCompetitions = useMemo(
    () => competitions.filter(c => isPlatformAdmin || c.owner_id === userId),
    [competitions, isPlatformAdmin, userId],
  )
  const editionsOf = (cid: string) => tournaments.filter(t => t.competition_id === cid)

  if (ready && !session) {
    return (
      <div className="lp">
        <div className="lp-wrap" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', textTransform: 'uppercase' }}>Můj prostor</h1>
          <p style={{ color: 'var(--ink-muted)' }}>Stránka je pro přihlášené pořadatele.</p>
          <button type="button" className="ui-btn ui-btn--primary" onClick={onHome}><ChevronLeft size={16} />Na úvodní stránku</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav__inner">
          <button type="button" className="lp-brand org-brand" onClick={onHome} title="Úvodní stránka">
            <span className="lp-brand__mark"><Trophy size={18} /></span>
            <span className="lp-brand__name">{BRAND.name}</span>
          </button>
          <div className="lp-nav__actions">
            <span className="lp-nav__user hide-mobile">{session?.user.email}</span>
            <button type="button" className="ui-btn ui-btn--chrome ui-btn--sm" onClick={() => supabase.auth.signOut().then(onHome)} title="Odhlásit" aria-label="Odhlásit">
              <LogOut size={15} /><span className="hide-mobile">Odhlásit</span>
            </button>
          </div>
        </div>
      </header>

      <section className="org-hero">
        <div className="lp-wrap">
          <div className="lp-eyebrow">Pořadatel</div>
          <h1 className="org-hero__title">Můj prostor</h1>
          <div className="org-tiles">
            <button type="button" className="org-tile org-tile--primary" onClick={() => setModal('create')}>
              <Plus size={22} /><b>Nový turnaj</b><span>Turnaj, liga nebo další ročník soutěže</span>
            </button>
            <a className="org-tile" href="#moje-turnaje">
              <Trophy size={22} /><b>Moje turnaje</b><span>{loading ? '…' : `${tournaments.length} ${tournaments.length === 1 ? 'turnaj' : tournaments.length < 5 ? 'turnaje' : 'turnajů'}`}</span>
            </a>
            <a className="org-tile" href="#souteze">
              <Landmark size={22} /><b>Soutěže a ročníky</b><span>{myCompetitions.length} {myCompetitions.length === 1 ? 'soutěž' : myCompetitions.length < 5 ? 'soutěže' : 'soutěží'}</span>
            </a>
            <button type="button" className="org-tile" onClick={() => setModal('clubs')}>
              <Shield size={22} /><b>Knihovna klubů</b><span>Kluby a soupisky pro další turnaje</span>
            </button>
            {isPlatformAdmin && (
              <button type="button" className="org-tile" onClick={() => setModal('platform')}>
                <Settings2 size={22} /><b>Platforma</b><span>Globální nastavení (správce)</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <main className="lp-wrap org-main">
        <section id="moje-turnaje" className="org-sec">
          <h2 className="org-sec__title">{isPlatformAdmin ? 'Všechny turnaje' : 'Moje turnaje'}</h2>
          {loading && <div className="spinner" />}
          {!loading && tournaments.length === 0 && (
            <p className="org-empty">Zatím nemáte žádný turnaj. Založte první tlačítkem <strong>Nový turnaj</strong>.</p>
          )}
          <div className="org-list">
            {tournaments.map(t => {
              const sport = getSportDef(t.sport)
              const Icon = sport.Icon
              return (
                <div key={t.id} className="org-item">
                  <div className="lp-tcard__crest">{t.logo_url ? <img src={t.logo_url} alt="" /> : <Icon size={26} strokeWidth={1.5} />}</div>
                  <div className="org-item__body">
                    <div className="lp-tcard__sport">
                      <Icon size={12} />{sport.label}{t.edition && t.competition_id ? ` · ${t.edition}. ročník` : ''}
                      {t.visibility === 'private' && <span className="lp-tcard__mine"><Lock size={10} /> Soukromý</span>}
                    </div>
                    <div className="lp-tcard__name">{t.name || '(bez názvu)'}</div>
                    <div className="lp-tcard__sub">{[t.date, t.venue].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="org-item__actions">
                    <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => onOpenTournament(t.id, { admin: true })}>
                      <Settings size={14} />Spravovat
                    </button>
                    <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => onOpenTournament(t.id)}>
                      <ExternalLink size={14} />Otevřít
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section id="souteze" className="org-sec">
          <h2 className="org-sec__title">Soutěže a ročníky</h2>
          {myCompetitions.length === 0 ? (
            <p className="org-empty">Soutěž vznikne, když turnaj zařadíte jako ročník (Administrace → Nastavení → Soutěž a ročník).</p>
          ) : (
            <div className="org-list">
              {myCompetitions.map(c => {
                const eds = editionsOf(c.id).sort((a, b) => (b.edition ?? 0) - (a.edition ?? 0))
                return (
                  <div key={c.id} className="org-item">
                    <div className="lp-tcard__crest"><Landmark size={24} /></div>
                    <div className="org-item__body">
                      <div className="lp-tcard__name">{c.name}</div>
                      <div className="lp-tcard__sub">{eds.length} {eds.length === 1 ? 'ročník' : eds.length < 5 ? 'ročníky' : 'ročníků'}{eds[0] ? ` · poslední: ${eds[0].name}` : ''}</div>
                    </div>
                    <div className="org-item__actions">
                      {eds[0] && (
                        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => onOpenTournament(eds[0].id, { admin: true })}>
                          <Settings size={14} />Poslední ročník
                        </button>
                      )}
                      <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => onOpenCompetition(c.slug)}>
                        <Landmark size={14} />Historie
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />

      {modal === 'create' && (
        <CreateTournamentModal onClose={() => setModal(null)} onCreated={id => { setModal(null); onOpenTournament(id, { admin: true }) }} />
      )}
      {modal === 'clubs' && session && <ClubLibrary ownerId={session.user.id} onClose={() => setModal(null)} />}
      {modal === 'platform' && isPlatformAdmin && <PlatformModal onClose={() => setModal(null)} />}
    </div>
  )
}
