import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Minimální `document` pro Node prostředí: jen hidden + visibilitychange
class FakeDocument extends EventTarget { hidden = false }
const doc = new FakeDocument()
vi.stubGlobal('document', doc)

// Stav realtime pod kontrolou testu (bez skutečného Supabase klienta)
let healthy = false
const healthCbs = new Set<() => void>()
vi.mock('../realtimeManager', () => ({
  isRealtimeHealthy: () => healthy,
  onRealtimeHealthChange: (cb: () => void) => { healthCbs.add(cb); return () => healthCbs.delete(cb) },
}))
function setHealthy(v: boolean) { healthy = v; healthCbs.forEach(cb => cb()) }

const { onPoll, effectiveInterval } = await import('../poller')

function setHidden(hidden: boolean) {
  doc.hidden = hidden
  doc.dispatchEvent(new Event('visibilitychange'))
}

describe('poller', () => {
  beforeEach(() => { vi.useFakeTimers(); doc.hidden = false })
  afterEach(() => { vi.useRealTimers() })

  it('volá handlery jednou za interval (jeden společný časovač)', () => {
    const a = vi.fn(), b = vi.fn()
    const offA = onPoll(a, 120_000, true), offB = onPoll(b, 120_000, true)
    vi.advanceTimersByTime(119_999)
    expect(a).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1 + 2000) // interval + rozložení
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA(); offB()
  })

  it('různé intervaly (120 s data, 180 s tipy) běží odděleně', () => {
    const data = vi.fn(), tips = vi.fn()
    const off1 = onPoll(data, 120_000, true), off2 = onPoll(tips, 180_000, true)
    vi.advanceTimersByTime(360_000 + 2000)
    expect(data).toHaveBeenCalledTimes(3)
    expect(tips).toHaveBeenCalledTimes(2)
    off1(); off2()
  })

  it('skrytá karta nic nestahuje; po návratu jedna rozložená obnova', () => {
    const hs = Array.from({ length: 5 }, () => vi.fn())
    const offs = hs.map(h => onPoll(h, 120_000, true))
    setHidden(true)
    vi.advanceTimersByTime(600_000)
    hs.forEach(h => expect(h).not.toHaveBeenCalled())

    setHidden(false)
    // první hned, ostatní rozložené do 1,5 s — ne všechny naráz
    expect(hs.filter(h => h.mock.calls.length > 0)).toHaveLength(1)
    vi.advanceTimersByTime(1500)
    hs.forEach(h => expect(h).toHaveBeenCalledTimes(1))

    // a polling běží dál
    vi.advanceTimersByTime(120_000 + 2000)
    hs.forEach(h => expect(h).toHaveBeenCalledTimes(2))
    offs.forEach(o => o())
  })

  it('po odhlášení se handler už nevolá', () => {
    const h = vi.fn()
    const off = onPoll(h, 120_000, true)
    off()
    vi.advanceTimersByTime(500_000)
    setHidden(true); setHidden(false)
    vi.advanceTimersByTime(5000)
    expect(h).not.toHaveBeenCalled()
  })

  it('interval podle realtime: spojený ×5, výpadek ÷4 (min. 30 s), pevný beze změny', () => {
    expect(effectiveInterval(120_000, false, true)).toBe(600_000)
    expect(effectiveInterval(120_000, false, false)).toBe(30_000)
    expect(effectiveInterval(60_000, false, false)).toBe(30_000)
    expect(effectiveInterval(30_000, true, true)).toBe(30_000)
  })

  it('změna stavu realtime přeplánuje polling', () => {
    setHealthy(true)
    const h = vi.fn()
    const off = onPoll(h)
    vi.advanceTimersByTime(120_000 + 2000)
    expect(h).not.toHaveBeenCalled() // spojený realtime → až za 10 min
    setHealthy(false)                 // výpadek → za 30 s
    vi.advanceTimersByTime(30_000 + 2000)
    expect(h).toHaveBeenCalledTimes(1)
    off()
    setHealthy(false)
  })
})
