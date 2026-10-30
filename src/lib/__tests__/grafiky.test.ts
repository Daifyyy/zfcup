// Výpočty pro nové grafiky: nejlepší sestava, konečné pořadí, program a souhrn dne.
import { describe, expect, it } from 'vitest'
import { computeBestTeam, fieldCount, MAX_PER_TEAM, type BestTeamInput } from '../bestTeam'
import { computeFinalStandings, placeLabel, placementOf } from '../finalStandings'
import { defaultDay, paginate, playDays, programOf, summaryOf } from '../dayDigest'
import { getSportDef } from '../sports'
import type { Fixture } from '../fixtures'

/* eslint-disable @typescript-eslint/no-explicit-any */
const football = getSportDef('football')
const hockey = getSportDef('hockey')
const team = (id: string) => ({ id, name: `Tým ${id}`, color: '#000', logo_url: null })
const pl = (id: string, team_id: string, role: string | null = null) => ({ id, team_id, name: id, number: null, role, avatar_url: null })

describe('nejlepší sestava', () => {
  // A vyhraje oba zápasy, B a C prohrávají; A má hodně střelců
  const base = (): BestTeamInput => ({
    teams: [team('A'), team('B'), team('C')] as any,
    players: [
      pl('a1', 'A'), pl('a2', 'A'), pl('a3', 'A'), pl('aG', 'A', 'goalkeeper'),
      pl('b1', 'B'), pl('b2', 'B'), pl('bG', 'B', 'goalkeeper'),
      pl('c1', 'C'), pl('cG', 'C', 'both'),
    ] as any,
    games: [
      { id: 'm1', home_id: 'A', away_id: 'B', home_score: 4, away_score: 0, played: true, mvp_player_id: 'a3' },
      { id: 'm2', home_id: 'A', away_id: 'C', home_score: 3, away_score: 2, played: true },
      { id: 'm3', home_id: 'B', away_id: 'C', home_score: 1, away_score: 1, played: true },
      { id: 'm4', home_id: 'B', away_id: 'C', home_score: 9, away_score: 9, played: false },
    ],
    goals: [
      { player_id: 'a1', game_id: 'm1', count: 3 }, { player_id: 'a2', game_id: 'm2', count: 2 },
      { player_id: 'a3', game_id: 'm1', count: 1 }, { player_id: 'c1', game_id: 'm2', count: 2 },
      { player_id: 'b1', game_id: 'm3', count: 1 }, { player_id: 'c1', game_id: 'm3', count: 1 },
      { player_id: 'b2', game_id: 'm4', count: 5 }, // neodehraný zápas se nepočítá
    ],
    assists: [{ player_id: 'b2', game_id: 'm3', count: 1 }],
    cards: [{ player_id: 'c1', game_id: 'm2', type: 'red' }],
    penalties: [],
  })

  it('max. 2 hráči z týmu, pořadí podle bodů, brankář s nejmenším průměrem obdržených', () => {
    const t = computeBestTeam(base(), football)
    expect(t.field).toHaveLength(fieldCount(football))
    // limit na tým počítá i brankáře: A má brankáře aG + nejlepšího v poli a1 (10 b.)
    const fromA = [t.goalkeeper, ...t.field].filter(e => e?.player.team_id === 'A')
    expect(fromA).toHaveLength(MAX_PER_TEAM)
    expect(t.field.filter(e => e.player.team_id === 'A').map(e => e.player.id)).toEqual(['a1'])
    // dál podle bodů: c1 (9 − 3 za červenou = 6), b1 (3), b2 (asistence 2)
    expect(t.field.map(e => e.player.id)).toEqual(['a1', 'c1', 'b1', 'b2'])
    // A: obdržel 2 ve 2 zápasech (1,0/zápas) → nejlepší
    expect(t.goalkeeper?.player.id).toBe('aG')
    expect(t.goalkeeper?.keeper).toEqual({ against: 2, games: 2, cleanSheets: 1 })
  })

  it('červená karta snižuje body', () => {
    const t = computeBestTeam(base(), football)
    const c1 = t.field.find(e => e.player.id === 'c1')
    // c1: 3 góly ×3 = 9 − 3 (červená) = 6
    expect(c1?.score).toBe(6)
  })

  it('ruční obsazení místa má přednost a hráč se jinde neopakuje', () => {
    const t = computeBestTeam(base(), football, { overrides: { '0': 'cG', '1': 'a3' } })
    expect(t.goalkeeper?.player.id).toBe('cG')
    expect(t.goalkeeper?.manual).toBe(true)
    expect(t.field[0].player.id).toBe('a3')
    expect(t.field[0].manual).toBe(true)
    const ids = t.field.map(e => e.player.id)
    expect(new Set(ids).size).toBe(ids.length)
    // a3 je ručně → z A už jen jeden automatický (limit 2)
    expect(ids.filter(id => id.startsWith('a'))).toHaveLength(2)
  })

  it('tým kola: jen zápasy v rozsahu', () => {
    const t = computeBestTeam(base(), football, { scope: new Set(['m3']) })
    expect(t.field.map(e => e.player.id).sort()).toEqual(['b1', 'b2', 'c1'])
  })

  it('bez brankářů v soupiskách → brankář null; hokej má 5 v poli', () => {
    const input = base()
    input.players = input.players.map(p => ({ ...p, role: null }))
    expect(computeBestTeam(input, football).goalkeeper).toBeNull()
    expect(fieldCount(hockey)).toBe(5)
  })

  it('málo kandidátů → doplní i přes limit na tým', () => {
    const input = base()
    input.goals = input.goals.filter(g => g.player_id.startsWith('a'))
    input.assists = []; input.cards = []
    const t = computeBestTeam(input, football)
    expect(t.field.map(e => e.player.id)).toEqual(['a1', 'a2', 'a3'])
  })
})

