import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'
import type { SportId } from '../lib/sports'

export interface Tournament {
  id: string
  name: string
  subtitle: string
  date: string
  venue: string
  description: string
  tips_enabled: boolean
  format: 'groups' | 'league'
  match_duration: number
  halves: number
  playoff_kickoff: string
  round_break: number
  tips_lock_from: string
  num_teams: number
  num_groups: number
  advancing_per_group: number
  num_pitches: number
  rules_content: string
  league_has_playoff: boolean
  logo_url: string | null
  playoff_style?: string
  format_id?: string
  assists_enabled: boolean
  cards_enabled: boolean
  sponsors_enabled: boolean
  sport: SportId
  penalty_minutes_enabled: boolean
  // Migrace 08 — dokud neproběhne, jsou undefined
  brand_primary?: string | null
  brand_secondary?: string | null
  /** Intenzita brandingu: 'subtle' | 'bold' — migrace 14 */
  brand_style?: string | null
  /** Fotka z akce jako pozadí sdílecích grafik (migrace 20) */
  share_photo_url?: string | null
  /** Migrace 15: 'public' | 'private'; bez migrace chybí (= veřejný) */
  visibility?: 'public' | 'private'
  /** Přístupový kód soukromého turnaje (vidí ho jen vlastník a ti, kdo ho zadali) */
  access_code?: string | null
  press_enabled?: boolean
  press_contact_name?: string
  press_contact_email?: string
  press_contact_phone?: string
  press_note?: string
  // Migrace 09 — soutěže a ročníky
  competition_id?: string | null
  edition?: number | null
  season_label?: string
  schedule_mode?: 'day' | 'season'
  /** Zapnuté moduly turnaje { klíč: true|false } — migrace 21; vyhodnocuje src/lib/modules.ts */
  modules?: Record<string, boolean>
  /** Ruční úpravy nejlepší sestavy { slots: { '0': playerId, … } } — migrace 22; vyhodnocuje src/lib/bestTeam.ts */
  best_team?: { slots?: Record<string, string> } | null
  /** Vlastník (organizátor) — migrace 11 hlídá zápis přes RLS */
  owner_id?: string | null
}

export function useTournament(tournamentId?: string) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  // Pro které ID turnaj prokazatelně neexistuje (žádný řádek / neplatné UUID).
  // Vázané na ID, aby při přepnutí neproblikla hláška „nenalezen“ dřív, než se začne načítat.
  const [notFoundId, setNotFoundId] = useState<string | null>(null)
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit starý turnaj a ignorovat opožděné odpovědi
    let cancelled = false
    setTournament(null)
    setNotFoundId(null)
    // Bez tournamentId (úvodní stránka) se nic nenačítá
    if (tournamentId === '') {
      setLoading(false)
      return
    }
    setLoading(true)

    async function fetch(viaBundle = false) {
      const direct = () => (tournamentId
        ? supabase.from('tournament').select('*').eq('id', tournamentId).single()
        : supabase.from('tournament').select('*').single())
      const { data, error } = await fetchTable(tournamentId ?? '', 'tournament', direct, viaBundle && !!tournamentId)
      if (cancelled) return
      if (!error) setTournament(data)
      // PGRST116 = žádný řádek, 22P02 = neplatné UUID; jiné chyby (síť) zkusí znovu polling
      else if (tournamentId && (error.code === 'PGRST116' || error.code === '22P02')) setNotFoundId(tournamentId)
      setLoading(false)
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('tournament', () => fetchRef.current(), tournamentId ? `id=eq.${tournamentId}` : undefined)
    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  const notFound = !!tournamentId && notFoundId === tournamentId && !tournament
  return { tournament, loading, notFound, refetch: () => fetchRef.current() }
}
