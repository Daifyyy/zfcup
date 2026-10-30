// Logika „od teď“ pro TV: góly, začátek/konec zápasu, skupina, vítěz; opravy se nehlásí.
import { describe, expect, it } from 'vitest'
import { buildSnapshot, diffSnapshots, newScorers, type SnapshotInput } from '../tvEvents'

/* eslint-disable @typescript-eslint/no-explicit-any */
const T = { tips_lock_from: '2026-10-30', match_duration: 20 }
const at = (hhmm: string) => new Date(`2026-10-30T${hhmm}:00`)
const m = (id: string, h: number, a: number, played = false, extra: any = {}) =>
  ({ id, group_id: 'g', round: '', home_id: 'A', away_id: 'B', home_score: h, away_score: a, played, scheduled_time: '10:00', ...extra })
const input = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  tournament: T, groups: [{ id: 'g', name: 'Skupina A' }], matches: [m('m1', 0, 0)] as any,
  bracketRounds: [], bracketSlots: [], goals: [], bracketGoals: [], ...over,
})
const players = (team: string) => new Set(team === 'A' ? ['a1', 'a2'] : ['b1'])
const types = (e: { type: string }[]) => e.map(x => x.type)

describe('události TV', () => {
  it('gól v rozehraném zápase se střelcem', () => {
    const prev = buildSnapshot(input(), at('10:05'))
    const next = buildSnapshot(input({ matches: [m('m1', 1, 0)] as any, goals: [{ id: 'x', player_id: 'a2', match_id: 'm1', count: 1 }] as any }), at('10:06'))
    const ev = diffSnapshots(prev, next, players)
    expect(ev).toEqual([{ type: 'goal', key: 'goal:m1:1:0:A', gameId: 'm1', teamId: 'A', count: 1, scorers: ['a2'], h: 1, a: 0 }])
  })

  it('výsledek zadaný až po zápase = jen konec, žádné góly zpětně', () => {
    const prev = buildSnapshot(input(), at('12:00'))
    const next = buildSnapshot(input({ matches: [m('m1', 3, 1, true)] as any }), at('12:00'))
    expect(types(diffSnapshots(prev, next, players))).toEqual(['match_end', 'group_done'])
  })

  it('oprava odehraného zápasu ani snížení skóre / smazaný gól nic nehlásí', () => {
    const played = buildSnapshot(input({ matches: [m('m1', 3, 1, true)] as any }), at('12:00'))
    const fixed = buildSnapshot(input({ matches: [m('m1', 4, 1, true)] as any }), at('12:01'))
    expect(diffSnapshots(played, fixed, players)).toEqual([])
    const live = buildSnapshot(input({ matches: [m('m1', 2, 0)] as any, goals: [{ id: 'x', player_id: 'a1', match_id: 'm1', count: 2 }] as any }), at('10:10'))
    const lower = buildSnapshot(input({ matches: [m('m1', 1, 0)] as any, goals: [{ id: 'x', player_id: 'a1', match_id: 'm1', count: 1 }] as any }), at('10:11'))
    expect(diffSnapshots(live, lower, players)).toEqual([])
  })

  it('začátek zápasu podle času jen v den turnaje', () => {
    const before = buildSnapshot(input(), at('09:59'))
    const after = buildSnapshot(input(), at('10:00'))
    expect(types(diffSnapshots(before, after, players))).toEqual(['match_start'])
    const otherDay = { ...T, tips_lock_from: '2026-10-31' }
    expect(diffSnapshots(buildSnapshot(input({ tournament: otherDay }), at('09:59')), buildSnapshot(input({ tournament: otherDay }), at('10:00')), players)).toEqual([])
  })

  it('nasazení týmů do play-off není gól; vítěz po finále', () => {
    const rounds = [{ id: 'f', name: 'Finále', position: 0 }] as any
    const slot = (h: string | null, a: string | null, hs = 0, as = 0, played = false) => ({ id: 's', round_id: 'f', position: 0, home_id: h, away_id: a, home_score: hs, away_score: as, played })
    const s1 = buildSnapshot(input({ bracketRounds: rounds, bracketSlots: [slot('A', 'C')] as any }), at('15:00'))
    const s2 = buildSnapshot(input({ bracketRounds: rounds, bracketSlots: [slot('A', 'B', 0, 0)] as any }), at('15:00'))
    expect(diffSnapshots(s1, s2, players)).toEqual([])
    const s3 = buildSnapshot(input({ bracketRounds: rounds, bracketSlots: [slot('A', 'B', 2, 1, true)] as any }), at('15:30'))
    expect(types(diffSnapshots(s2, s3, players))).toEqual(['match_end', 'champion'])
  })

  it('střelec zapsaný dřív než skóre se najde proti staršímu stavu', () => {
    const base = buildSnapshot(input(), at('10:05'))
    const goalsFirst = buildSnapshot(input({ goals: [{ id: 'x', player_id: 'b1', match_id: 'm1', count: 1 }] as any }), at('10:06'))
    const scoreAfter = buildSnapshot(input({ matches: [m('m1', 0, 1)] as any, goals: [{ id: 'x', player_id: 'b1', match_id: 'm1', count: 1 }] as any }), at('10:06'))
    expect(diffSnapshots(base, goalsFirst, players)).toEqual([])
    const [ev] = diffSnapshots(goalsFirst, scoreAfter, players)
    expect(ev.type === 'goal' && ev.scorers).toEqual([]) // proti předchozímu stavu střelec chybí
    expect(newScorers(base, scoreAfter, 'm1', players('B'))).toEqual(['b1']) // proti staršímu ho hook najde
  })
})

