import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Tournament {
  id: string
  name: string
  subtitle: string
  date: string
  venue: string
  description: string
}

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('tournament').select('*').single()
      setTournament(data)
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 10_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { tournament, loading }
}
