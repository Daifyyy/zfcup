import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Team {
  id: string
  name: string
  color: string
  logo_url: string | null
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('teams').select('*').order('name')
      setTeams(data ?? [])
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel('teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 60_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { teams, loading }
}
