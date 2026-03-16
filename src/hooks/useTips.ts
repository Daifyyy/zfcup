import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Tip {
  id: string
  tipster_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  points_earned: number
  evaluated: boolean
}

export function useTips(tipsterId: string | null) {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tipsterId) { setTips([]); setLoading(false); return }

    setLoading(true)
    async function fetch() {
      const { data } = await supabase
        .from('tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setTips(data ?? [])
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel(`tips-${tipsterId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips' }, fetch)
      .subscribe()

    const poll = setInterval(fetch, 10_000)
    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [tipsterId])

  return { tips, loading }
}
