import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Player {
  id: string
  team_id: string
  name: string
  number: number | null
  role: string | null  // 'captain' | 'goalkeeper' | 'both' | null
}

export function usePlayers(teamId?: string) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      let q = supabase.from('players').select('*').order('number')
      if (teamId) q = q.eq('team_id', teamId)
      const { data } = await q
      setPlayers(data ?? [])
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel('players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 60_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [teamId])

  return { players, loading }
}
