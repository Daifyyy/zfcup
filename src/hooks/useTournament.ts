import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
}

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('tournament').select('*').single()
      setTournament(data)
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const sub = supabase
      .channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 60_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { tournament, loading, refetch: () => fetchRef.current() }
}
