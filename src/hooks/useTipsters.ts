import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Tipster {
  id: string
  name: string
  total_points: number
}

export function useTipsters(tournamentId: string) {
  const [tipsters, setTipsters] = useState<Tipster[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setTipsters([])
    async function fetch() {
      if (!tournamentId) return
      const { data } = await supabase
        .from('tipsters')
        .select('id, name, total_points')
        .eq('tournament_id', tournamentId)
        .order('total_points', { ascending: false })
      if (cancelled) return
      setTipsters(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('tipsters', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { tipsters }
}
