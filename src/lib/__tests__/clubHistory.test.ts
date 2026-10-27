import { describe, it, expect } from 'vitest'
import { clubSeasons, clubTotals, headToHead, clubPlayers, type ClubHistoryData } from '../clubHistory'

/* eslint-disable @typescript-eslint/no-explicit-any */
const team = (id: string, tid: string, name: string, club_id: string | null) =>
  ({ id, tournament_id: tid, name, club_id, color: '#000', logo_url: null }) as any
const match = (id: string, tid: string, gid: string, h: string, a: string, hs: number, as: number) =>
  ({ id, tournament_id: tid, group_id: gid, round: '', home_id: h, away_id: a, home_score: hs, away_score: as, played: true, scheduled_time: '' }) as any

/** Klub Lvi hraje 2 turnaje: T1 liga bez play-off (vyhraje), T2 skupina + finále (prohraje finále). */
function data(): ClubHistoryData {
  return {
    club: { id: 'L', owner_id: 'o', competition_id: null, name: 'Lvi', slug: 'lvi', color: '#f00', logo_url: null },
    roster: [], competition: null, clubs: [], persons: [],
    editions: [
      { id: 'T1', name: 'Cup 2025', sport: 'football', edition: 1, created_at: '2025-05-01' } as any,
      { id: 'T2', name: 'Hokej 2026', sport: 'hockey', edition: null, created_at: '2026-01-01' } as any,
    ],
    teams: [
      team('l1', 'T1', 'Lvi', 'L'), team('t1', 'T1', 'Tygři', 'T'), team('o1', 'T1', 'Orli', null),
      team('l2', 'T2', 'HC Lvi', 'L'), team('t2', 'T2', 'Tygři', 'T'),
    ],
    players: [
      { id: 'p1', tournament_id: 'T1', team_id: 'l1', name: 'Novák', person_id: 'N' },
      { id: 'p2', tournament_id: 'T2', team_id: 'l2', name: 'Novák', person_id: 'N' },
      { id: 'p3', tournament_id: 'T2', team_id: 'l2', name: 'Svoboda', person_id: null },
    ] as any,
    groups: [
      { id: 'g1', tournament_id: 'T1', name: 'Liga', team_ids: ['l1', 't1', 'o1'], tiebreaker: 'score_first' },
      { id: 'g2', tournament_id: 'T2', name: 'Liga', team_ids: ['l2', 't2'], tiebreaker: 'score_first' },
    ] as any,
    matches: [
      match('m1', 'T1', 'g1', 'l1', 't1', 2, 0), match('m2', 'T1', 'g1', 'l1', 'o1', 1, 1), match('m3', 'T1', 'g1', 't1', 'o1', 0, 0),
      match('m4', 'T2', 'g2', 'l2', 't2', 4, 1),
    ],
    bracketRounds: [{ id: 'R', tournament_id: 'T2', name: 'Finále', position: 1 }] as any,
    bracketSlots: [{ id: 's1', tournament_id: 'T2', round_id: 'R', position: 0, home_id: 't2', away_id: 'l2', home_score: 3, away_score: 2, played: true, decided_in: 'ot' }] as any,
    goals: [{ id: 'g', tournament_id: 'T1', player_id: 'p1', match_id: 'm1', count: 2 }] as any,
    bracketGoals: [{ id: 'bg', tournament_id: 'T2', player_id: 'p2', slot_id: 's1', count: 1 }, { id: 'bg2', tournament_id: 'T2', player_id: 'p3', slot_id: 's1', count: 1 }] as any,
    assists: [], bracketAssists: [], penalties: [{ tournament_id: 'T2', player_id: 'p3', match_id: 'm4', minutes: 2 }], bracketPenalties: [], cards: [], bracketCards: [],
  }
}

describe('historie klubu', () => {
  it('umístění: titul z tabulky ligy, 2. místo z finále; nejnovější první', () => {
    const s = clubSeasons(data(), 'L')
    expect(s.map(x => [x.tournament.id, x.result.kind, x.result.label])).toEqual([
      ['T2', 'runnerUp', '2. místo'],
      ['T1', 'champion', 'Vítěz'],
    ])
    expect(s[1]).toMatchObject({ played: 2, w: 1, d: 1, l: 0, gf: 3, ga: 1, topScorer: { name: 'Novák', goals: 2 } })
    expect(s[0]).toMatchObject({ played: 2, w: 1, l: 1, gf: 6, ga: 4 })
  })
  it('souhrn', () => {
    expect(clubTotals(clubSeasons(data(), 'L'))).toEqual({ tournaments: 2, titles: 1, podiums: 2, played: 4, w: 2, d: 1, l: 1, gf: 9, ga: 5 })
  })
  it('vzájemné zápasy: soupeř podle klubu napříč turnaji, bez klubu podle jména', () => {
    const r = headToHead(data(), 'L')
    expect(r.map(x => [x.key, x.played, x.w, x.d, x.l, x.gf, x.ga])).toEqual([
      ['club:T', 3, 2, 0, 1, 8, 4],
      ['name:orli', 1, 0, 1, 0, 1, 1],
    ])
  })
  it('hráči: osoba se spojí napříč turnaji', () => {
    const p = clubPlayers(data(), 'L')
    expect(p.map(x => [x.name, x.tournaments, x.goals, x.pim])).toEqual([
      ['Novák', 2, 3, 0],
      ['Svoboda', 1, 1, 2],
    ])
  })
  it('rozpracovaný turnaj → pořadí v tabulce', () => {
    const d = data()
    d.matches = d.matches.filter(m => m.id !== 'm3').concat([{ ...d.matches[2], id: 'm3', played: false } as any])
    d.bracketSlots = []; d.bracketRounds = []
    const s = clubSeasons(d, 'L')
    const t1 = s.find(x => x.tournament.id === 'T1')!
    expect(t1.result).toEqual({ kind: 'rank', rank: 1, label: '1. v tabulce' })
  })
})
