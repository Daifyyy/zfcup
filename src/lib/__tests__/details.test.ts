import { describe, it, expect } from 'vitest'
import { findMatchDetail, matchEvents, teamFixtures, teamRecord, playerStats, rosterOf, fixtureId } from '../details'
import type { TournamentData } from '../TournamentDataContext'

/* eslint-disable @typescript-eslint/no-explicit-any */
function data(over: Partial<TournamentData> = {}, t: any = {}): TournamentData {
  return {
    tournament: { id: 'T', sport: 'football', format: 'groups', assists_enabled: true, cards_enabled: true, penalty_minutes_enabled: false, ...t } as any,
    teams: [
      { id: 'A', name: 'Alfa', color: '#000', logo_url: null },
      { id: 'B', name: 'Beta', color: '#000', logo_url: null },
    ] as any,
    players: [
      { id: 'a1', team_id: 'A', name: 'Novák', number: 9, role: null, avatar_url: null },
      { id: 'a2', team_id: 'A', name: 'Dvořák', number: 1, role: 'goalkeeper', avatar_url: null },
      { id: 'b1', team_id: 'B', name: 'Svoboda', number: null, role: null, avatar_url: null },
    ] as any,
    groups: [{ id: 'g1', name: 'Skupina A', team_ids: ['A', 'B'] }] as any,
    matches: [
      { id: 'm1', group_id: 'g1', round: '', home_id: 'A', away_id: 'B', home_score: 3, away_score: 1, played: true, scheduled_time: '10:00', referee_id: 'r1' },
      { id: 'm2', group_id: 'g1', round: '', home_id: 'B', away_id: 'A', home_score: 0, away_score: 0, played: false, scheduled_time: '11:00' },
    ] as any,
    goals: [
      { id: 'x1', player_id: 'a1', match_id: 'm1', count: 2 },
      { id: 'x2', player_id: 'a2', match_id: 'm1', count: 1 },
      { id: 'x3', player_id: 'b1', match_id: 'm1', count: 1 },
      { id: 'x4', player_id: 'gone', match_id: 'm1', count: 1 },
    ] as any,
    assists: [{ id: 'y1', player_id: 'a2', match_id: 'm1', count: 1 }] as any,
    cards: [{ id: 'c1', player_id: 'b1', match_id: 'm1', type: 'yellow' }] as any,
    penalties: [] as any,
    bracketRounds: [{ id: 'R', name: 'Finále', position: 1, scheduled_start: null, break_after: null }] as any,
    bracketSlots: [{ id: 's1', round_id: 'R', position: 0, home_id: 'B', away_id: 'A', home_score: 2, away_score: 1, played: true, scheduled_time: '15:00', decided_in: 'ot' }] as any,
    bracketGoals: [{ id: 'z1', player_id: 'b1', slot_id: 's1', count: 2 }, { id: 'z2', player_id: 'a1', slot_id: 's1', count: 1 }] as any,
    bracketAssists: [] as any,
    bracketCards: [] as any,
    bracketPenalties: [] as any,
    referees: [{ id: 'r1', name: 'Rozhodčí Jan' }] as any,
    bracketLoading: false,
    ...over,
  }
}

