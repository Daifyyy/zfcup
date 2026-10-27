// Společný polling pro všechny datové hooky (záloha za realtime).
//
// Místo samostatného setInterval + visibilitychange v každém hooku běží jeden
// časovač na interval a jeden posluchač viditelnosti:
// - skrytá karta (document.hidden) → nic se nestahuje,
// - návrat na kartu → obnova rozložená v čase (ne 19 dotazů naráz),
// - poll při viditelné kartě → také rozložený, aby nevznikaly špičky.

type Handler = () => void

const groups = new Map<number, Set<Handler>>()
const timers = new Map<number, ReturnType<typeof setInterval>>()
let visibilityBound = false

/** Rozprostře volání handlerů do okna `spreadMs`. */
function runSpread(handlers: Handler[], spreadMs: number) {
  const step = handlers.length > 1 ? spreadMs / (handlers.length - 1) : 0
  handlers.forEach((h, i) => {
    if (i === 0) h()
    else setTimeout(h, Math.round(i * step))
  })
}

function startTimer(intervalMs: number) {
  if (timers.has(intervalMs) || document.hidden) return
  timers.set(intervalMs, setInterval(() => {
    runSpread(Array.from(groups.get(intervalMs) ?? []), 2000)
  }, intervalMs))
}

function stopTimers() {
  timers.forEach(t => clearInterval(t))
  timers.clear()
}

function onVisibility() {
  if (document.hidden) {
    stopTimers()
    return
  }
  const all = new Set<Handler>()
  groups.forEach(set => set.forEach(h => all.add(h)))
  runSpread(Array.from(all), 1500)
  groups.forEach((_, ms) => startTimer(ms))
}

/** Pravidelně volat `handler` (dynamická data 120 s, tipy 180 s). Vrací odhlášení. */
export function onPoll(handler: Handler, intervalMs = 120_000): () => void {
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', onVisibility)
    visibilityBound = true
  }
  if (!groups.has(intervalMs)) groups.set(intervalMs, new Set())
  groups.get(intervalMs)!.add(handler)
  startTimer(intervalMs)
  return () => {
    const set = groups.get(intervalMs)
    set?.delete(handler)
    if (set && set.size === 0) {
      groups.delete(intervalMs)
      const t = timers.get(intervalMs)
      if (t) clearInterval(t)
      timers.delete(intervalMs)
    }
  }
}
