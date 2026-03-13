import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Goal {
  id: string
  player_id: string
  match_id: string
  count: number
}

export interface ScorerRow {
  player_id: string
  player_name: string
  team_id: string
  team_name: string
  goals: number
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('goals').select('*')
      setGoals(data ?? [])
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel('goals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 10_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { goals, loading }
}
