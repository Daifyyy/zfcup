import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

    const sub = supabase
      .channel('bracket_goals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bracket_goals' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 10_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { bracketGoals, refetch: () => fetchRef.current() }
}
