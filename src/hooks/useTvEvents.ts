// Události pro TV režim a TV tabuli (gól, začátek/konec zápasu, dohraná skupina, vítěz).
// Pravidlo „od teď“: výchozí stav = stav při otevření TV (a při každém zapnutí modulu).
// Ochrana proti hlášení starých změn — stav se jen potichu přepíše, když:
//  - žádný TV modul neběží (active = false),
//  - karta není vidět, nebo se právě vrátila / obnovilo realtime spojení (5 s klidu na dotažení dat).
// Střelec se dopočítá: skóre a góly hráčů přicházejí v různých zprávách, proto gól počká až 3 s.
import { useEffect, useRef, useState } from 'react'
import type { Player } from './usePlayers'
import { buildSnapshot, diffSnapshots, newScorers, type SnapshotInput, type TvEvent, type TvSnapshot } from '../lib/tvEvents'
import { onRealtimeHealthChange } from '../lib/realtimeManager'

/** Jak dlouho po návratu karty / obnovení spojení se změny jen přebírají (bez hlášení). */
const QUIET_MS = 5000
/** Jak dlouho gól čeká na zapsání střelce. */
const SCORER_WAIT_MS = 3000
/** Přepočet „živých“ zápasů (začátek zápasu podle času). */
const TICK_MS = 20_000
/** Střelce hledat proti stavu nejvýš tak starému (skóre a góly se ukládají paralelně, v libovolném pořadí). */
const SCORER_WINDOW_MS = 6000

export interface TvEventBatch { id: number; events: TvEvent[] }

export function useTvEvents(input: SnapshotInput & { players: Player[] }, active: boolean): TvEventBatch {
  const [batch, setBatch] = useState<TvEventBatch>({ id: 0, events: [] })
  const [tick, setTick] = useState(0)
  const baseline = useRef<TvSnapshot | null>(null)
  const latest = useRef<TvSnapshot | null>(null)
  /** Nedávné stavy (pro určení střelce) */
  const history = useRef<{ at: number; snap: TvSnapshot }[]>([])
  const quietUntil = useRef(0)
  const seen = useRef(new Set<string>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const playersRef = useRef(input.players)
  playersRef.current = input.players

  // Hodiny pro začátek zápasu podle času + klid po návratu karty a obnovení spojení
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), TICK_MS)
    const onVis = () => { if (document.visibilityState === 'visible') quietUntil.current = Date.now() + QUIET_MS }
    document.addEventListener('visibilitychange', onVis)
    const offHealth = onRealtimeHealthChange(() => { quietUntil.current = Date.now() + QUIET_MS })
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); offHealth() }
  }, [])

  // Zrušit čekající góly při odchodu z TV
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  useEffect(() => {
    const next = buildSnapshot(input)
    const now = Date.now()
    latest.current = next
    const prev = baseline.current
    baseline.current = next
    // nejstarší stav v okně (před ním ještě střelec nebyl zapsaný)
    history.current = history.current.filter(h => now - h.at <= SCORER_WINDOW_MS)
    const scorerBase = history.current[0]?.snap ?? prev
    history.current.push({ at: now, snap: next })
    const listening = active && document.visibilityState === 'visible' && Date.now() >= quietUntil.current
    if (!prev || !listening) return

    const teamPlayers = (teamId: string) => new Set(playersRef.current.filter(p => p.team_id === teamId).map(p => p.id))
    const events = diffSnapshots(prev, next, teamPlayers)
      .map(e => (e.type === 'goal' && scorerBase ? { ...e, scorers: newScorers(scorerBase, next, e.gameId, teamPlayers(e.teamId)).slice(-e.count) } : e))
      .filter(e => !seen.current.has(e.key))
    if (!events.length) return
    events.forEach(e => seen.current.add(e.key))

    const emit = (list: TvEvent[]) => { if (list.length) setBatch(b => ({ id: b.id + 1, events: list })) }
    const ready = events.filter(e => e.type !== 'goal' || e.scorers.length >= e.count)
    const waiting = events.filter(e => e.type === 'goal' && e.scorers.length < e.count)
    emit(ready)
    for (const e of waiting) {
      const t = setTimeout(() => {
        timers.current.delete(t)
        if (e.type !== 'goal' || !latest.current) return
        // střelci zapsaní mezitím (stejná hodnota skóre → stále stejný gól)
        const scorers = newScorers(scorerBase ?? prev, latest.current, e.gameId, teamPlayers(e.teamId)).slice(-e.count)
        emit([{ ...e, scorers }])
      }, SCORER_WAIT_MS)
      timers.current.add(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.matches, input.bracketSlots, input.goals, input.bracketGoals, input.bracketRounds, input.groups, tick, active])

  return batch
}
