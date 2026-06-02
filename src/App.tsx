import { useState, useEffect, useRef, useCallback } from 'react'
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
import { useBracket } from './hooks/useBracket'
import { useBracketGoals } from './hooks/useBracketGoals'
import { useAnnouncements } from './hooks/useAnnouncements'
import { useRuleItems } from './hooks/useRuleItems'
import { useReferees } from './hooks/useReferees'
import { useSponsors } from './hooks/useSponsors'
import { TournamentProvider } from './lib/TournamentContext'
import Header from './components/layout/Header'
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
import PrintBulletin from './components/public/PrintBulletin'
import AdminPanel from './components/admin/AdminPanel'
import KioskMode from './components/kiosk/KioskMode'
import Scoreboard from './components/public/Scoreboard'
import Toast from './components/ui/Toast'
import TournamentLanding from './components/TournamentLanding'
import PasswordResetOverlay from './components/PasswordResetOverlay'
import type { Session } from '@supabase/supabase-js'

import type { Sponsor } from './hooks/useSponsors'

function SponsorSidebarLogo({ sponsor }: { sponsor: Sponsor }) {
  const img = sponsor.logo_url ? (
    <img src={sponsor.logo_url} alt={sponsor.name} title={sponsor.name} style={{ width: 120, height: 90, objectFit: 'contain' }} />
  ) : (
    <div style={{ width: 120, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 6, textAlign: 'center', padding: '.25rem', fontFamily: 'DM Sans, sans-serif' }}>
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
  return segments[0] ?? ''
}

export type Tab = 'overview' | 'teams' | 'results' | 'standings' | 'statistics' | 'bracket' | 'info' | 'rules' | 'tips' | 'sponsors'
const VALID_TABS: Tab[] = ['overview', 'teams', 'results', 'standings', 'statistics', 'bracket', 'info', 'rules', 'tips', 'sponsors']

export default function App() {
  const [tournamentId, setTournamentId] = useState<string>(() => detectTournamentIdFromUrl())
  const [tab, setTab] = useState<Tab>('overview')
  const [adminOpen, setAdminOpen] = useState(false)
  const [kiosk, setKiosk] = useState(() => new URLSearchParams(window.location.search).get('kiosk') === '1')
  const [scoreboard, setScoreboard] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [toast, setToast] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  // When no tournamentId, pass empty string so hooks skip fetching
  const { tournament, refetch: refetchTournament } = useTournament(tournamentId)
  const { teams, refetch: refetchTeams } = useTeams(tournamentId)
  const { players, refetch: refetchPlayers } = usePlayers(tournamentId)
  const { groups, refetch: refetchGroups } = useGroups(tournamentId)
  const { matches, refetch: refetchMatches } = useMatches(tournamentId)
  const { goals, refetch: refetchGoals } = useGoals(tournamentId)
  const { assists, refetch: refetchAssists } = useAssists(tournamentId)
  const { bracketAssists, refetch: refetchBracketAssists } = useBracketAssists(tournamentId)
  const { cards, refetch: refetchCards } = useCards(tournamentId)
  const { bracketCards, refetch: refetchBracketCards } = useBracketCards(tournamentId)
  const { rounds: bracketRounds, slots: bracketSlots, refetch: refetchBracket } = useBracket(tournamentId)
  const { bracketGoals, refetch: refetchBracketGoals } = useBracketGoals(tournamentId)
  const { announcements, refetch: refetchAnnouncements } = useAnnouncements(tournamentId)
  const { ruleItems, refetch: refetchRuleItems } = useRuleItems(tournamentId)
  const { referees, refetch: refetchReferees } = useReferees(tournamentId)
  const { sponsors, refetch: refetchSponsors } = useSponsors(tournamentId)

  // ── Auth ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Popstate: handle browser back from tournament → landing ───
  useEffect(() => {
    const handlePopstate = () => {
      const id = detectTournamentIdFromUrl()
      setTournamentId(id)
    }
    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
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

  // ── History navigation (Android back button) ──────────
  // Push initial state on mount
  useEffect(() => {
    window.history.replaceState({ tab: 'overview' }, '')
    const handlePopstate = (e: PopStateEvent) => {
      const prev = e.state?.tab as Tab | undefined
      if (prev && VALID_TABS.includes(prev)) {
        setTab(prev)
      } else {
        // Bottom of history stack — stay in app, go to overview
        window.history.pushState({ tab: 'overview' }, '')
        setTab('overview')
      }
    }
    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  // ── Tab navigation with history ───────────────────────
  const navigateTab = useCallback((t: Tab) => {
    window.history.pushState({ tab: t }, '')
    setTab(t)
  }, [])

  // ── Toast ─────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setToastShow(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastShow(false), 2600)
  }, [])

  const shared = { teams, players, groups, matches, goals, bracketRounds, bracketSlots, announcements, ruleItems, showToast }
  const showBracket = !(tournament?.format === 'league' && !(tournament?.league_has_playoff ?? true))
  const sponsorsEnabled = tournament?.sponsors_enabled ?? false
  const leftSponsors = sponsors.filter((_, i) => i % 2 === 0)
  const rightSponsors = sponsors.filter((_, i) => i % 2 !== 0)

  const goHome = useCallback(() => {
    setTournamentId('')
    window.history.pushState({}, '', '/')
  }, [])

  // ── Landing page: no tournamentId in URL ─────────────
  if (!tournamentId) {
    return (
      <TournamentProvider tournamentId="">
        <TournamentLanding onSelect={id => setTournamentId(id)} />
        {passwordRecovery && <PasswordResetOverlay onDone={() => setPasswordRecovery(false)} />}
      </TournamentProvider>
    )
  }

  // ── Loading spinner while fetching tournament ─────────
  if (!tournament) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div className="spinner" />
          <p style={{ fontFamily: 'DM Sans, sans-serif', marginTop: '.75rem', fontSize: '.9rem' }}>Načítám…</p>
        </div>
      </div>
    )
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
            referees={referees}
            onExit={() => setScoreboard(false)}
          />
        )}
      </TournamentProvider>
    )
  }

  return (
    <TournamentProvider tournamentId={tournamentId}>
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
        isAdmin={!!session}
        tipsEnabled={tournament?.tips_enabled ?? false}
        showBracket={showBracket}
        cardsEnabled={tournament?.cards_enabled ?? false}
        sponsorsEnabled={sponsorsEnabled}
      />
      {sponsorsEnabled && sponsors.length > 0 && (
        <aside className="sponsor-sidebar" style={{ position: 'fixed', left: 0, top: 70, bottom: 0, width: 130, flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem .5rem', overflowY: 'auto' }}>
          {leftSponsors.map(s => (
            <SponsorSidebarLogo key={s.id} sponsor={s} />
          ))}
        </aside>
      )}
      <main className="page-main" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {tab === 'overview'  && <Overview tournament={tournament} announcements={announcements} onTab={navigateTab} />}
        {tab === 'teams'     && <Teams teams={teams} players={players} goals={goals} bracketGoals={bracketGoals} assists={assists} bracketAssists={bracketAssists} cards={cards} bracketCards={bracketCards} tournament={tournament} />}
        {tab === 'results'   && <Results matches={matches} teams={teams} tournament={tournament} referees={referees} />}
        {tab === 'standings' && <Standings groups={groups} matches={matches} teams={teams} tournament={tournament} />}
        {tab === 'statistics' && <Statistics goals={goals} bracketGoals={bracketGoals} assists={assists} bracketAssists={bracketAssists} cards={cards} bracketCards={bracketCards} players={players} teams={teams} tournament={tournament} />}
        {tab === 'bracket'   && showBracket && <Bracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />}
        {tab === 'info'      && <Info tournament={tournament} announcements={announcements} onTab={navigateTab} />}
        {tab === 'rules'     && <Rules tournament={tournament} ruleItems={ruleItems} />}
        {tab === 'tips'      && <Tips matches={matches} teams={teams} players={players} groups={groups} bracketRounds={bracketRounds} bracketSlots={bracketSlots} tournament={tournament} showToast={showToast} />}
        {tab === 'sponsors'  && <Sponsors sponsors={sponsors} />}
      </main>
      {sponsorsEnabled && sponsors.length > 0 && (
        <aside className="sponsor-sidebar" style={{ position: 'fixed', right: 0, top: 70, bottom: 0, width: 130, flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem .5rem', overflowY: 'auto' }}>
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
        />
      )}
      {adminOpen && (
        <AdminPanel
          {...shared}
          session={session}
          tournamentId={tournamentId}
          tournament={tournament}
          bracketGoals={bracketGoals}
          bracketAssists={bracketAssists}
          bracketCards={bracketCards}
          assists={assists}
          cards={cards}
          referees={referees}
          refetchTournament={refetchTournament}
          refetchTeams={refetchTeams}
          refetchPlayers={refetchPlayers}
          refetchGroups={refetchGroups}
          refetchMatches={refetchMatches}
          refetchGoals={refetchGoals}
          refetchAssists={refetchAssists}
          refetchCards={refetchCards}
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
      <BottomNav tab={tab} onTab={navigateTab} tipsEnabled={tournament?.tips_enabled ?? false} showBracket={showBracket} cardsEnabled={tournament?.cards_enabled ?? false} sponsorsEnabled={sponsorsEnabled} />
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
    </TournamentProvider>
  )
}
