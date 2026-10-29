import { describe, it, expect } from 'vitest'
import { summarizeEditions, allTimeTable, normalizeName, isPlacementRound, clubKeyOf, competitionHighlights, allTimePlayers, computeRecords } from '../history'
import { getSportDef } from '../sports'
import type { CompetitionHistoryData } from '../../hooks/useCompetitions'

const hockey = getSportDef('hockey')
const football = getSportDef('football')

/* eslint-disable @typescript-eslint/no-explicit-any */
const team = (id: string, tid: string, name: string, club_id: string | null = null) =>
  ({ id, tournament_id: tid, name, club_id, color: '#000', logo_url: null }) as any
const match = (id: string, tid: string, gid: string, h: string, a: string, hs: number, as: number, extra: any = {}) =>
  ({ id, tournament_id: tid, group_id: gid, round: '', home_id: h, away_id: a, home_score: hs, away_score: as, played: true, scheduled_time: '', ...extra }) as any

function empty(): CompetitionHistoryData {
  return {
    competition: null, editions: [], clubs: [], persons: [], teams: [], players: [], groups: [], matches: [],
    bracketRounds: [], bracketSlots: [], goals: [], bracketGoals: [], assists: [], bracketAssists: [],
    penalties: [], bracketPenalties: [], cards: [], bracketCards: [],
  }
}

/** 2 ročníky: 1. liga bez play-off (vyhraje Lvi), 2. s finále (Tygři porazí Lvy po prodloužení). */
function twoEditions(): CompetitionHistoryData {
  const d = empty()
  d.editions = [
    { id: 't1', edition: 1, name: 'Liga 2025' } as any,
    { id: 't2', edition: 2, name: 'Liga 2026' } as any,
  ]
  d.clubs = [{ id: 'cLvi', name: 'HC Lvi', color: '#f00', logo_url: null } as any]
  d.teams = [
    team('a1', 't1', 'HC Lvi', 'cLvi'), team('b1', 't1', 'Tygři'), team('c1', 't1', 'Orli'),
    team('a2', 't2', 'Lvi Praha', 'cLvi'), team('b2', 't2', 'TYGŘI'), team('c2', 't2', 'Orli'),
  ]
  d.groups = [
    { id: 'g1', tournament_id: 't1', name: 'Liga', team_ids: ['a1', 'b1', 'c1'], tiebreaker: 'score_then_h2h' } as any,
    { id: 'g2', tournament_id: 't2', name: 'Liga', team_ids: ['a2', 'b2', 'c2'], tiebreaker: 'score_then_h2h' } as any,
  ]
  d.matches = [
    match('m1', 't1', 'g1', 'a1', 'b1', 3, 1),
    match('m2', 't1', 'g1', 'b1', 'c1', 2, 1, { decided_in: 'ot' }),
    match('m3', 't1', 'g1', 'c1', 'a1', 0, 2),
    match('m4', 't2', 'g2', 'a2', 'b2', 1, 2),
    match('m5', 't2', 'g2', 'b2', 'c2', 4, 0),
    match('m6', 't2', 'g2', 'c2', 'a2', 1, 3),
  ]
  d.bracketRounds = [
    { id: 'r1', tournament_id: 't2', name: 'Finále', position: 1 } as any,
    { id: 'r0', tournament_id: 't2', name: 'O 3. místo', position: 0 } as any,
  ]
  d.bracketSlots = [
    { id: 's1', tournament_id: 't2', round_id: 'r1', position: 0, home_id: 'b2', away_id: 'a2', home_score: 3, away_score: 2, played: true, decided_in: 'ot' } as any,
    { id: 's0', tournament_id: 't2', round_id: 'r0', position: 0, home_id: 'c2', away_id: null, home_score: 0, away_score: 0, played: false } as any,
  ]
  return d
}

