import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { useTournament } from './hooks/useTournament'
import { useTeams } from './hooks/useTeams'
import { usePlayers } from './hooks/usePlayers'
import { useGroups } from './hooks/useGroups'
import { useMatches } from './hooks/useMatches'
import { useGoals } from './hooks/useGoals'
import { useAssists } from './hooks/useAssists'
import { useBracketAssists } from './hooks/useBracketAssists'
import { useCards } from './hooks/useCards'
import { useBracketCards } from './hooks/useBracketCards'
import { usePenalties } from './hooks/usePenalties'
import { useBracketPenalties } from './hooks/useBracketPenalties'
import { useBracket } from './hooks/useBracket'
import { useBracketGoals } from './hooks/useBracketGoals'
import { useAnnouncements } from './hooks/useAnnouncements'
import { useRuleItems } from './hooks/useRuleItems'
import { useReferees } from './hooks/useReferees'
import { useSponsors } from './hooks/useSponsors'
import { useCompetitions, useCompetitionEditions } from './hooks/useCompetitions'
import { useAuthRole } from './hooks/useAuthRole'
import { usePlatformSettings } from './hooks/usePlatformSettings'
import { TournamentProvider } from './lib/TournamentContext'
import { TournamentDataContext, type TournamentData } from './lib/TournamentDataContext'
import DetailHost from './components/public/DetailHost'
import Header, { HEADER_HEIGHT_DESKTOP } from './components/layout/Header'
import { BRAND } from './lib/brand'
import { sortByTier, getTitlePartner } from './lib/partners'
import { applyTournamentTheme } from './lib/theme'
import BottomNav from './components/layout/BottomNav'
import Overview from './components/public/Overview'
import Teams from './components/public/Teams'
import Results from './components/public/Results'
import Standings from './components/public/Standings'
import Statistics from './components/public/Statistics'
import Bracket from './components/public/Bracket'
import Info from './components/public/Info'
import Rules from './components/public/Rules'
import Tips from './components/public/Tips'
import Sponsors from './components/public/Sponsors'
import Media from './components/public/Media'
import Toast from './components/ui/Toast'
import { TournamentSkeleton } from './components/ui/TournamentSkeleton'
import TournamentLanding from './components/TournamentLanding'
import PasswordResetOverlay from './components/PasswordResetOverlay'
import type { Session } from '@supabase/supabase-js'

import type { Sponsor } from './hooks/useSponsors'
import { lazyComponent } from './lib/lazyComponent'
import { detectLegalDocFromUrl, type LegalDoc } from './lib/legal'
import SiteFooter from './components/layout/SiteFooter'

const PrintBulletin = lazyComponent(() => import('./components/public/PrintBulletin'))
const AdminPanel = lazyComponent(() => import('./components/admin/AdminPanel'))
const KioskMode = lazyComponent(() => import('./components/kiosk/KioskMode'))
const LegalPage = lazyComponent(() => import('./components/legal/LegalPage'))
const Scoreboard = lazyComponent(() => import('./components/public/Scoreboard'))
const CompetitionPage = lazyComponent(() => import('./components/competition/CompetitionPage'))
const ClubPage = lazyComponent(() => import('./components/club/ClubPage'))

function SponsorSidebarLogo({ sponsor }: { sponsor: Sponsor }) {
  const img = sponsor.logo_url ? (
    <img src={sponsor.logo_url} alt={sponsor.name} title={sponsor.name} style={{ width: 120, height: 90, objectFit: 'contain' }} />
  ) : (
    <div style={{ width: 120, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 6, textAlign: 'center', padding: '.25rem', fontFamily: 'var(--font-body)' }}>
      {sponsor.name}
    </div>
  )
  if (sponsor.website_url) {
    return <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>{img}</a>
  }
  return img
}

// Detect tournamentId from URL path: first non-empty segment is treated as tournament id.
// E.g. /abc123 → 'abc123'; / → ''
function detectTournamentIdFromUrl(): string {
  const segments = window.location.pathname.split('/').filter(Boolean)
  if (segments[0] === 's' || segments[0] === 'k' || segments[0] === 'pravni') return ''
  return segments[0] ?? ''
}

// /s/{slug} → stránka soutěže
function detectCompetitionSlugFromUrl(): string {
  const segments = window.location.pathname.split('/').filter(Boolean)
  return segments[0] === 's' ? (segments[1] ?? '') : ''
}

// /k/{slug} → stránka klubu
function detectClubSlugFromUrl(): string {
  const segments = window.location.pathname.split('/').filter(Boolean)
  return segments[0] === 'k' ? (segments[1] ?? '') : ''
}

