import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Referee {
  id: string
  name: string
}

export function useReferees() {
  const [referees, setReferees] = useState<Referee[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('referees').select('*').order('name')
      setReferees(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('referees', () => fetchRef.current())

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
  }, [])

  return { referees, refetch: () => fetchRef.current() }
}