describe('summarizeEditions', () => {
  it('liga bez play-off: vítěz = 1. v konečné tabulce', () => {
    const [s1] = summarizeEditions(twoEditions(), hockey)
    expect(s1.decidedBy).toBe('table')
    expect(s1.champion?.id).toBe('a1')
    expect(s1.status).toBe('finished')
    expect(s1.goals).toBe(9)
  })

  it('s play-off: vítěz = vítěz finále (ne kola o umístění), skóre s PP', () => {
    const [, s2] = summarizeEditions(twoEditions(), hockey)
    expect(s2.decidedBy).toBe('playoff')
    expect(s2.champion?.id).toBe('b2')
    expect(s2.runnerUp?.id).toBe('a2')
    expect(s2.finalScore).toBe('3:2 PP')
    expect(s2.third).toBeUndefined()
  })

  it('rozehraný ročník bez finále je in_progress, prázdný not_started', () => {
    const d = twoEditions()
    d.bracketSlots = d.bracketSlots.map(s => ({ ...s, played: false }))
    d.editions.push({ id: 't3', edition: 3, name: 'Liga 2027' } as any)
    const [, s2, s3] = summarizeEditions(d, hockey)
    expect(s2.status).toBe('in_progress')
    expect(s2.champion).toBeUndefined()
    expect(s3.status).toBe('not_started')
  })
})

describe('allTimeTable', () => {
  it('páruje klub podle club_id i podle normalizovaného jména, sčítá ročníky a body', () => {
    const d = twoEditions()
    const rows = allTimeTable(d, hockey, summarizeEditions(d, hockey))
    const lvi = rows.find(r => r.key === 'club:cLvi')!
    const tygri = rows.find(r => r.key === 'name:tygri')!
    expect(rows).toHaveLength(3)
    expect(lvi).toMatchObject({ name: 'HC Lvi', editions: 2, titles: 1, finals: 1 })
    expect(tygri).toMatchObject({ editions: 2, titles: 1, finals: 1 })
    // Lvi: 3 + 3 (1. ročník) + 0 + 3 (2. ročník) + 1 (prohra ve finále po PP) = 10
    expect(lvi.pts).toBe(10)
    expect(lvi).toMatchObject({ w: 3, l: 2, otl: 1, played: 5 })
    // Tygři: 0 + 2 (PP) + 3 + 3 + 2 (finále PP) = 10
    expect(tygri.pts).toBe(10)
    expect(tygri).toMatchObject({ w: 4, otw: 2, l: 1 })
  })

  it('bez play-off se počítá jen základní část', () => {
    const d = twoEditions()
    const rows = allTimeTable(d, hockey, summarizeEditions(d, hockey), { includePlayoff: false })
    expect(rows.find(r => r.key === 'club:cLvi')!.played).toBe(4)
  })

  it('fotbal: remíza 1 bod, decided_in se ignoruje', () => {
    const d = twoEditions()
    d.matches[0] = { ...d.matches[0], home_score: 1, away_score: 1 }
    const rows = allTimeTable(d, football, summarizeEditions(d, football), { includePlayoff: false })
    const lvi = rows.find(r => r.key === 'club:cLvi')!
    expect(lvi.d).toBe(1)
    expect(lvi.otw + lvi.otl).toBe(0)
  })
})

describe('pomocné funkce', () => {
  it('normalizeName odstraní diakritiku, velikost písmen a interpunkci', () => {
    expect(normalizeName('  HC Tygři-Žďár ')).toBe('hc tygri zdar')
    expect(normalizeName('TYGŘI')).toBe(normalizeName('tygri'))
  })

  it('isPlacementRound pozná kola o umístění', () => {
    expect(isPlacementRound('O 3. místo')).toBe(true)
    expect(isPlacementRound('O 7-8. místo (SF)')).toBe(true)
    expect(isPlacementRound('Útěšné QF')).toBe(true)
    expect(isPlacementRound('Finále')).toBe(false)
    expect(isPlacementRound('Osmifinále')).toBe(false)
  })

  it('clubKeyOf preferuje club_id', () => {
    expect(clubKeyOf({ club_id: 'x', name: 'A' })).toBe('club:x')
    expect(clubKeyOf({ club_id: null, name: 'Á b' } as any)).toBe('name:a b')
  })
})

describe('competitionHighlights', () => {
  it('úřadující vítěz = poslední ročník s vítězem, nejúspěšnější klub podle titulů', () => {
    const d = twoEditions()
    const sums = summarizeEditions(d, hockey)
    const table = allTimeTable(d, hockey, sums)
    const hl = competitionHighlights(sums, table, allTimePlayers(d), computeRecords(d, table))
    expect(hl.champion?.edition).toBe(2)
    expect(hl.champion?.team.name).toBe(sums[1].champion?.name)
    expect(hl.mostTitles?.titles).toBeGreaterThanOrEqual(1)
  })
  it('bez dat nic nevymýšlí', () => {
    const hl = competitionHighlights([], [], [], {})
    expect(hl).toEqual({ champion: undefined, mostTitles: undefined, topScorer: undefined, biggestWin: undefined })
  })
})
