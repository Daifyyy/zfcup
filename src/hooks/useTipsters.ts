import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Tipster {
  id: string
  name: string
  total_points: number
}

export function useTipsters() {
  const [tipsters, setTipsters] = useState<Tipster[]>([])

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('tipsters')
        .select('id, name, total_points')
        .order('total_points', { ascending: false })
      setTipsters(data ?? [])
    }
    fetch()

    const sub = supabase
      .channel('tipsters')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tipsters' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 10_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { tipsters }
}
