import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SPORTS, getSportDef, type SportId } from '../lib/sports'
import { BRAND, contactHref } from '../lib/brand'
import { useCompetitions } from '../hooks/useCompetitions'
import { useAuthRole } from '../hooks/useAuthRole'
import { lazyComponent } from '../lib/lazyComponent'
import { FEATURES, type DemoKey } from '../demo/features'
import SiteFooter from './layout/SiteFooter'
import AccessCodeForm from './ui/AccessCodeForm'
import { isOngoing, searchTournaments, shiftISO } from '../lib/tournamentSearch'
import { todayISO } from '../lib/dates'
import {
  ArrowRight, CalendarDays, KeyRound, LayoutDashboard, Search, ChevronRight, Lock, LogOut, Mail, MapPin, Trophy,
} from 'lucide-react'

const contact = contactHref()

const DemoModal = lazyComponent(() => import('../demo/DemoModal'))

interface TournamentSummary {
  id: string
  name: string
  subtitle: string
  date: string
  venue: string
  sport: SportId
  logo_url?: string | null
  competition_id?: string | null
  edition?: number | null
  owner_id?: string | null
  tips_lock_from?: string | null
  schedule_mode?: 'day' | 'season' | null
  visibility?: 'public' | 'private'
}

interface Props {
  onSelect: (tournamentId: string) => void
  onSelectCompetition?: (slug: string) => void
  /** Můj prostor organizátora (/moje) */
  onOpenOrganizer?: () => void
}

