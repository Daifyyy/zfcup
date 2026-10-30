// Výsledky hlasování diváků (modul fan_vote). Načítá se jen když je hlasování vidět (enabled);
// obnova přes sdílený poller (20 s, skrytá karta = žádné dotazy) a hned po vlastním hlasu (refetch).
import { useEffect, useRef, useState } from 'react'
import { fetchVoteResults, type VoteRow } from '../lib/fanVote'
import { onPoll } from '../lib/poller'

export function useFanVotes(tournamentId: string, enabled: boolean) {
  const [results, setResults] = useState<Map<string, VoteRow[]>>(new Map())
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    setResults(new Map())
    if (!tournamentId || !enabled) return
    let cancelled = false
    const load = async () => {
      const r = await fetchVoteResults(tournamentId)
      if (!cancelled && r) setResults(r)
    }
    fetchRef.current = load
    load()
    const off = onPoll(load, 20_000, true)
    return () => { cancelled = true; off() }
  }, [tournamentId, enabled])

  return { results, refetch: () => fetchRef.current() }
}
