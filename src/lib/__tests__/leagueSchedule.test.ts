import { describe, it, expect } from 'vitest'
import {
  generateLeagueSchedule, generateSeasonSchedule, leagueMatchCount, leagueSlotCount,
  addDays, roundNumber, compareRounds,
} from '../leagueSchedule'

const teams = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`)
const pairKey = (a: string, b: string) => [a, b].sort().join('-')

/** Každá dvojice právě jednou (nebo `times`×), nikdo nehraje sám se sebou. */
function expectRoundRobin(ms: { home_id: string; away_id: string }[], n: number, times = 1) {
  const counts = new Map<string, number>()
  for (const m of ms) {
    expect(m.home_id).not.toBe(m.away_id)
    counts.set(pairKey(m.home_id, m.away_id), (counts.get(pairKey(m.home_id, m.away_id)) ?? 0) + 1)
  }
  expect(counts.size).toBe((n * (n - 1)) / 2)
  for (const c of counts.values()) expect(c).toBe(times)
}

describe('generateLeagueSchedule (jednodenní liga)', () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10]) {
    it(`${n} týmů: každý s každým právě jednou, počet zápasů sedí`, () => {
      const ms = generateLeagueSchedule(teams(n), '09:00', 20, 5, undefined, undefined, 2)
      expect(ms).toHaveLength(leagueMatchCount(n))
      expectRoundRobin(ms, n)
    })
  }

  it('v jednom čase hraje každý tým nejvýš jednou a na hřištích je nejvýš numPitches zápasů', () => {
    for (const pitches of [1, 2, 3, 4]) {
      const ms = generateLeagueSchedule(teams(8), '09:00', 15, 5, undefined, undefined, pitches)
      const bySlot = new Map<string, typeof ms>()
      for (const m of ms) bySlot.set(m.scheduled_time, [...(bySlot.get(m.scheduled_time) ?? []), m])
      expect(bySlot.size).toBe(leagueSlotCount(8, pitches))
      for (const slot of bySlot.values()) {
        expect(slot.length).toBeLessThanOrEqual(pitches)
        const ids = slot.flatMap(m => [m.home_id, m.away_id])
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('časy jdou po (délka + přestávka) a přeskočí přestávku', () => {
    const ms = generateLeagueSchedule(teams(4), '10:00', 20, 10, '10:30', 30, 1)
    const times = [...new Set(ms.map(m => m.scheduled_time))]
    // 10:00, (10:30–11:00 pauza) 11:00, 11:30, ...
    expect(times.slice(0, 3)).toEqual(['10:00', '11:00', '11:30'])
  })

  it('bez času začátku vrací prázdné časy', () => {
    const ms = generateLeagueSchedule(teams(4), '', 20, 5)
    expect(ms.every(m => m.scheduled_time === '')).toBe(true)
  })
})

describe('leagueSlotCount / leagueMatchCount', () => {
  it('odpovídá vzorci z CLAUDE.md', () => {
    expect(leagueMatchCount(9)).toBe(36)
    expect(leagueSlotCount(9, 2)).toBe(9 * 2) // 9 kol × ceil(4/2)
    expect(leagueSlotCount(8, 2)).toBe(7 * 2)
    expect(leagueSlotCount(6, 3)).toBe(5 * 1)
  })
})

describe('generateSeasonSchedule (sezóna po kolech)', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 12, 16]) {
    it(`${n} týmů jednokolově: každý s každým jednou, v kole hraje tým nejvýš jednou`, () => {
      const ms = generateSeasonSchedule(teams(n), { twice: false, firstDate: '2026-09-05', intervalDays: 7, kickoffTime: '18:00' })
      expectRoundRobin(ms, n)
      const rounds = new Map<number, string[]>()
      for (const m of ms) rounds.set(m.roundNo, [...(rounds.get(m.roundNo) ?? []), m.home_id, m.away_id])
      expect(rounds.size).toBe(n % 2 === 0 ? n - 1 : n)
      for (const ids of rounds.values()) expect(new Set(ids).size).toBe(ids.length)
    })
  }

  it('dvoukolově: každá dvojice 2×, jednou doma a jednou venku', () => {
    const ms = generateSeasonSchedule(teams(6), { twice: true, firstDate: '2026-09-05', intervalDays: 7, kickoffTime: '18:00' })
    expectRoundRobin(ms, 6, 2)
    const directed = new Set(ms.map(m => `${m.home_id}>${m.away_id}`))
    expect(directed.size).toBe(ms.length)
  })

  it('domácí zápasy jsou vyrovnané (rozdíl nejvýš 1)', () => {
    for (const n of [4, 5, 6, 7, 8]) {
      const ms = generateSeasonSchedule(teams(n), { twice: false, firstDate: '2026-09-05', intervalDays: 7, kickoffTime: '18:00' })
      const home = new Map<string, number>()
      for (const m of ms) home.set(m.home_id, (home.get(m.home_id) ?? 0) + 1)
      const counts = teams(n).map(t => home.get(t) ?? 0)
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })

  it('kola mají datum po intervalu a název „N. kolo“', () => {
    const ms = generateSeasonSchedule(teams(4), { twice: false, firstDate: '2026-09-05', intervalDays: 7, kickoffTime: '18:00' })
    const r1 = ms.filter(m => m.roundNo === 1), r3 = ms.filter(m => m.roundNo === 3)
    expect(r1.every(m => m.match_date === '2026-09-05' && m.round === '1. kolo' && m.scheduled_time === '18:00')).toBe(true)
    expect(r3.every(m => m.match_date === '2026-09-19')).toBe(true)
  })

  it('méně než 2 týmy = prázdný rozpis', () => {
    expect(generateSeasonSchedule(['A'], { twice: false, firstDate: '2026-09-05', intervalDays: 7, kickoffTime: '' })).toEqual([])
  })
})

describe('pomocné funkce', () => {
  it('addDays přes konec měsíce, roku a přechod času', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31')
  })

  it('kola se řadí číselně, ostatní názvy abecedně za nimi', () => {
    expect(roundNumber('12. kolo')).toBe(12)
    expect(roundNumber('Skupina A')).toBe(Infinity)
    expect(['10. kolo', '2. kolo', 'Skupina A', '1. kolo'].sort(compareRounds))
      .toEqual(['1. kolo', '2. kolo', '10. kolo', 'Skupina A'])
  })
})
