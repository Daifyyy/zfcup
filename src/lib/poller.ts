// Společný polling pro všechny datové hooky (záloha za realtime).
//
// Místo samostatného setInterval + visibilitychange v každém hooku běží jeden
// časovač na interval a jeden posluchač viditelnosti:
// - skrytá karta (document.hidden) → nic se nestahuje,
// - návrat na kartu → obnova rozložená v čase (ne 19 dotazů naráz),
// - poll při viditelné kartě → také rozložený, aby nevznikaly špičky.
//
// Interval se přizpůsobuje stavu realtime (audit 2026-10):
// - realtime spojený → polling jen jako pojistka (×5, 2 min → 10 min) — šetří přenosy,
// - realtime nefunguje (výpadek, limit souběžných spojení) → častěji (÷4, min. 30 s).
// Pevný interval (`fixed`) se nepřizpůsobuje (např. soukromý turnaj, kde realtime nechodí).

import { isRealtimeHealthy, onRealtimeHealthChange } from './realtimeManager'

type Handler = () => void

const HEALTHY_FACTOR = 5
const UNHEALTHY_FACTOR = 0.25
const MIN_INTERVAL = 30_000

interface Group { base: number; fixed: boolean; handlers: Set<Handler> }

const groups = new Map<string, Group>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let visibilityBound = false

/** Rozprostře volání handlerů do okna `spreadMs`. */
function runSpread(handlers: Handler[], spreadMs: number) {
  const step = handlers.length > 1 ? spreadMs / (handlers.length - 1) : 0
  handlers.forEach((h, i) => {
    if (i === 0) h()
    else setTimeout(h, Math.round(i * step))
  })
}

/** Aktuální interval skupiny podle stavu realtime. */
export function effectiveInterval(base: number, fixed: boolean, healthy: boolean): number {
  if (fixed) return base
  return Math.max(MIN_INTERVAL, Math.round(base * (healthy ? HEALTHY_FACTOR : UNHEALTHY_FACTOR)))
}

function schedule(key: string) {
  const g = groups.get(key)
  if (!g || timers.has(key) || document.hidden) return
  timers.set(key, setTimeout(() => {
    timers.delete(key)
    const cur = groups.get(key)
    if (!cur || document.hidden) return
    runSpread(Array.from(cur.handlers), 2000)
    schedule(key)
  }, effectiveInterval(g.base, g.fixed, isRealtimeHealthy())))
}

function stopTimers() {
  timers.forEach(t => clearTimeout(t))
  timers.clear()
}

let healthBound = false
function bindHealth() {
  if (healthBound) return
  healthBound = true
  onRealtimeHealthChange(() => rescheduleAll())
}

function onVisibility() {
  if (document.hidden) {
    stopTimers()
    return
  }
  const all = new Set<Handler>()
  groups.forEach(g => g.handlers.forEach(h => all.add(h)))
  runSpread(Array.from(all), 1500)
  groups.forEach((_, key) => schedule(key))
}

/** Změna stavu realtime → přeplánovat časovače s novým intervalem. */
export function rescheduleAll() {
  stopTimers()
  groups.forEach((_, key) => schedule(key))
}

/**
 * Pravidelně volat `handler` (dynamická data 120 s, tipy 180 s — základ, viz přizpůsobení výše).
 * `fixed` = interval se nepřizpůsobuje stavu realtime. Vrací odhlášení.
 */
export function onPoll(handler: Handler, intervalMs = 120_000, fixed = false): () => void {
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', onVisibility)
    visibilityBound = true
  }
  bindHealth()
  const key = `${intervalMs}|${fixed ? 1 : 0}`
  if (!groups.has(key)) groups.set(key, { base: intervalMs, fixed, handlers: new Set() })
  groups.get(key)!.handlers.add(handler)
  schedule(key)
  return () => {
    const g = groups.get(key)
    g?.handlers.delete(handler)
    if (g && g.handlers.size === 0) {
      groups.delete(key)
      const t = timers.get(key)
      if (t) clearTimeout(t)
      timers.delete(key)
    }
  }
}