export type Tab = 'overview' | 'teams' | 'results' | 'standings' | 'statistics' | 'bracket' | 'info' | 'rules' | 'tips' | 'sponsors' | 'media'
const VALID_TABS: Tab[] = ['overview', 'teams', 'results', 'standings', 'statistics', 'bracket', 'info', 'rules', 'tips', 'sponsors', 'media']

export default function App() {
  const [tournamentId, setTournamentId] = useState<string>(() => detectTournamentIdFromUrl())
  const [competitionSlug, setCompetitionSlug] = useState<string>(() => detectCompetitionSlugFromUrl())
  const [clubSlug, setClubSlug] = useState<string>(() => detectClubSlugFromUrl())
  const [legalDoc, setLegalDoc] = useState<LegalDoc | ''>(() => detectLegalDocFromUrl())
  const [tab, setTab] = useState<Tab>('overview')
  const [adminOpen, setAdminOpen] = useState(false)
  const [kiosk, setKiosk] = useState(() => new URLSearchParams(window.location.search).get('kiosk') === '1')
  const [scoreboard, setScoreboard] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  // When no tournamentId, pass empty string so hooks skip fetching
  const { tournament, notFound: tournamentNotFound, refetch: refetchTournament } = useTournament(tournamentId)
  const { teams, loading: teamsLoading, refetch: refetchTeams } = useTeams(tournamentId)
  const { players, refetch: refetchPlayers } = usePlayers(tournamentId)
  const { groups, loading: groupsLoading, refetch: refetchGroups } = useGroups(tournamentId)
  const { matches, loading: matchesLoading, refetch: refetchMatches } = useMatches(tournamentId)
  const { goals, refetch: refetchGoals } = useGoals(tournamentId)
  const { assists, refetch: refetchAssists } = useAssists(tournamentId)
  const { bracketAssists, refetch: refetchBracketAssists } = useBracketAssists(tournamentId)
  const { cards, refetch: refetchCards } = useCards(tournamentId)
  const { bracketCards, refetch: refetchBracketCards } = useBracketCards(tournamentId)
  const { penalties, refetch: refetchPenalties } = usePenalties(tournamentId)
  const { bracketPenalties, refetch: refetchBracketPenalties } = useBracketPenalties(tournamentId)
  const { rounds: bracketRounds, slots: bracketSlots, loading: bracketLoading, refetch: refetchBracket } = useBracket(tournamentId)
  const { bracketGoals, refetch: refetchBracketGoals } = useBracketGoals(tournamentId)
  const { announcements, refetch: refetchAnnouncements } = useAnnouncements(tournamentId)
  const { ruleItems, refetch: refetchRuleItems } = useRuleItems(tournamentId)
  const { referees, refetch: refetchReferees } = useReferees(tournamentId)
  const { sponsors, refetch: refetchSponsors } = useSponsors(tournamentId)
  const { competitions } = useCompetitions()
  const { editions: competitionEditions } = useCompetitionEditions(tournament?.id === tournamentId ? (tournament?.competition_id ?? '') : '')
  const { session, isPlatformAdmin, canEditTournament } = useAuthRole()
  const platform = usePlatformSettings()
  // Organizátor spravuje jen své turnaje, správce platformy všechny
  const canEdit = !!tournament && canEditTournament(tournament.owner_id)
  // Tipovačka: globální vypínač správce platformy AND přepínač turnaje
  const tipsOn = platform.tipsEnabled && (tournament?.tips_enabled ?? false)

  // ── Auth ──────────────────────────────────────────────
  useEffect(() => {
    // Session a role drží useAuthRole; tady jen obnova hesla z e-mailu
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); setAdminOpen(true) }
      if (e.key === 'Escape' && adminOpen) setAdminOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [adminOpen])

  // ── Kiosk URL sync ────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href)
    if (kiosk) url.searchParams.set('kiosk', '1')
    else url.searchParams.delete('kiosk')
    window.history.replaceState({ tab }, '', url.toString())
  }, [kiosk, tab])

  // ── Přepnutí turnaje: zavřít překryvy předchozího (admin, tisk, tabule) ──
  useEffect(() => {
    setAdminOpen(false)
    setPrintOpen(false)
    setScoreboard(false)
  }, [tournamentId])

  // ── Historie prohlížeče (tlačítko Zpět, i na Androidu) ──
  // Jediný handler: turnaj / soutěž podle URL, záložka podle history state.
  useEffect(() => {
    window.history.replaceState({ tab: 'overview' }, '')
    const handlePopstate = (e: PopStateEvent) => {
      setTournamentId(detectTournamentIdFromUrl())
      setCompetitionSlug(detectCompetitionSlugFromUrl())
      setClubSlug(detectClubSlugFromUrl())
      setLegalDoc(detectLegalDocFromUrl())
      const prev = e.state?.tab as Tab | undefined
      setTab(prev && VALID_TABS.includes(prev) ? prev : 'overview')
    }
    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  // ── Tab navigation with history ───────────────────────
  const navigateTab = useCallback((t: Tab) => {
    window.history.pushState({ tab: t }, '')
    setTab(t)
  }, [])

  // ── Branding turnaje (barvy) ──────────────────────────
  useEffect(() => {
    applyTournamentTheme(tournamentId ? tournament : null)
  }, [tournamentId, tournament?.brand_primary, tournament?.brand_secondary, tournament?.brand_style])

  // ── Titulek okna ──────────────────────────────────────
  useEffect(() => {
    document.title = tournament?.name ? `${tournament.name} · ${BRAND.name}` : BRAND.name
  }, [tournament?.name])

  // ── Toast ─────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setToastShow(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastShow(false), 2600)
  }, [])

  // Data pro detaily týmu a zápasu (kontext — bez dalších props a dotazů)
  const detailData = useMemo<TournamentData | null>(() => (tournament ? {
    tournament, teams, players, groups, matches, goals, assists, cards, penalties,
    bracketRounds, bracketSlots, bracketGoals, bracketAssists, bracketCards, bracketPenalties,
    referees, bracketLoading,
    sponsors: tournament.sponsors_enabled ? sortByTier(sponsors) : [],
  } : null), [tournament, teams, players, groups, matches, goals, assists, cards, penalties,
    bracketRounds, bracketSlots, bracketGoals, bracketAssists, bracketCards, bracketPenalties, referees, bracketLoading, sponsors])

  const shared = { teams, players, groups, matches, goals, bracketRounds, bracketSlots, announcements, ruleItems, showToast }
  const showBracket = !(tournament?.format === 'league' && !(tournament?.league_has_playoff ?? true))
  const sponsorsEnabled = tournament?.sponsors_enabled ?? false
  const mediaEnabled = tournament?.press_enabled ?? false
  const currentCompetition = competitions.find(c => c.id === tournament?.competition_id) ?? null
  // Ročníky soutěže pro rychlý přechod (hlavička, Přehled) — od nejnovějšího
  const editionOptions = competitionEditions
    .filter(e => e.edition != null)
    .sort((a, b) => (b.edition ?? 0) - (a.edition ?? 0))
    .map(e => ({ id: e.id, edition: e.edition as number, label: `${e.edition}. ročník${e.season_label ? ` · ${e.season_label}` : ''}`, name: e.name }))
  // Partneři seřazení podle úrovně; generální partner = „presented by“
  const sortedSponsors = sortByTier(sponsors)
  const presentedBy = sponsorsEnabled ? getTitlePartner(sponsors) : null
  const leftSponsors = sortedSponsors.filter((_, i) => i % 2 === 0)
  const rightSponsors = sortedSponsors.filter((_, i) => i % 2 !== 0)

  // Otevření turnaje (z úvodní stránky / soutěže): vždy začít na Přehledu
  const openTournament = useCallback((id: string) => {
    setTab('overview')
    setCompetitionSlug('')
    setClubSlug('')
    setLegalDoc('')
    setTournamentId(id)
  }, [])

  const goHome = useCallback(() => {
    window.history.pushState({}, '', '/')
    openTournament('')
  }, [openTournament])

  // ── Landing page: no tournamentId in URL ─────────────
  const openCompetition = (slug: string) => {
    window.history.pushState({}, '', `/s/${slug}`)
    setTournamentId('')
    setClubSlug('')
    setCompetitionSlug(slug)
  }

  if (legalDoc) {
    return (
      <TournamentProvider tournamentId="">
        <LegalPage doc={legalDoc} onHome={goHome} />
      </TournamentProvider>
    )
  }

  if (clubSlug) {
    return (
      <TournamentProvider tournamentId="">
        <ClubPage
          slug={clubSlug}
          onHome={goHome}
          onOpenTournament={id => {
            window.history.pushState({ tournamentId: id }, '', `/${id}`)
            openTournament(id)
          }}
        />
      </TournamentProvider>
    )
  }

  if (competitionSlug) {
    return (
      <TournamentProvider tournamentId="">
        <CompetitionPage
          slug={competitionSlug}
          onHome={goHome}
          onOpenTournament={id => {
            window.history.pushState({ tournamentId: id }, '', `/${id}`)
            openTournament(id)
          }}
        />
      </TournamentProvider>
    )
  }

  if (!tournamentId) {
    return (
      <TournamentProvider tournamentId="">
        <TournamentLanding onSelect={openTournament} onSelectCompetition={openCompetition} />
        {passwordRecovery && <PasswordResetOverlay onDone={() => setPasswordRecovery(false)} />}
      </TournamentProvider>
    )
  }

  // ── Načítání turnaje (i při přepnutí na jiný) ─────────
  // Čeká na turnaj a základní data, ať se nikdy neukáže směs starého a nového turnaje.
  if (!tournament || tournament.id !== tournamentId || teamsLoading || groupsLoading || matchesLoading) {
    return <TournamentSkeleton notFound={tournamentNotFound} onHome={goHome} />
  }

  if (kiosk) {
    return (
      <TournamentProvider tournamentId={tournamentId}>
        <KioskMode
          {...shared}
          bracketGoals={bracketGoals}
          tournament={tournament}
          onExit={() => setKiosk(false)}
          onScoreboard={() => setScoreboard(true)}
          sponsors={sponsorsEnabled ? sortedSponsors : []}
        />
        {scoreboard && (
          <Scoreboard
            tournament={tournament}
            teams={teams}
            players={players}
            groups={groups}
            matches={matches}
            goals={goals}
            bracketGoals={bracketGoals}
            bracketRounds={bracketRounds}
            bracketSlots={bracketSlots}
            onExit={() => setScoreboard(false)}
            sponsors={sponsorsEnabled ? sortedSponsors : []}
            presentedBy={presentedBy}
          />
        )}
      </TournamentProvider>
    )
  }

  return (
    <TournamentProvider tournamentId={tournamentId}>
    <TournamentDataContext.Provider value={detailData}>
    <DetailHost key={tournamentId}>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        tournament={tournament}
        tab={tab}
        onTab={navigateTab}
        onAdmin={() => setAdminOpen(true)}
        onKiosk={() => setKiosk(true)}
        onScoreboard={() => setScoreboard(true)}
        onPrint={() => setPrintOpen(true)}
        onHome={goHome}
        isAdmin={canEdit}
        tipsEnabled={tipsOn}
        showBracket={showBracket}
        cardsEnabled={tournament?.cards_enabled ?? false}
        sponsorsEnabled={sponsorsEnabled}
        presentedBy={presentedBy}
        mediaEnabled={mediaEnabled}
        competition={currentCompetition}
        onOpenCompetition={openCompetition}
        editionOptions={editionOptions}
        onOpenTournament={id => {
          window.history.pushState({ tournamentId: id }, '', `/${id}`)
          openTournament(id)
        }}
      />
      {sponsorsEnabled && sponsors.length > 0 && (
        <aside className="sponsor-sidebar" style={{ position: 'fixed', left: 0, top: HEADER_HEIGHT_DESKTOP + 8, bottom: 0, width: 130, flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem .5rem', overflowY: 'auto' }}>
          {leftSponsors.map(s => (
            <SponsorSidebarLogo key={s.id} sponsor={s} />
          ))}
        </aside>
      )}
      <main className="page-main" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {tab === 'overview'  && <Overview tournament={tournament} announcements={announcements} onTab={navigateTab} teams={teams} players={players} groups={groups} matches={matches} goals={goals} bracketGoals={bracketGoals} bracketRounds={bracketRounds} bracketSlots={bracketSlots} sponsors={sponsorsEnabled ? sortedSponsors : []} presentedBy={presentedBy} competition={currentCompetition} editionOptions={editionOptions} onOpenCompetition={openCompetition} onOpenTournament={id => { window.history.pushState({ tournamentId: id }, '', `/${id}`); openTournament(id) }} />}
        {tab === 'teams'     && <Teams teams={teams} players={players} goals={goals} bracketGoals={bracketGoals} assists={assists} bracketAssists={bracketAssists} cards={cards} bracketCards={bracketCards} penalties={penalties} bracketPenalties={bracketPenalties} tournament={tournament} matches={matches} />}
        {tab === 'results'   && <Results matches={matches} teams={teams} tournament={tournament} referees={referees} sponsors={sponsorsEnabled ? sortedSponsors : []} showToast={showToast} />}
        {tab === 'standings' && <Standings groups={groups} matches={matches} teams={teams} tournament={tournament} sponsors={sponsorsEnabled ? sortedSponsors : []} showToast={showToast} />}
        {tab === 'statistics' && <Statistics goals={goals} bracketGoals={bracketGoals} assists={assists} bracketAssists={bracketAssists} cards={cards} bracketCards={bracketCards} penalties={penalties} bracketPenalties={bracketPenalties} players={players} teams={teams} tournament={tournament} sponsors={sponsorsEnabled ? sortedSponsors : []} showToast={showToast} />}
        {tab === 'bracket'   && showBracket && <Bracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />}
        {tab === 'info'      && <Info tournament={tournament} announcements={announcements} onTab={navigateTab} />}
        {tab === 'rules'     && <Rules tournament={tournament} ruleItems={ruleItems} />}
        {tab === 'tips'      && tipsOn && <Tips matches={matches} teams={teams} players={players} groups={groups} bracketRounds={bracketRounds} bracketSlots={bracketSlots} tournament={tournament} showToast={showToast} />}
        {tab === 'sponsors'  && <Sponsors sponsors={sponsors} />}
        {tab === 'media'     && mediaEnabled && <Media tournament={tournament} sponsors={sponsorsEnabled ? sortedSponsors : []} matches={matches} groups={groups} teams={teams} players={players} goals={goals} bracketGoals={bracketGoals} bracketRounds={bracketRounds} bracketSlots={bracketSlots} onPrint={() => setPrintOpen(true)} showToast={showToast} />}
        <SiteFooter variant="inline" />
      </main>
      {sponsorsEnabled && sponsors.length > 0 && (
        <aside className="sponsor-sidebar" style={{ position: 'fixed', right: 0, top: HEADER_HEIGHT_DESKTOP + 8, bottom: 0, width: 130, flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem .5rem', overflowY: 'auto' }}>
          {rightSponsors.map(s => (
            <SponsorSidebarLogo key={s.id} sponsor={s} />
          ))}
        </aside>
      )}
      {scoreboard && (
        <Scoreboard
          tournament={tournament}
          teams={teams}
          players={players}
          groups={groups}
          matches={matches}
          goals={goals}
          bracketGoals={bracketGoals}
          bracketRounds={bracketRounds}
          bracketSlots={bracketSlots}
          onExit={() => setScoreboard(false)}
          sponsors={sponsorsEnabled ? sortedSponsors : []}
          presentedBy={presentedBy}
        />
      )}
      {adminOpen && (
        <AdminPanel
          {...shared}
          session={session}
          canEdit={canEdit}
          isPlatformAdmin={isPlatformAdmin}
          tipsAvailable={platform.tipsEnabled}
          tournamentId={tournamentId}
          tournament={tournament}
          bracketGoals={bracketGoals}
          bracketAssists={bracketAssists}
          bracketCards={bracketCards}
          assists={assists}
          cards={cards}
          penalties={penalties}
          bracketPenalties={bracketPenalties}
          referees={referees}
          refetchTournament={refetchTournament}
          refetchTeams={refetchTeams}
          refetchPlayers={refetchPlayers}
          refetchGroups={refetchGroups}
          refetchMatches={refetchMatches}
          refetchGoals={refetchGoals}
          refetchAssists={refetchAssists}
          refetchCards={refetchCards}
          refetchPenalties={refetchPenalties}
          refetchBracketPenalties={refetchBracketPenalties}
          refetchBracket={refetchBracket}
          refetchBracketGoals={refetchBracketGoals}
          refetchBracketAssists={refetchBracketAssists}
          refetchBracketCards={refetchBracketCards}
          refetchReferees={refetchReferees}
          refetchAnnouncements={refetchAnnouncements}
          refetchRuleItems={refetchRuleItems}
          sponsors={sponsors}
          refetchSponsors={refetchSponsors}
          onClose={() => setAdminOpen(false)}
        />
      )}
      <BottomNav tab={tab} onTab={navigateTab} tipsEnabled={tipsOn} showBracket={showBracket} cardsEnabled={tournament?.cards_enabled ?? false} sponsorsEnabled={sponsorsEnabled} mediaEnabled={mediaEnabled} />
      <Toast message={toast} show={toastShow} />
      {passwordRecovery && <PasswordResetOverlay onDone={() => setPasswordRecovery(false)} />}
      {printOpen && (
        <PrintBulletin
          tournament={tournament}
          teams={teams}
          groups={groups}
          matches={matches}
          bracketRounds={bracketRounds}
          bracketSlots={bracketSlots}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
    </DetailHost>
    </TournamentDataContext.Provider>
    </TournamentProvider>
  )
}
