import { describe, it, expect } from 'vitest'
import { isOngoing, matchesQuery, searchTournaments, shiftISO } from '../tournamentSearch'

const t = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, ...extra })

describe('searchTournaments', () => {
  const list = [
    t('1', 'Firemní pohár 2026', { venue: 'Mšeno' }),
    t('2', 'Hokejová liga', { venue: 'Praha' }),
    t('3', 'Pohár tajný', { visibility: 'private' as const }),
    t('4', 'Letní pohár', { venue: 'Brno' }),
  ]
  it('hledá bez diakritiky a velikosti písmen, ve více polích', () => {
    expect(matchesQuery(list[0], 'firemni MSENO')).toBe(true)
    expect(matchesQuery(list[1], 'pohar')).toBe(false)
  })
  it('vrací vše, co uživatel smí vidět (i vlastní soukromé), nejdřív shodu na začátku názvu', () => {
    expect(searchTournaments(list, 'pohár').map(x => x.id)).toEqual(['3', '1', '4'])
    expect(searchTournaments(list, 'po').map(x => x.id)).toEqual(['3', '1', '4'])
  })
  it('krátký dotaz nic nevrací', () => {
    expect(searchTournaments(list, 'p')).toEqual([])
  })
})

describe('isOngoing', () => {
  it('jednodenní turnaj probíhá v den turnaje', () => {
    expect(isOngoing(t('a', 'A', { tips_lock_from: '2026-10-29' }), '2026-10-29', new Set())).toBe(true)
    expect(isOngoing(t('a', 'A', { tips_lock_from: '2026-10-28' }), '2026-10-29', new Set())).toBe(false)
  })
  it('sezóna podle aktivních zápasů', () => {
    expect(isOngoing(t('s', 'S', { schedule_mode: 'season' }), '2026-10-29', new Set(['s']))).toBe(true)
    expect(isOngoing(t('s', 'S', { schedule_mode: 'season' }), '2026-10-29', new Set())).toBe(false)
  })
  it('shiftISO přes hranici měsíce', () => {
    expect(shiftISO('2026-10-29', 14)).toBe('2026-11-12')
    expect(shiftISO('2026-03-01', -1)).toBe('2026-02-28')
  })
})
