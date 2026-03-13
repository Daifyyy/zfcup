import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Announcement {
  id: string
  icon: string
  title: string
  body: string
  position: number
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('announcements').select('*').order('position')
      setAnnouncements(data ?? [])
      setLoading(false)
    }
    fetch()

    const sub = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetch)
      .subscribe()
    const poll = setInterval(fetch, 10_000)

    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [])

  return { announcements, loading }
}
