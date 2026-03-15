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

  useEffect(() => {
    if (!tipsterId) { setTips([]); return }

    async function fetch() {
      const { data } = await supabase
        .from('tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setTips(data ?? [])
    }
    fetch()

    const sub = supabase
      .channel(`tips-${tipsterId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [tipsterId])

  return { tips }
}
