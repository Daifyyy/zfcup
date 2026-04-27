import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Group {
  id: string
  name: string
  team_ids: string[]
  schedule: 'once' | 'twice'
  tiebreaker: 'score_first' | 'h2h_first'
  start_time: string
  match_duration: number
  break_between: number
}

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('groups').select('*').order('name')
      setGroups(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const sub = supabase
      .channel('groups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 60_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { groups, loading, refetch: () => fetchRef.current() }
}
