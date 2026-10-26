import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { SPORTS, getSportDef, type SportId } from '../lib/sports'
import { BRAND } from '../lib/brand'
import { useCompetitions } from '../hooks/useCompetitions'
import { carryOverTeams, nextEditionNumber } from '../lib/editions'
import {
  ArrowRight, CalendarDays, ChevronRight, GitBranch, Handshake, Lock, LogOut, MapPin, MonitorPlay,
  Newspaper, Plus, Radio, Share2, Smartphone, Target, Trophy,
} from 'lucide-react'

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
}

interface Props {
  onSelect: (tournamentId: string) => void
  onSelectCompetition?: (slug: string) => void
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export default function TournamentLanding({ onSelect, onSelectCompetition }: Props) {
  const { competitions } = useCompetitions()
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)

  // Login modal
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Create tournament modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newSport, setNewSport] = useState<SportId>('football')
  const [newMode, setNewMode] = useState<'day' | 'season'>('day')
  // Další ročník soutěže: '' = samostatný turnaj
  const [newCompetitionId, setNewCompetitionId] = useState('')
  const [newCarryOver, setNewCarryOver] = useState(true)
  const [slugManual, setSlugManual] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

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

  function handleNameChange(val: string) {
    setNewName(val)
    if (!slugManual) setNewSlug(toSlug(val))
  }

  function handleSlugChange(val: string) {
    setSlugManual(true)
    setNewSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

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
      setShowCreate(true)
      setEmail('')
      setPassword('')
    } catch {
      setLoginError('Chyba připojení. Zkuste znovu.')
    } finally {
      setLoggingIn(false)
    }
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
      const competition = competitions.find(c => c.id === newCompetitionId)
      const edition = competition ? await nextEditionNumber(competition.id) : null
      const res = await supabase
        .from('tournament')
        .insert({
          name: newName.trim(), slug: newSlug.trim(), sport: competition?.sport ?? newSport, owner_id: user?.id ?? null,
          // Nové sloupce (migrace 09) posílat jen když jsou potřeba — bez migrace jde založit běžný turnaj
          ...(newMode === 'season' ? { schedule_mode: 'season' } : {}),
          ...(competition ? { competition_id: competition.id, edition } : {}),
        })
        .select('id')
        .single()
      if (res.error) {
        setCreateError(res.error.message.includes('unique') ? 'Slug již existuje, zvol jiný.' : res.error.message)
        return
      }
      data = res.data
      // Převzít týmy a soupisky z posledního ročníku soutěže
      if (competition && newCarryOver) {
        const prev = tournaments
          .filter(t => t.competition_id === competition.id && t.id !== data!.id)
          .sort((a, b) => (b.edition ?? 0) - (a.edition ?? 0))[0]
        if (prev) {
          try { await carryOverTeams(prev.id, data.id, competition.id) }
          catch (e) { setCreateError('Turnaj založen, ale převzetí týmů selhalo: ' + (e instanceof Error ? e.message : String(e))) }
        }
      }
    } finally {
      setCreating(false)
    }
    if (!data) return
    setShowCreate(false)
    setNewName('')
    setNewSlug('')
    setNewSport('football')
    setNewMode('day')
    setNewCompetitionId('')
    setSlugManual(false)
    window.history.pushState({ tournamentId: data.id }, '', `/${data.id}`)
    onSelect(data.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const featured = tournaments[0]

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
                <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => { setShowCreate(true); setCreateError('') }}>
                  <Plus size={15} />Nový turnaj
                </button>
                <button type="button" className="ui-btn ui-btn--chrome ui-btn--sm" onClick={handleLogout}>
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
              <a className="ui-btn ui-btn--primary" href="#turnaje">Prohlédnout turnaje<ArrowRight size={16} /></a>
              {!session && (
                <button type="button" className="ui-btn ui-btn--chrome" onClick={() => { setShowLogin(true); setLoginError('') }}>
                  Přihlášení pořadatele
                </button>
              )}
            </div>
            <div className="lp-hero__sports">
              {SPORTS.map(s => {
                const Icon = s.Icon
                return <span key={s.id}><Icon size={16} />{s.label}</span>
              })}
              <span className="lp-hero__soon">další sporty brzy</span>
            </div>
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
            <p>Od rozlosování po vyhlášení vítěze — bez tabulek v Excelu a bez instalace.</p>
          </div>
          <div className="lp-features">
            {[
              { icon: Radio, title: 'Živé výsledky', text: 'Výsledky, tabulky a střelci se aktualizují okamžitě na všech zařízeních.' },
              { icon: MonitorPlay, title: 'TV tabule a kiosk', text: 'Broadcast obrazovka pro projektor v hale s hodinami, QR kódem a partnery.' },
              { icon: Handshake, title: 'Partneři a branding', text: 'Úrovně partnerů, „presented by“, vlastní barvy turnaje a loga všude, kde to má smysl.' },
              { icon: Share2, title: 'Grafiky na sociální sítě', text: 'Jedním klikem výsledek, tabulka nebo střelci jako hotový obrázek pro Instagram a Facebook.' },
              { icon: GitBranch, title: 'Skupiny, liga i play-off', text: 'Jedenáct formátů turnaje, automatický rozpis, postup v pavouku a vyhodnocení.' },
              { icon: Target, title: 'Tipovačka', text: 'Hráči a fanoušci tipují výsledky — body se počítají automaticky.' },
              { icon: Newspaper, title: 'Mediální servis', text: 'Kontakt pro novináře, loga ke stažení a výsledky v Excelu i k tisku.' },
              { icon: Smartphone, title: 'Mobil na prvním místě', text: 'Funguje v každém prohlížeči, bez aplikace a bez registrace diváků.' },
            ].map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="lp-feature">
                  <span className="lp-feature__icon"><Icon size={20} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              )
            })}
          </div>
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

      {/* ── Turnaje ─────────────────────────────────── */}
      <section className="lp-section lp-section--alt" id="turnaje">
        <div className="lp-wrap">
          <div className="lp-section__head">
            <h2>Turnaje</h2>
            <p>{featured ? 'Vyberte turnaj a sledujte výsledky živě.' : 'Seznam turnajů na platformě.'}</p>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '2rem 0' }}>
              <div className="spinner" />
              <p style={{ marginTop: '.75rem', fontSize: '.9rem' }}>Načítám…</p>
            </div>
          )}

          {!loading && error && <div className="warn-box" style={{ textAlign: 'center' }}>{error}</div>}

          {!loading && !error && tournaments.length === 0 && (
            <div className="ui-empty"><div className="ui-empty__text">Zatím zde nejsou žádné turnaje.</div></div>
          )}

          {!loading && !error && tournaments.length > 0 && (
            <div className="lp-tournaments">
              {tournaments.map(t => {
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
                      <div className="lp-tcard__sport"><Icon size={12} />{sport.label}{t.edition && t.competition_id ? ` · ${t.edition}. ročník` : ''}</div>
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
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__inner">
          <span className="lp-brand__name" style={{ fontSize: '1.1rem' }}>{BRAND.name}</span>
          <span>{BRAND.tagline}</span>
        </div>
      </footer>

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

      {/* ── Nový turnaj ────────────────────────────── */}
      {showCreate && (
        <div className="lp-modal" onClick={() => setShowCreate(false)}>
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
              {competitions.filter(c => c.sport === newSport).length > 0 && (
                <div>
                  <label className="field-label">Soutěž</label>
                  <select className="field-input field-select" value={newCompetitionId} onChange={e => setNewCompetitionId(e.target.value)}>
                    <option value="">Samostatný turnaj</option>
                    {competitions.filter(c => c.sport === newSport).map(c => (
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
              <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={() => setShowCreate(false)}>
                Zrušit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
