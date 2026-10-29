import { describe, it, expect } from 'vitest'
import { changed, diffCounts } from '../eventDiff'

describe('diffCounts', () => {
  it('beze změny nic neposílá', () => {
    const s = { a: 1, b: 0, c: 2 }
    expect(diffCounts(s, { ...s })).toEqual({ upserts: [], deletes: [] })
  })
  it('nový a změněný počet = upsert, pokles na 0 = smazání', () => {
    const d = diffCounts({ a: 1, b: 2, c: 0 }, { a: 1, b: 0, c: 3, d: 1 })
    expect(d.upserts).toEqual([{ player_id: 'c', count: 3 }, { player_id: 'd', count: 1 }])
    expect(d.deletes).toEqual(['b'])
  })
  it('22 hráčů, 2 střelci → 1 upsert dávka se 2 řádky místo 22 dotazů', () => {
    const init: Record<string, number> = {}
    for (let i = 0; i < 22; i++) init[`p${i}`] = 0
    const cur = { ...init, p3: 1, p15: 2 }
    expect(diffCounts(init, cur)).toEqual({ upserts: [{ player_id: 'p3', count: 1 }, { player_id: 'p15', count: 2 }], deletes: [] })
  })
})

describe('changed', () => {
  it('porovnává hodnoty karet a trestů', () => {
    expect(changed({ a: { yellow: 1, red: 0 } }, { a: { yellow: 1, red: 0 } })).toBe(false)
    expect(changed({ a: { yellow: 1, red: 0 } }, { a: { yellow: 2, red: 0 } })).toBe(true)
    expect(changed({ a: [2, 5] }, { a: [2, 5] })).toBe(false)
    expect(changed({ a: [2] }, { a: [2], b: [2] })).toBe(true)
  })
})
