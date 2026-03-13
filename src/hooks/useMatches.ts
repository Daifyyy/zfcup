import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Match {
  id: string
  group_id: string | null
  round: string
  home_id: string
  away_id: string
  home_score: number
  away_score: number
  played: boolean
  scheduled_time: string
}

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('matches').select('*').order('scheduled_time')
      setMatches(data ?? [])
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel('matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  return { matches, loading }
}
