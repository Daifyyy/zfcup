import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { useTournament } from './hooks/useTournament'
import { useTeams } from './hooks/useTeams'
import { usePlayers } from './hooks/usePlayers'
import { useGroups } from './hooks/useGroups'
import { useMatches } from './hooks/useMatches'
import { useGoals } from './hooks/useGoals'
import { useBracket } from './hooks/useBracket'
import { useBracketGoals } from './hooks/useBracketGoals'
import { useAnnouncements } from './hooks/useAnnouncements'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import Overview from './components/public/Overview'
import Teams from './components/public/Teams'
import Results from './components/public/Results'
import Standings from './components/public/Standings'
import Scorers from './components/public/Scorers'
import Bracket from './components/public/Bracket'
import Info from './components/public/Info'
import Tips from './components/public/Tips'
import AdminPanel from './components/admin/AdminPanel'
import KioskMode from './components/kiosk/KioskMode'
import Scoreboard from './components/public/Scoreboard'
import Toast from './components/ui/Toast'
import type { Session } from '@supabase/supabase-js'

export type Tab = 'overview' | 'teams' | 'results' | 'standings' | 'scorers' | 'bracket' | 'info' | 'tips'
const VALID_TABS: Tab[] = ['overview', 'teams', 'results', 'standings', 'scorers', 'bracket', 'info', 'tips']

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [adminOpen, setAdminOpen] = useState(false)
  const [kiosk, setKiosk] = useState(() => new URLSearchParams(window.location.search).get('kiosk') === '1')
  const [scoreboard, setScoreboard] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [toast, setToast] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const { tournament } = useTournament()
  const { teams } = useTeams()
  const { players } = usePlayers()
  const { groups } = useGroups()
  const { matches, refetch: refetchMatches } = useMatches()
  const { goals, refetch: refetchGoals } = useGoals()
  const { rounds: bracketRounds, slots: bracketSlots } = useBracket()
  const { bracketGoals, refetch: refetchBracketGoals } = useBracketGoals()
  const { announcements } = useAnnouncements()

  // ── Auth ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
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

  const shared = { teams, players, groups, matches, goals, bracketRounds, bracketSlots, announcements, showToast }

  if (kiosk) {
    return (
      <>
        <KioskMode
          {...shared}
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
            onExit={() => setScoreboard(false)}
          />
        )}
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        tournament={tournament}
        tab={tab}
        onTab={navigateTab}
        onAdmin={() => setAdminOpen(true)}
        onKiosk={() => setKiosk(true)}
        onScoreboard={() => setScoreboard(true)}
        isAdmin={!!session}
        tipsEnabled={tournament?.tips_enabled ?? false}
      />
      <main className="page-main" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {tab === 'overview'  && <Overview tournament={tournament} teams={teams} matches={matches} groups={groups} goals={goals} announcements={announcements} onTab={navigateTab} />}
        {tab === 'teams'     && <Teams teams={teams} players={players} goals={goals} />}
        {tab === 'results'   && <Results matches={matches} teams={teams} />}
        {tab === 'standings' && <Standings groups={groups} matches={matches} teams={teams} />}
        {tab === 'scorers'   && <Scorers goals={goals} bracketGoals={bracketGoals} players={players} teams={teams} />}
        {tab === 'bracket'   && <Bracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />}
        {tab === 'info'      && <Info tournament={tournament} announcements={announcements} onTab={navigateTab} />}
        {tab === 'tips'      && <Tips matches={matches} teams={teams} groups={groups} bracketRounds={bracketRounds} bracketSlots={bracketSlots} showToast={showToast} />}
      </main>
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
          tournament={tournament}
          bracketGoals={bracketGoals}
          refetchMatches={refetchMatches}
          refetchGoals={refetchGoals}
          refetchBracketGoals={refetchBracketGoals}
          onClose={() => setAdminOpen(false)}
        />
      )}
      <BottomNav tab={tab} onTab={navigateTab} tipsEnabled={tournament?.tips_enabled ?? false} />
      <Toast message={toast} show={toastShow} />
    </div>
  )
}
