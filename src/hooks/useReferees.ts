import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

    const sub = supabase
      .channel('referees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referees' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 60_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { referees, refetch: () => fetchRef.current() }
}
