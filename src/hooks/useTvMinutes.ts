// Dosah partnera: TV režim / tabule hlásí jednou za 5 minut, že běží (jen viditelná karta).
// Report z toho počítá, jak dlouho bylo logo partnerů na obrazovce. Jeden součtový zápis za 5 min.
import { useEffect } from 'react'
import { trackTvMinutes } from '../lib/partnerReach'

const STEP_MIN = 5

export function useTvMinutes(tournamentId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!tournamentId || !enabled) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') trackTvMinutes(tournamentId, STEP_MIN)
    }, STEP_MIN * 60_000)
    return () => clearInterval(id)
  }, [tournamentId, enabled])
}