describe('konečné pořadí', () => {
  const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(team) as any
  const slot = (id: string, round_id: string, h: string, a: string, hs: number, as: number, extra: any = {}) =>
    ({ id, round_id, position: 0, home_id: h, away_id: a, home_score: hs, away_score: as, played: true, ...extra })
  const rounds = [
    { id: 'qf', name: 'Čtvrtfinále', position: 0 },
    { id: 'sf', name: 'Semifinále', position: 1 },
    { id: 'o3', name: 'O 3. místo', position: 2 },
    { id: 'f', name: 'Finále', position: 3 },
  ] as any

  it('play-off: finále, o 3. místo, poražení ve čtvrtfinále sdílí 5.–8.', () => {
    const slots = [
      slot('q1', 'qf', 'A', 'H', 2, 0), slot('q2', 'qf', 'B', 'G', 1, 0), slot('q3', 'qf', 'C', 'F', 3, 1), slot('q4', 'qf', 'D', 'E', 0, 1),
      slot('s1', 'sf', 'A', 'B', 2, 1), slot('s2', 'sf', 'C', 'E', 0, 2),
      slot('t', 'o3', 'B', 'C', 1, 2),
      slot('fi', 'f', 'A', 'E', 3, 2, { decided_in: 'ot' }),
    ] as any
    const r = computeFinalStandings({ teams, groups: [], matches: [], bracketRounds: rounds, bracketSlots: slots }, football)
    expect(r.decided).toBe(true)
    expect(r.champion?.id).toBe('A')
    expect(r.finalScore).toBe('3:2 PP')
    expect(r.rows.slice(0, 4).map(x => [x.team.id, placeLabel(x)])).toEqual([['A', '1.'], ['E', '2.'], ['C', '3.'], ['B', '4.']])
    expect(r.rows.slice(4).map(x => placeLabel(x))).toEqual(['5.–8.', '5.–8.', '5.–8.', '5.–8.'])
  })

  it('zápasy o umístění 5.–8. mají přednost před sdíleným místem', () => {
    const r2 = [...rounds, { id: 'o5', name: 'O 5-6. místo', position: 4 }, { id: 'o7', name: 'O 7. místo', position: 5 }] as any
    const slots = [
      slot('q1', 'qf', 'A', 'H', 2, 0), slot('q2', 'qf', 'B', 'G', 1, 0), slot('q3', 'qf', 'C', 'F', 3, 1), slot('q4', 'qf', 'D', 'E', 0, 1),
      slot('s1', 'sf', 'A', 'B', 2, 1), slot('s2', 'sf', 'C', 'E', 0, 2),
      slot('t', 'o3', 'B', 'C', 1, 2), slot('fi', 'f', 'A', 'E', 3, 2),
      slot('p5', 'o5', 'H', 'D', 2, 1), slot('p7', 'o7', 'G', 'F', 0, 1),
    ] as any
    const r = computeFinalStandings({ teams, groups: [], matches: [], bracketRounds: r2, bracketSlots: slots }, football)
    expect(r.rows.map(x => [x.team.id, placeLabel(x)]).slice(4)).toEqual([['H', '5.'], ['D', '6.'], ['F', '7.'], ['G', '8.']])
  })

  it('neodehrané finále = nerozhodnuto; liga bez play-off podle tabulky po odehrání všeho', () => {
    const slots = [slot('fi', 'f', 'A', 'E', 0, 0, { played: false })] as any
    expect(computeFinalStandings({ teams, groups: [], matches: [], bracketRounds: rounds, bracketSlots: slots }, football).decided).toBe(false)
    const group = { id: 'g', name: 'Liga', team_ids: ['A', 'B', 'C'] } as any
    const m = (id: string, h: string, a: string, hs: number, as: number, played = true) => ({ id, group_id: 'g', round: '', home_id: h, away_id: a, home_score: hs, away_score: as, played, scheduled_time: '' })
    const matches = [m('1', 'A', 'B', 0, 1), m('2', 'B', 'C', 2, 0), m('3', 'C', 'A', 1, 1)] as any
    const r = computeFinalStandings({ teams, groups: [group], matches, bracketRounds: [], bracketSlots: [] }, football)
    expect(r.champion?.id).toBe('B')
    expect(r.rows.map(x => x.team.id)).toEqual(['B', 'A', 'C'])
    expect(computeFinalStandings({ teams, groups: [group], matches: [...matches, m('4', 'A', 'C', 0, 0, false)], bracketRounds: [], bracketSlots: [] }, football).decided).toBe(false)
  })

  it('číslo místa z názvu kola', () => {
    expect(placementOf('O 3. místo')).toBe(3)
    expect(placementOf('O 5-6. místo')).toBe(5)
    expect(placementOf('Finále')).toBeNull()
  })
})

