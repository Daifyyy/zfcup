import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Referee {
  id: string
  name: string
}

export function useReferees(tournamentId: string) {
  const [referees, setReferees] = useState<Referee[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setReferees([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('referees').select('*').eq('tournament_id', tournamentId).order('name')
      if (cancelled) return
      if (!error) setReferees(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { referees, refetch: () => fetchRef.current() }
}