import { announcementText, DEFAULT_ANNOUNCER } from '../announcer'
import { buildSpots } from '../../components/tv/TvSpot'

describe('hlasatel', () => {
  const ctx = {
    teamName: (id: string | null | undefined) => ({ A: 'Alfa', B: 'Beta' } as Record<string, string>)[id ?? ''] ?? '',
    playerName: (id: string) => ({ a1: 'Jan Novák', a2: 'Petr Malý' } as Record<string, string>)[id] ?? '',
    game: () => ({ home_id: 'A', away_id: 'B', h: 2, a: 1, label: 'Skupina A' }),
    groupName: () => 'Skupina A',
    partner: 'MegaBank',
  }
  it('gól se střelcem, stavem a partnerem; čísla bez dvojtečky', () => {
    const t = announcementText({ type: 'goal', key: 'k', gameId: 'm', teamId: 'A', count: 1, scorers: ['a1'], h: 2, a: 1 }, ctx, DEFAULT_ANNOUNCER)
    expect(t).toBe('Gól! Alfa, střelec Jan Novák. Stav Alfa Beta, 2 1. Gól vám přináší MegaBank.')
  })
  it('vypnutý typ a bez partnera', () => {
    expect(announcementText({ type: 'match_start', key: 'k', gameId: 'm' }, ctx, { ...DEFAULT_ANNOUNCER, starts: false })).toBeNull()
    const t = announcementText({ type: 'goal', key: 'k', gameId: 'm', teamId: 'B', count: 2, scorers: [], h: 2, a: 1 }, { ...ctx, partner: null }, DEFAULT_ANNOUNCER)
    expect(t).toBe('2 góly! Beta. Stav Alfa Beta, 2 1.')
  })
  it('konec zápasu: vítěz napřed', () => {
    expect(announcementText({ type: 'match_end', key: 'k', gameId: 'm' }, ctx, DEFAULT_ANNOUNCER)).toBe('Konec zápasu. Alfa vyhrává nad Beta 2 1.')
  })
})

describe('spoty na TV', () => {
  const sp = (id: string, tier: string, position = 0, logo = 'x') => ({ id, tournament_id: 't', name: id, logo_url: logo, website_url: '', position, tier }) as any
  it('generální 3×, hlavní 2×, ostatní 1×, bez loga se vynechá; oznámení mezi partnery', () => {
    const spots = buildSpots([sp('T', 'title'), sp('M', 'main'), sp('P', 'partner'), sp('X', 'partner', 1, '')],
      [{ id: 'a', icon: '', title: 'Oběd', body: '', position: 0 }] as any)
    const names = spots.map(s => (s.kind === 'partner' ? s.sponsor.id : `ann:${s.announcement.id}`))
    expect(names.filter(n => n === 'T')).toHaveLength(3)
    expect(names.filter(n => n === 'M')).toHaveLength(2)
    expect(names.filter(n => n === 'P')).toHaveLength(1)
    expect(names).not.toContain('X')
    expect(names).toContain('ann:a')
  })
  it('bez partnerů jen oznámení', () => {
    expect(buildSpots([], [{ id: 'a', icon: '', title: 'Oběd', body: '', position: 0 }] as any)).toHaveLength(1)
  })
})

import { voteOpen } from '../fanVote'

describe('hlasování diváků — kdy je otevřené', () => {
  const T2 = { tips_lock_from: '2026-10-30' }
  const g = (over: any = {}) => ({ played: false, home_score: 0, away_score: 0, scheduled_time: '10:00', home_id: 'A', away_id: 'B', ...over })
  it('jen v den zápasu, po výkopu nebo se skóre; odehraný ano', () => {
    expect(voteOpen(g(), T2, at('09:59'))).toBe('not_started')
    expect(voteOpen(g(), T2, at('10:00'))).toBe('open')
    expect(voteOpen(g({ home_score: 1 }), T2, at('09:30'))).toBe('open')
    expect(voteOpen(g({ played: true }), T2, at('18:00'))).toBe('open')
    expect(voteOpen(g({ played: true }), { tips_lock_from: '2026-10-29' }, at('18:00'))).toBe('closed')
    expect(voteOpen(g({ match_date: '2026-10-30' }), { tips_lock_from: '' }, at('11:00'))).toBe('open')
    expect(voteOpen(g({ away_id: null }), T2, at('11:00'))).toBe('closed')
  })
})
