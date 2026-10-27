import { describe, it, expect } from 'vitest'
import { calcGroupStandings } from '../standings'
import { getSportDef } from '../sports'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'

const football = getSportDef('football')
const hockey = getSportDef('hockey')

function group(teamIds: string[], tiebreaker: Group['tiebreaker'] = 'score_then_h2h'): Group {
  return { id: 'g', name: 'A', team_ids: teamIds, schedule: 'once', tiebreaker, start_time: '', match_duration: 20, break_between: 5 } as Group
}

let seq = 0
function m(home: string, away: string, hs: number, as: number, extra: Partial<Match> = {}): Match {
  return {
    id: `m${++seq}`, group_id: 'g', round: '', home_id: home, away_id: away,
    home_score: hs, away_score: as, played: true, scheduled_time: '', ...extra,
  }
}

const row = (rows: ReturnType<typeof calcGroupStandings>, id: string) => rows.find(r => r.id === id)!

describe('calcGroupStandings — fotbal', () => {
  it('počítá body 3/1/0, skóre a pořadí', () => {
    const rows = calcGroupStandings(group(['A', 'B', 'C']), [
      m('A', 'B', 2, 0),
      m('B', 'C', 1, 1),
      m('C', 'A', 0, 3),
    ], football)
    expect(row(rows, 'A')).toMatchObject({ played: 2, w: 2, d: 0, l: 0, gf: 5, ga: 0, gd: 5, pts: 6 })
    expect(row(rows, 'B')).toMatchObject({ played: 2, w: 0, d: 1, l: 1, pts: 1 })
    expect(row(rows, 'C')).toMatchObject({ played: 2, w: 0, d: 1, l: 1, pts: 1 })
    expect(rows[0].id).toBe('A')
  })

  it('ignoruje neodehrané zápasy a zápasy jiné skupiny', () => {
    const rows = calcGroupStandings(group(['A', 'B']), [
      m('A', 'B', 5, 0, { played: false }),
      m('A', 'B', 5, 0, { group_id: 'jina' }),
    ], football)
    expect(row(rows, 'A').played).toBe(0)
    expect(row(rows, 'B').pts).toBe(0)
  })

  it('tým bez zápasu je v tabulce s nulami', () => {
    const rows = calcGroupStandings(group(['A', 'B', 'C']), [m('A', 'B', 1, 0)], football)
    expect(rows).toHaveLength(3)
    expect(row(rows, 'C')).toMatchObject({ played: 0, pts: 0 })
  })

  it('score_then_h2h: při shodě bodů i skóre rozhoduje vzájemný zápas', () => {
    // A i B: 4 b., skóre 3:2; B vyhrál vzájemný zápas
    const rows = calcGroupStandings(group(['A', 'B', 'C']), [
      m('B', 'A', 1, 0),
      m('A', 'C', 3, 1),
      m('C', 'B', 1, 1),
    ], football)
    expect(row(rows, 'A')).toMatchObject({ pts: 3, gf: 3, ga: 2 })
    // B: výhra + remíza = 4 b. → první; test H2H níže na čisté shodě
    const tie = calcGroupStandings(group(['A', 'B', 'C', 'D']), [
      m('B', 'A', 2, 1),
      m('A', 'C', 2, 1),
      m('B', 'D', 1, 2),
    ], football)
    // A: 3 b., 3:3; B: 3 b., 3:3 → B vyhrál vzájemný zápas
    expect(row(tie, 'A')).toMatchObject({ pts: 3, gf: 3, gd: 0 })
    expect(row(tie, 'B')).toMatchObject({ pts: 3, gf: 3, gd: 0 })
    expect(tie.findIndex(r => r.id === 'B')).toBeLessThan(tie.findIndex(r => r.id === 'A'))
    expect(rows[0].id).toBe('B')
  })

  it('score_then_h2h: lepší rozdíl skóre předběhne vítěze vzájemného zápasu', () => {
    const rows = calcGroupStandings(group(['A', 'B', 'C']), [
      m('A', 'B', 1, 0),
      m('B', 'C', 5, 0),
      m('C', 'A', 1, 0),
    ], football)
    // A: 3 b., 1:1; B: 3 b., 5:1; C: 3 b., 1:5
    expect(rows.map(r => r.id)).toEqual(['B', 'A', 'C'])
  })

  it('h2h_first: vzájemný zápas má přednost před skóre', () => {
    const rows = calcGroupStandings(group(['A', 'B', 'C'], 'h2h_first'), [
      m('A', 'B', 1, 0),
      m('B', 'C', 5, 0),
      m('C', 'A', 1, 0),
    ], football)
    // A porazil B → A před B, i když má B lepší skóre
    expect(rows.findIndex(r => r.id === 'A')).toBeLessThan(rows.findIndex(r => r.id === 'B'))
  })

  it('score_first: rozhoduje jen body, rozdíl a vstřelené góly', () => {
    const rows = calcGroupStandings(group(['A', 'B'], 'score_first'), [
      m('A', 'B', 2, 2),
    ], football)
    expect(rows.map(r => r.pts)).toEqual([1, 1])
  })
})

