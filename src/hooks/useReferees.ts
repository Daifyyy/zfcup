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
    async function fetch() {
      if (!tournamentId) return
      const { data } = await supabase.from('referees').select('*').eq('tournament_id', tournamentId).order('name')
      setReferees(data ?? [])
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
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { referees, refetch: () => fetchRef.current() }
}
