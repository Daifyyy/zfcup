import { describe, expect, it } from 'vitest'
import { diplomaList, DEFAULT_DIPLOMA_OPTIONS } from '../diplomas'
import type { TournamentData } from '../TournamentDataContext'

/* eslint-disable @typescript-eslint/no-explicit-any */
const team = (id: string) => ({ id, name: `Tým ${id}`, color: '#000', logo_url: null })
const pl = (id: string, team_id: string, role: string | null = null) => ({ id, team_id, name: `Hráč ${id}`, number: null, role, avatar_url: null })
const slot = (id: string, round_id: string, h: string, a: string, hs: number, as: number, played = true) =>
  ({ id, round_id, position: 0, home_id: h, away_id: a, home_score: hs, away_score: as, played })

function data(finalPlayed: boolean, over: any = {}): TournamentData {
  return {
    tournament: { id: 'T', sport: 'football', assists_enabled: false, cards_enabled: false, penalty_minutes_enabled: false, best_team: null } as any,
    teams: ['A', 'B', 'C', 'D'].map(team) as any,
    players: [pl('a1', 'A'), pl('aG', 'A', 'goalkeeper'), pl('b1', 'B'), pl('c1', 'C'), pl('d1', 'D')] as any,
    groups: [], matches: [],
    bracketRounds: [{ id: 'sf', name: 'Semifinále', position: 0 }, { id: 'o3', name: 'O 3. místo', position: 1 }, { id: 'f', name: 'Finále', position: 2 }] as any,
    bracketSlots: [
      slot('s1', 'sf', 'A', 'C', 2, 0), slot('s2', 'sf', 'B', 'D', 1, 0),
      slot('t', 'o3', 'C', 'D', 3, 1), slot('fi', 'f', 'A', 'B', 2, 1, finalPlayed),
    ] as any,
    goals: [], assists: [], cards: [], penalties: [],
    bracketGoals: [
      { id: 'g1', player_id: 'a1', slot_id: 's1', count: 2 }, { id: 'g2', player_id: 'c1', slot_id: 't', count: 2 },
      { id: 'g3', player_id: 'b1', slot_id: 's2', count: 1 },
    ] as any,
    bracketAssists: [], bracketCards: [], bracketPenalties: [], referees: [], bracketLoading: false,
    ...over,
  } as TournamentData
}

describe('diplomy', () => {
  it('pódium s medailemi, střelci při shodě všichni, hráč a brankář', () => {
    const { decided, diplomas } = diplomaList(data(true), DEFAULT_DIPLOMA_OPTIONS)
    expect(decided).toBe(true)
    const places = diplomas.filter(x => x.kind === 'place')
    expect(places.map(x => [x.recipient, x.title, x.medal])).toEqual([['Tým A', 'za 1. místo', 1], ['Tým B', 'za 2. místo', 2], ['Tým C', 'za 3. místo', 3]])
    expect(diplomas.filter(x => x.kind === 'scorer').map(x => x.player?.id).sort()).toEqual(['a1', 'c1'])
    expect(diplomas.find(x => x.kind === 'scorer')?.detail).toBe('2 góly')
    expect(diplomas.some(x => x.kind === 'player')).toBe(true)
    expect(diplomas.find(x => x.kind === 'keeper')?.player?.id).toBe('aG')
  })

  it('všechna umístění vč. 4.; bez umístění; nerozhodnutý turnaj nemá místa', () => {
    expect(diplomaList(data(true), { ...DEFAULT_DIPLOMA_OPTIONS, places: 'all' }).diplomas.filter(x => x.kind === 'place')).toHaveLength(4)
    expect(diplomaList(data(true), { ...DEFAULT_DIPLOMA_OPTIONS, places: 'none' }).diplomas.some(x => x.kind === 'place')).toBe(false)
    const open = diplomaList(data(false), DEFAULT_DIPLOMA_OPTIONS)
    expect(open.decided).toBe(false)
    expect(open.diplomas.some(x => x.kind === 'place')).toBe(false)
    expect(open.diplomas.some(x => x.kind === 'scorer')).toBe(true)
  })

  it('hráč turnaje určený ručně na místě 1', () => {
    const d = data(true, { tournament: { id: 'T', sport: 'football', best_team: { slots: { '1': 'd1' } } } })
    expect(diplomaList(d, DEFAULT_DIPLOMA_OPTIONS).diplomas.find(x => x.kind === 'player')?.player?.id).toBe('d1')
  })
})