describe('calcGroupStandings — hokej (3-2-1-0)', () => {
  it('výhra v základní době 3 b., po prodloužení 2/1 b., nájezdy 2/1 b.', () => {
    const rows = calcGroupStandings(group(['A', 'B', 'C']), [
      m('A', 'B', 3, 1, { decided_in: 'regulation' }),
      m('B', 'C', 2, 1, { decided_in: 'ot' }),
      m('C', 'A', 4, 3, { decided_in: 'so' }),
    ], hockey)
    expect(row(rows, 'A')).toMatchObject({ w: 1, l: 1, otw: 0, otl: 1, pts: 3 + 1 })
    expect(row(rows, 'B')).toMatchObject({ w: 1, l: 1, otw: 1, otl: 0, pts: 0 + 2 })
    expect(row(rows, 'C')).toMatchObject({ w: 1, l: 1, otw: 1, otl: 1, pts: 1 + 2 })
  })

  it('decided_in null = základní hrací doba', () => {
    const rows = calcGroupStandings(group(['A', 'B']), [m('A', 'B', 2, 1, { decided_in: null })], hockey)
    expect(row(rows, 'A').pts).toBe(3)
    expect(row(rows, 'B').pts).toBe(0)
  })

  it('H2H u hokeje počítá body poraženého po prodloužení', () => {
    // A a B mají shodně body i skóre; vzájemný zápas vyhrál B po prodloužení (B 2 b., A 1 b.)
    const rows = calcGroupStandings(group(['A', 'B', 'C', 'D']), [
      m('A', 'B', 1, 2, { decided_in: 'ot' }),
      m('A', 'C', 2, 1, { decided_in: 'ot' }),
      m('B', 'D', 1, 2, { decided_in: 'ot' }),
    ], hockey)
    // A: 1 + 2 = 3 b., skóre 3:3; B: 2 + 1 = 3 b., skóre 3:3
    expect(row(rows, 'A')).toMatchObject({ pts: 3, gd: 0, gf: 3 })
    expect(row(rows, 'B')).toMatchObject({ pts: 3, gd: 0, gf: 3 })
    expect(rows.findIndex(r => r.id === 'B')).toBeLessThan(rows.findIndex(r => r.id === 'A'))
  })

  it('fotbal ignoruje decided_in (žádné body za prodloužení)', () => {
    const rows = calcGroupStandings(group(['A', 'B']), [m('A', 'B', 2, 1, { decided_in: 'ot' })], football)
    expect(row(rows, 'A')).toMatchObject({ pts: 3, otw: 0 })
    expect(row(rows, 'B')).toMatchObject({ pts: 0, otl: 0 })
  })
})
