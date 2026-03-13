import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { useTournament } from './hooks/useTournament'
import { useTeams } from './hooks/useTeams'
import { usePlayers } from './hooks/usePlayers'
import { useGroups } from './hooks/useGroups'
import { useMatches } from './hooks/useMatches'
import { useGoals } from './hooks/useGoals'
import { useBracket } from './hooks/useBracket'
import { useAnnouncements } from './hooks/useAnnouncements'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import Overview from './components/public/Overview'
import Teams from './components/public/Teams'
import Results from './components/public/Results'
import Standings from './components/public/Standings'
import Scorers from './components/public/Scorers'
import Bracket from './components/public/Bracket'
import AdminPanel from './components/admin/AdminPanel'
import KioskMode from './components/kiosk/KioskMode'
import Scoreboard from './components/public/Scoreboard'
import Toast from './components/ui/Toast'
import type { Session } from '@supabase/supabase-js'

export type Tab = 'overview' | 'teams' | 'results' | 'standings' | 'scorers' | 'bracket'

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
  const { matches } = useMatches()
  const { goals } = useGoals()
  const { rounds: bracketRounds, slots: bracketSlots } = useBracket()
  const { announcements } = useAnnouncements()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); setAdminOpen(true) }
      if (e.key === 'Escape' && adminOpen) setAdminOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [adminOpen])

  // Sync kiosk state with URL param
  useEffect(() => {
    const url = new URL(window.location.href)
    if (kiosk) url.searchParams.set('kiosk', '1')
    else url.searchParams.delete('kiosk')
    window.history.replaceState({}, '', url.toString())
  }, [kiosk])

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
            groups={groups}
            matches={matches}
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
        onTab={setTab}
        onAdmin={() => setAdminOpen(true)}
        onKiosk={() => setKiosk(true)}
        onScoreboard={() => setScoreboard(true)}
        isAdmin={!!session}
      />
      <main className="page-main" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {tab === 'overview'  && <Overview tournament={tournament} teams={teams} matches={matches} groups={groups} announcements={announcements} onTab={setTab} />}
        {tab === 'teams'     && <Teams teams={teams} players={players} />}
        {tab === 'results'   && <Results matches={matches} teams={teams} />}
        {tab === 'standings' && <Standings groups={groups} matches={matches} teams={teams} />}
        {tab === 'scorers'   && <Scorers goals={goals} players={players} teams={teams} />}
        {tab === 'bracket'   && <Bracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />}
      </main>
      {scoreboard && (
        <Scoreboard
          tournament={tournament}
          teams={teams}
          groups={groups}
          matches={matches}
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
          onClose={() => setAdminOpen(false)}
        />
      )}
      <BottomNav tab={tab} onTab={setTab} />
      <Toast message={toast} show={toastShow} />
    </div>
  )
}
