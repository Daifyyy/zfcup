import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Tournament {
  id: string
  name: string
  subtitle: string
  date: string
  venue: string
  description: string
  tips_enabled: boolean
  format: 'groups' | 'league'
  match_duration: number
  halves: number
  playoff_kickoff: string
  round_break: number
  tips_lock_from: string
  num_teams: number
  num_groups: number
  advancing_per_group: number
  num_pitches: number
  rules_content: string
  league_has_playoff: boolean
  logo_url: string | null
  playoff_style?: string
  format_id?: string
  assists_enabled: boolean
  cards_enabled: boolean
}

export function useTournament(tournamentId?: string) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Skip fetch when no tournamentId provided (e.g. on landing page)
    if (tournamentId === '') {
      setLoading(false)
      return
    }

    async function fetch() {
      const query = tournamentId
        ? supabase.from('tournament').select('*').eq('id', tournamentId).single()
        : supabase.from('tournament').select('*').single()
      const { data, error } = await query
      if (!error) setTournament(data)
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    const unsub = subscribeTable('tournament', () => fetchRef.current())
    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { tournament, loading, refetch: () => fetchRef.current() }
}