describe('program a souhrn dne', () => {
  const fx = (key: string, date: string | null, order: number, played: boolean, home: string | null = 'A'): Fixture =>
    ({ key, kind: 'group', home_id: home, away_id: 'B', home_score: 0, away_score: 0, played, scheduled_time: null, match_date: date, label: '', order })

  it('jednodenní turnaj = jeden den; bez týmů se nepočítá', () => {
    const days = playDays([fx('a', null, 2, true), fx('b', null, 1, false), fx('c', null, 3, false, null)], false)
    expect(days).toHaveLength(1)
    expect(programOf(days[0]).map(f => f.key)).toEqual(['b', 'a'])
    expect(summaryOf(days[0]).map(f => f.key)).toEqual(['a'])
  })

  it('sezóna: dny podle data; výchozí den dnes / další (program) / poslední odehraný (souhrn)', () => {
    const days = playDays([fx('a', '2026-10-25', 1, true), fx('b', '2026-11-01', 1, false), fx('c', '2026-11-08', 1, false)], true)
    expect(days.map(d => d.date)).toEqual(['2026-10-25', '2026-11-01', '2026-11-08'])
    expect(defaultDay(days, 'program', '2026-10-30')?.date).toBe('2026-11-01')
    expect(defaultDay(days, 'summary', '2026-10-30')?.date).toBe('2026-10-25')
    expect(defaultDay(days, 'program', '2026-11-08')?.date).toBe('2026-11-08')
  })

  it('stránkování', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(paginate([], 3)).toEqual([[]])
  })
})
