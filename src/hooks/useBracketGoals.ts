import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface BracketGoal {
  id: string
  player_id: string
  slot_id: string
  count: number
}

export function useBracketGoals() {
  const [bracketGoals, setBracketGoals] = useState<BracketGoal[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('bracket_goals').select('*')
      setBracketGoals(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('bracket_goals', () => fetchRef.current())

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

  return { bracketGoals, refetch: () => fetchRef.current() }
}