export default function TournamentLanding({ onSelect, onSelectCompetition, onOpenOrganizer }: Props) {
  const { competitions } = useCompetitions()
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { session, canEditTournament } = useAuthRole()
  const [demo, setDemo] = useState<DemoKey | null>(null)

  // Login modal
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Vyhledávání a přístupový kód
  const [query, setQuery] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [activeSeasons, setActiveSeasons] = useState<Set<string>>(new Set())

  // Load tournaments
  useEffect(() => {
    supabase.from('tournament')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('Nepodařilo se načíst turnaje.')
        else setTournaments(data ?? [])
        setLoading(false)
      })
  }, [])

  // Sezóny se zápasem v okně ±14 dní → „Právě probíhá“
  useEffect(() => {
    const seasonIds = tournaments.filter(t => t.schedule_mode === 'season').map(t => t.id)
    if (!seasonIds.length) return
    const today = todayISO()
    supabase.from('matches').select('tournament_id').in('tournament_id', seasonIds)
      .gte('match_date', shiftISO(today, -14)).lte('match_date', shiftISO(today, 14))
      .then(({ data, error: err }) => {
        if (!err) setActiveSeasons(new Set((data ?? []).map(m => m.tournament_id as string)))
      })
  }, [tournaments])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (resetLoading) return
    setResetLoading(true); setLoginError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) { setLoginError(error.message); return }
      setResetSent(true)
    } finally {
      setResetLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loggingIn) return
    setLoginError('')
    setLoggingIn(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setLoginError(err.message); return }
      setShowLogin(false)
      onOpenOrganizer?.()
      setEmail('')
      setPassword('')
    } catch {
      setLoginError('Chyba připojení. Zkuste znovu.')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function renderCard(t: TournamentSummary) {
    const sport = getSportDef(t.sport)
    const Icon = sport.Icon
    return (
      <button
        key={t.id}
        type="button"
        className="lp-tcard"
        onClick={() => {
          window.history.pushState({ tournamentId: t.id }, '', `/${t.id}`)
          onSelect(t.id)
        }}
      >
        <div className="lp-tcard__crest">
          {t.logo_url ? <img src={t.logo_url} alt="" /> : <Icon size={28} strokeWidth={1.5} />}
        </div>
        <div className="lp-tcard__body">
          <div className="lp-tcard__sport">
            <Icon size={12} />{sport.label}{t.edition && t.competition_id ? ` · ${t.edition}. ročník` : ''}
            {t.visibility === 'private' && <span className="lp-tcard__mine"><Lock size={10} /> Soukromý</span>}
            {canEditTournament(t.owner_id) && <span className="lp-tcard__mine">Spravujete</span>}
          </div>
          <div className="lp-tcard__name">{t.name || '(bez názvu)'}</div>
          {t.subtitle && <div className="lp-tcard__sub">{t.subtitle}</div>}
          <div className="lp-tcard__meta">
            {t.date && <span><CalendarDays size={13} />{t.date}</span>}
            {t.venue && <span><MapPin size={13} />{t.venue}</span>}
          </div>
        </div>
        <ChevronRight size={18} className="lp-tcard__chev" />
      </button>
    )
  }


  return (
    <div className="lp">
      {/* ── Horní lišta ─────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-wrap lp-nav__inner">
          <div className="lp-brand">
            <span className="lp-brand__mark"><Trophy size={18} /></span>
            <span className="lp-brand__name">{BRAND.name}</span>
          </div>
          <div className="lp-nav__actions">
            {session ? (
              <>
                <span className="lp-nav__user hide-mobile">{session.user.email}</span>
                <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={onOpenOrganizer} title="Můj prostor" aria-label="Můj prostor">
                  <LayoutDashboard size={15} /><span className="hide-mobile">Můj prostor</span>
                </button>
                <button type="button" className="ui-btn ui-btn--chrome ui-btn--sm" onClick={handleLogout} title="Odhlásit" aria-label="Odhlásit">
                  <LogOut size={15} /><span className="hide-mobile">Odhlásit</span>
                </button>
              </>
            ) : (
              <button type="button" className="ui-btn ui-btn--chrome ui-btn--sm" onClick={() => { setShowLogin(true); setLoginError('') }}>
                <Lock size={14} />Pro pořadatele
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero__inner">
          <div className="lp-hero__copy">
            <div className="lp-eyebrow">Platforma pro firemní a amatérské turnaje</div>
            <h1 className="lp-hero__title">Turnaj, který vypadá jako velká liga.</h1>
            <p className="lp-hero__lead">
              Rozpis, živé výsledky, tabulky, play-off a statistiky na jednom místě — na mobilu,
              na webu i na velké obrazovce v hale. Profesionální prezentace pro hráče, diváky i partnery.
            </p>
            <div className="lp-hero__cta">
              {contact && <a className="ui-btn ui-btn--primary" href={contact}><Mail size={16} />Chci turnaj</a>}
              <a className={contact ? 'ui-btn ui-btn--chrome' : 'ui-btn ui-btn--primary'} href="#turnaje">Najít turnaj<ArrowRight size={16} /></a>
              {!session && (
                <button type="button" className="ui-btn ui-btn--chrome" onClick={() => { setShowLogin(true); setLoginError('') }}>
                  Přihlášení pořadatele
                </button>
              )}
            </div>
            {/* Informace, ne tlačítka: sporty v textu, bez rámečků */}
            <p className="lp-hero__sports">
              Pro turnaje a ligy ve sportech
              {SPORTS.map((sp, i) => {
                const Icon = sp.Icon
                return (
                  <span key={sp.id} className="lp-hero__sport">
                    {i > 0 && <span className="lp-hero__and">{i === SPORTS.length - 1 ? 'a' : ','}</span>}
                    <Icon size={18} />{sp.label.toLowerCase()}
                  </span>
                )
              })}
            </p>
          </div>

          {/* Ukázka výsledkové tabule */}
          <div className="lp-board" aria-hidden="true">
            <div className="lp-board__head">
              <span className="lp-board__live"><span className="ui-live-dot" />Živě</span>
              <span>Skupina A · 2. kolo</span>
              <span className="lp-board__clock">18:42</span>
            </div>
            {[
              { h: 'FC Severka', a: 'SK Lokomotiva', hs: 3, as: 2, live: true },
              { h: 'Dynamo Jih', a: 'Sokol Východ', hs: 1, as: 1, live: false },
              { h: 'HC Rysi', a: 'HC Orli', hs: 4, as: 3, live: false, ot: true },
            ].map((m, i) => (
              <div key={i} className={m.live ? 'lp-board__row lp-board__row--live' : 'lp-board__row'}>
                <span className="lp-board__team lp-board__team--home">{m.h}</span>
                <span className="lp-board__score"><b>{m.hs}</b><b>{m.as}</b></span>
                <span className="lp-board__team">{m.a}{m.ot && <em>PP</em>}</span>
              </div>
            ))}
            <div className="lp-board__foot">
              <span>Partneři</span>
              <i /><i /><i /><i />
            </div>
          </div>
        </div>
      </section>

      {/* ── Funkce ──────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-section__head">
            <h2>Vše, co pořadatel potřebuje</h2>
            <p>Od rozlosování po vyhlášení vítěze — pro {SPORTS.map(sp => sp.label.toLowerCase()).join(' i ')}, bez tabulek v Excelu a bez instalace.</p>
          </div>
          <div className="lp-features">
            {FEATURES.map(f => {
              const Icon = f.icon
              return (
                <button key={f.key} type="button" className="lp-feature lp-feature--demo" onClick={() => setDemo(f.key)}>
                  <span className="lp-feature__icon"><Icon size={20} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <span className="lp-feature__more">Ukázka<ChevronRight size={14} /></span>
                </button>
              )
            })}
          </div>
          {contact && (
            <div className="lp-cta-band">
              <div>
                <h3>Chcete vlastní turnaj?</h3>
                <p>Napište nám — turnaj připravíme a pomůžeme s nastavením.</p>
              </div>
              <a className="ui-btn ui-btn--primary" href={contact}><Mail size={16} />Chci turnaj</a>
            </div>
          )}
        </div>
      </section>

      {/* ── Soutěže ─────────────────────────────────── */}
      {competitions.length > 0 && (
        <section className="lp-section" id="souteze">
          <div className="lp-wrap">
            <div className="lp-section__head">
              <h2>Soutěže</h2>
              <p>Ligy a turnaje s více ročníky — síň vítězů, věčná tabulka a rekordy.</p>
            </div>
            <div className="lp-tournaments">
              {competitions.map(c => {
                const sport = getSportDef(c.sport)
                const Icon = sport.Icon
                const eds = tournaments.filter(t => t.competition_id === c.id)
                return (
                  <button key={c.id} type="button" className="lp-tcard" onClick={() => onSelectCompetition?.(c.slug)}>
                    <div className="lp-tcard__crest">
                      {c.logo_url ? <img src={c.logo_url} alt="" /> : <Icon size={28} strokeWidth={1.5} />}
                    </div>
                    <div className="lp-tcard__body">
                      <div className="lp-tcard__sport"><Icon size={12} />{sport.label} · soutěž</div>
                      <div className="lp-tcard__name">{c.name}</div>
                      <div className="lp-tcard__meta"><span>{eds.length} {eds.length === 1 ? 'ročník' : eds.length >= 2 && eds.length <= 4 ? 'ročníky' : 'ročníků'}</span></div>
                    </div>
                    <ChevronRight size={18} className="lp-tcard__chev" />
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Turnaje: vyhledávání, právě probíhá, moje ── */}
      <section className="lp-section lp-section--alt" id="turnaje">
        <div className="lp-wrap">
          <div className="lp-section__head">
            <h2>Najít turnaj</h2>
            <p>Vyhledejte veřejný turnaj podle názvu nebo místa. Soukromý otevřete přístupovým kódem od pořadatele.</p>
          </div>

          <div className="lp-find">
            <label className="lp-find__search">
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Název turnaje, místo…"
                aria-label="Hledat turnaj"
              />
            </label>
            <button type="button" className={showCode ? 'ui-btn ui-btn--primary' : 'ui-btn ui-btn--secondary'} onClick={() => setShowCode(v => !v)}>
              <KeyRound size={16} />Mám přístupový kód
            </button>
          </div>
          {showCode && (
            <div className="lp-find__code">
              <AccessCodeForm autoFocus onUnlocked={id => { window.history.pushState({ tournamentId: id }, '', `/${id}`); onSelect(id) }} />
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '2rem 0' }}>
              <div className="spinner" />
              <p style={{ marginTop: '.75rem', fontSize: '.9rem' }}>Načítám…</p>
            </div>
          )}

          {!loading && error && <div className="warn-box" style={{ textAlign: 'center' }}>{error}</div>}

          {!loading && !error && (() => {
            const q = query.trim()
            if (q.length >= 2) {
              const found = searchTournaments(tournaments, q)
              return (
                <div className="lp-tgroup">
                  <h3 className="lp-tgroup__title">Výsledky hledání</h3>
                  {found.length
                    ? <div className="lp-tournaments">{found.map(renderCard)}</div>
                    : <p className="lp-tgroup__empty">Nic jsme nenašli. Zkuste jiný název, nebo zadejte přístupový kód.</p>}
                </div>
              )
            }
            const today = todayISO()
            const live = tournaments.filter(t => isOngoing(t, today, activeSeasons))
            return (
              <div className="lp-tgroup">
                <h3 className="lp-tgroup__title"><span className="ui-live-dot" />Právě probíhá</h3>
                {live.length
                  ? <div className="lp-tournaments">{live.map(renderCard)}</div>
                  : <p className="lp-tgroup__empty">Dnes se nehraje žádný veřejný turnaj. Vyhledejte turnaj podle názvu.</p>}
              </div>
            )
          })()}

        </div>
      </section>

      <SiteFooter />

      {/* ── Ukázka funkce (demo) ─────────────────────── */}
      {demo && <DemoModal initial={demo} onClose={() => setDemo(null)} />}

      {/* ── Přihlášení ─────────────────────────────── */}
      {showLogin && (
        <div className="lp-modal" onClick={() => { setShowLogin(false); setResetMode(false); setResetSent(false); setLoginError('') }}>
          <div className="lp-modal__panel" onClick={e => e.stopPropagation()}>
            <h2 className="lp-modal__title">{resetMode ? 'Reset hesla' : 'Přihlášení pořadatele'}</h2>

            {resetSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div className="info-box" style={{ marginBottom: 0 }}>
                  E-mail s odkazem pro reset hesla byl odeslán na <strong>{email}</strong>. Zkontroluj schránku (včetně spamu).
                </div>
                <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={() => { setResetMode(false); setResetSent(false); setLoginError('') }}>
                  Zpět na přihlášení
                </button>
              </div>
            ) : resetMode ? (
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <p style={{ fontSize: '.9rem', color: 'var(--ink-muted)', margin: 0 }}>
                  Zadej svůj e-mail a pošleme ti odkaz pro nastavení nového hesla.
                </p>
                <input className="field-input" type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                {loginError && <p className="lp-modal__err">{loginError}</p>}
                <button type="submit" className="ui-btn ui-btn--primary ui-btn--block" style={{ opacity: resetLoading ? 0.6 : 1 }}>
                  {resetLoading ? 'Odesílám…' : 'Odeslat odkaz'}
                </button>
                <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={() => { setResetMode(false); setLoginError('') }}>
                  Zpět
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div>
                  <label className="field-label">E-mail</label>
                  <input className="field-input" type="email" placeholder="admin@firma.cz" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="field-label">Heslo</label>
                  <input className="field-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                {loginError && <p className="lp-modal__err">{loginError}</p>}
                <button type="submit" className="ui-btn ui-btn--primary ui-btn--block" style={{ opacity: loggingIn ? 0.6 : 1 }}>
                  {loggingIn ? 'Přihlašuji…' : 'Přihlásit se'}
                </button>
                <button type="button" className="lp-modal__link" onClick={() => { setResetMode(true); setLoginError('') }}>
                  Zapomenuté heslo?
                </button>
                <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={() => setShowLogin(false)}>
                  Zrušit
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
