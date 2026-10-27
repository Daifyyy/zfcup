import { describe, it, expect } from 'vitest'
import { getMatchState, parseHHMM, matchDay } from '../matchState'

// Lokální čas 27. 10. 2026 10:15
const now = new Date(2026, 9, 27, 10, 15)
const tournament = { tips_lock_from: '2026-10-27', match_duration: 20 }

describe('getMatchState', () => {
  it('odehraný zápas je vždy final', () => {
    expect(getMatchState({ played: true, scheduled_time: '10:10' }, tournament, now)).toBe('final')
  })

  it('v okně začátek + délka v den turnaje je live', () => {
    expect(getMatchState({ played: false, scheduled_time: '10:00' }, tournament, now)).toBe('live')
    expect(getMatchState({ played: false, scheduled_time: '10:15' }, tournament, now)).toBe('live')
  })

  it('mimo okno je scheduled (konec okna je výlučný)', () => {
    expect(getMatchState({ played: false, scheduled_time: '09:55' }, tournament, now)).toBe('scheduled')
    expect(getMatchState({ played: false, scheduled_time: '10:16' }, tournament, now)).toBe('scheduled')
  })

  it('jiný den než den turnaje není nikdy live', () => {
    expect(getMatchState({ played: false, scheduled_time: '10:10' }, { ...tournament, tips_lock_from: '2026-10-26' }, now)).toBe('scheduled')
  })

  it('bez známého data není nikdy live', () => {
    expect(getMatchState({ played: false, scheduled_time: '10:10' }, { match_duration: 20 }, now)).toBe('scheduled')
    expect(getMatchState({ played: false, scheduled_time: '10:10' }, null, now)).toBe('scheduled')
  })

  it('sezónní režim: rozhoduje match_date zápasu', () => {
    const season = { tips_lock_from: '', match_duration: 60 }
    expect(getMatchState({ played: false, scheduled_time: '09:30', match_date: '2026-10-27' }, season, now)).toBe('live')
    expect(getMatchState({ played: false, scheduled_time: '09:30', match_date: '2026-11-03' }, season, now)).toBe('scheduled')
  })

  it('bez času nebo s neplatným časem je scheduled', () => {
    expect(getMatchState({ played: false, scheduled_time: '' }, tournament, now)).toBe('scheduled')
    expect(getMatchState({ played: false, scheduled_time: 'TBD' }, tournament, now)).toBe('scheduled')
  })

  it('výchozí délka zápasu je 20 min', () => {
    expect(getMatchState({ played: false, scheduled_time: '09:56' }, { tips_lock_from: '2026-10-27' }, now)).toBe('live')
    expect(getMatchState({ played: false, scheduled_time: '09:55' }, { tips_lock_from: '2026-10-27' }, now)).toBe('scheduled')
  })
})

describe('parseHHMM / matchDay', () => {
  it('parsuje HH:MM i H:MM', () => {
    expect(parseHHMM('09:05')).toBe(545)
    expect(parseHHMM('9:05')).toBe(545)
    expect(parseHHMM(' 18:30 ')).toBe(1110)
    expect(parseHHMM('')).toBeNull()
    expect(parseHHMM(null)).toBeNull()
  })

  it('den zápasu: vlastní datum má přednost před datem turnaje', () => {
    expect(matchDay({ played: false, match_date: '2026-11-01' }, tournament)).toBe('2026-11-01')
    expect(matchDay({ played: false }, tournament)).toBe('2026-10-27')
    expect(matchDay({ played: false }, null)).toBeNull()
  })
})
