import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Sponsor {
  id: string
  tournament_id: string
  name: string
  logo_url: string
  website_url: string
  position: number
}

export function useSponsors(tournamentId: string) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase
        .from('sponsors').select('*').eq('tournament_id', tournamentId).order('position')
      if (!error) setSponsors(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('sponsors', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { sponsors, loading, refetch: () => fetchRef.current() }
}