describe('findMatchDetail', () => {
  it('najde zápas skupiny s rozhodčím a skupinou', () => {
    const md = findMatchDetail(data(), 'm1')!
    expect(md.kind).toBe('group')
    expect(md.label).toBe('Skupina A')
    expect(md.referee).toBe('Rozhodčí Jan')
    expect(md.pitch).toBeNull()
  })
  it('najde play-off slot s kolem a PP', () => {
    const md = findMatchDetail(data(), 's1')!
    expect(md.kind).toBe('playoff')
    expect(md.label).toBe('Finále')
    expect(md.decided_in).toBe('ot')
  })
  it('neznámé id → null', () => {
    expect(findMatchDetail(data(), 'nic')).toBeNull()
  })
  it('jednodenní liga: hřiště podle pořadí zápasů ve stejném čase', () => {
    const d = data({
      matches: [
        { id: 'l1', group_id: null, round: '', home_id: 'A', away_id: 'B', home_score: 0, away_score: 0, played: false, scheduled_time: '10:00' },
        { id: 'l2', group_id: null, round: '', home_id: 'B', away_id: 'A', home_score: 0, away_score: 0, played: false, scheduled_time: '10:00' },
        { id: 'l3', group_id: null, round: '', home_id: 'A', away_id: 'B', home_score: 0, away_score: 0, played: false, scheduled_time: '10:20' },
      ] as any,
    }, { format: 'league' })
    expect(findMatchDetail(d, 'l1')!.pitch).toBe('Hřiště A')
    expect(findMatchDetail(d, 'l2')!.pitch).toBe('Hřiště B')
    expect(findMatchDetail(d, 'l3')!.pitch).toBeNull()
  })
  it('sezóna: štítek = kolo, bez hřiště', () => {
    const d = data({
      matches: [
        { id: 'k1', group_id: 'g1', round: '3. kolo', home_id: 'A', away_id: 'B', home_score: 0, away_score: 0, played: false, scheduled_time: '18:00', match_date: '2026-11-01' },
        { id: 'k2', group_id: 'g1', round: '3. kolo', home_id: 'B', away_id: 'A', home_score: 0, away_score: 0, played: false, scheduled_time: '18:00', match_date: '2026-11-01' },
      ] as any,
    }, { format: 'league', schedule_mode: 'season' })
    const md = findMatchDetail(d, 'k1')!
    expect(md.label).toBe('3. kolo')
    expect(md.pitch).toBeNull()
    expect(md.match_date).toBe('2026-11-01')
  })
})

describe('matchEvents', () => {
  it('rozdělí góly, asistence a karty na domácí a hosty', () => {
    const d = data()
    const ev = matchEvents(d, findMatchDetail(d, 'm1')!)
    expect(ev.home.goals.map(g => [g.player.name, g.value])).toEqual([['Novák', 2], ['Dvořák', 1]])
    expect(ev.away.goals.map(g => [g.player.name, g.value])).toEqual([['Svoboda', 1]])
    expect(ev.home.assists.map(a => a.player.name)).toEqual(['Dvořák'])
    expect(ev.away.cards).toHaveLength(1)
    expect(ev.unknown).toBe(1)
  })
  it('play-off slot bere bracket_* tabulky (domácí = home_id slotu)', () => {
    const d = data()
    const ev = matchEvents(d, findMatchDetail(d, 's1')!)
    expect(ev.home.goals.map(g => [g.player.name, g.value])).toEqual([['Svoboda', 2]])
    expect(ev.away.goals.map(g => g.player.name)).toEqual(['Novák'])
  })
  it('vypnuté moduly se nezobrazí', () => {
    const d = data({}, { assists_enabled: false, cards_enabled: false })
    const ev = matchEvents(d, findMatchDetail(d, 'm1')!)
    expect(ev.home.assists).toHaveLength(0)
    expect(ev.away.cards).toHaveLength(0)
  })
  it('trestné minuty se sčítají po hráčích', () => {
    const d = data({
      penalties: [
        { id: 'p1', player_id: 'b1', match_id: 'm1', minutes: 2 },
        { id: 'p2', player_id: 'b1', match_id: 'm1', minutes: 5 },
      ] as any,
    }, { penalty_minutes_enabled: true })
    const ev = matchEvents(d, findMatchDetail(d, 'm1')!)
    expect(ev.away.penalties.map(p => p.value)).toEqual([7])
  })
})

describe('tým', () => {
  it('bilance ze skupin i play-off, neodehrané se nepočítají', () => {
    const d = data()
    const fx = teamFixtures(d, 'A')
    expect(fx.map(fixtureId)).toEqual(['m1', 'm2', 's1'])
    expect(teamRecord(fx, 'A')).toEqual({ played: 2, w: 1, d: 0, l: 1, gf: 4, ga: 3 })
  })
  it('statistiky hráčů za celý turnaj a soupiska podle čísla', () => {
    const d = data()
    const st = playerStats(d, { assists: true, cards: true, penalties: false })
    expect(st.a1.goals).toBe(3)
    expect(st.b1.goals).toBe(3)
    expect(st.b1.cards).toEqual({ yellow: 1, red: 0, yellowRed: 0 })
    expect(rosterOf(d.players, 'A').map(p => p.name)).toEqual(['Dvořák', 'Novák'])
  })
})
