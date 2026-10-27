// Integrační test všech formátů play-off: struktura → nasazení → odehrání všech
// zápasů přes autoAdvance (stejně jako BracketTab.saveSlot) → kontrola výsledku.
// Supabase je nahrazen paměťovou „DB“ — formáty používají jen insert a update().eq().
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'

type Row = Record<string, unknown> & { id: string }
const db: { bracket_rounds: Row[]; bracket_slots: Row[] } = { bracket_rounds: [], bracket_slots: [] }
let idSeq = 0

vi.mock('../supabase', () => {
  const from = (table: 'bracket_rounds' | 'bracket_slots') => ({
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      const list = (Array.isArray(rows) ? rows : [rows]).map(r => ({ id: `${table}-${++idSeq}`, ...r }))
      db[table].push(...list)
      const res = { data: Array.isArray(rows) ? list : list[0], error: null }
      return Object.assign(Promise.resolve(res), {
        select: () => ({ single: () => Promise.resolve({ data: list[0], error: null }) }),
      })
    },
    update(patch: Record<string, unknown>) {
      return {
        eq(col: string, val: unknown) {
          for (const r of db[table]) if (r[col] === val) Object.assign(r, patch)
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  })
  return { supabase: { from } }
})

// Import až po vi.mock (vitest mock hoistuje, ale pro čitelnost)
const { TOURNAMENT_FORMATS, getFormatDef } = await import('../formats')
const { getSportDef } = await import('../sports')

const football = getSportDef('football')

// Síla týmu: menší = lepší. Všichni vítězové skupin jsou silnější než všichni druzí atd.
const strength = (teamId: string) => {
  const [, g, i] = /^G(\d+)T(\d+)$/.exec(teamId)!
  return Number(i) * 100 + Number(g)
}
const stronger = (a: string, b: string) => (strength(a) < strength(b) ? a : b)

function makeGroups(numGroups: number, perGroup: number, league = false): { groups: Group[]; matches: Match[] } {
  const groups: Group[] = []
  const matches: Match[] = []
  let mid = 0
  for (let g = 0; g < numGroups; g++) {
    const ids = Array.from({ length: perGroup }, (_, i) => `G${g}T${i}`)
    groups.push({
      // ligové formáty hledají skupinu „Liga“ (vytváří ji GroupsTab)
      id: `grp${g}`, name: league ? 'Liga' : String.fromCharCode(65 + g), team_ids: ids, schedule: 'once',
      tiebreaker: 'score_then_h2h', start_time: '', match_duration: 20, break_between: 5,
    } as Group)
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      matches.push({
        id: `m${++mid}`, group_id: `grp${g}`, round: '', home_id: ids[a], away_id: ids[b],
        home_score: 1, away_score: 0, played: true, scheduled_time: '',
      })
    }
  }
  return { groups, matches }
}

const rounds = () => [...db.bracket_rounds].sort((a, b) => (a.position as number) - (b.position as number)) as unknown as BracketRound[]
const slots = () => db.bracket_slots.map(s => ({ ...s })) as unknown as BracketSlot[]
const slotsOfRound = (roundId: string) => (db.bracket_slots as unknown as BracketSlot[])
  .filter(s => s.round_id === roundId).sort((a, b) => a.position - b.position)

/** Odehraje vše, co jde, stejně jako admin v BracketTab (silnější tým vyhraje 2:1). */
async function playAll(formatId: string) {
  const def = getFormatDef(formatId)!
  for (let pass = 0; pass < 30; pass++) {
    let progressed = false
    const allRounds = rounds()
    const maxPos = Math.max(...allRounds.map(r => r.position))
    for (const round of allRounds) {
      for (const slot of slotsOfRound(round.id)) {
        if (slot.played || !slot.home_id || !slot.away_id) continue
        const before = slots() // BracketTab předává stav před uložením
        const homeWins = stronger(slot.home_id, slot.away_id) === slot.home_id
        const data: Partial<BracketSlot> = {
          home_id: slot.home_id, away_id: slot.away_id,
          home_score: homeWins ? 2 : 1, away_score: homeWins ? 1 : 2, played: true,
        }
        Object.assign(slot, data)
        progressed = true
        if (round.position === maxPos) continue // finále: jen vyhodnocení vítěze
        await def.fns.autoAdvance({
          slot: { ...before.find(s => s.id === slot.id)!, ...data } as BracketSlot,
          data, currentRound: round, allRounds, allSlots: before,
        })
      }
    }
    if (!progressed) break
  }
}

const winnerOf = (s: BracketSlot) => ((s.home_score ?? 0) > (s.away_score ?? 0) ? s.home_id : s.away_id)

// Konfigurace: skupiny × týmů ve skupině (dost na postupující i útěchu)
const SETUP: Record<string, { groups: number; perGroup: number; advancing: number }> = {
  groups_sf:             { groups: 2, perGroup: 4, advancing: 2 },
  groups_six:            { groups: 3, perGroup: 4, advancing: 2 },
  groups_six_cross:      { groups: 3, perGroup: 4, advancing: 2 },
  groups_qf:             { groups: 4, perGroup: 4, advancing: 2 },
  groups_qf_full:        { groups: 4, perGroup: 4, advancing: 2 },
  groups_full_placement: { groups: 2, perGroup: 6, advancing: 4 },
  groups_ro16:           { groups: 8, perGroup: 4, advancing: 2 },
  mini_4teams:           { groups: 1, perGroup: 4, advancing: 4 },
  league_playoff:        { groups: 1, perGroup: 8, advancing: 6 },
  league_sf:             { groups: 1, perGroup: 6, advancing: 4 },
  knockout_8:            { groups: 0, perGroup: 0, advancing: 0 },
}

beforeEach(() => {
  db.bracket_rounds = []
  db.bracket_slots = []
})

describe('registr formátů', () => {
  it('obsahuje 12 formátů s unikátním id', () => {
    const ids = TOURNAMENT_FORMATS.map(f => f.id)
    expect(ids).toHaveLength(12)
    expect(new Set(ids).size).toBe(12)
  })

  it('league nemá play-off (generate nevytvoří žádné kolo)', async () => {
    await getFormatDef('league')!.fns.generate('t1')
    expect(db.bracket_rounds).toHaveLength(0)
  })
})

describe.each(Object.entries(SETUP))('formát %s', (formatId, cfg) => {
  it('odehraje se celý: všechny sloty obsazené, odehrané, vítěz = nejsilnější tým', async () => {
    const def = getFormatDef(formatId)!
    await def.fns.generate('t1')
    expect(db.bracket_rounds.length).toBeGreaterThan(0)

    if (formatId === 'knockout_8') {
      // bez skupin: admin nasazuje ručně → 1v8, 4v5, 2v7, 3v6
      const ids = Array.from({ length: 8 }, (_, i) => `G0T${i}`)
      const order: [number, number][] = [[0, 7], [3, 4], [1, 6], [2, 5]]
      const qf = slotsOfRound(rounds()[0].id)
      order.forEach(([h, a], i) => Object.assign(qf[i], { home_id: ids[h], away_id: ids[a] }))
    } else {
      const { groups, matches } = makeGroups(cfg.groups, cfg.perGroup, formatId.startsWith('league'))
      await def.fns.seed({
        groups, matches, bracketRounds: rounds(), bracketSlots: slots(),
        advancingPerGroup: cfg.advancing, sportDef: football,
      })
    }

    await playAll(formatId)

    const allRounds = rounds()
    for (const round of allRounds) {
      const rs = slotsOfRound(round.id)
      for (const s of rs) {
        expect(s.home_id, `${round.name} #${s.position} domácí`).toBeTruthy()
        expect(s.away_id, `${round.name} #${s.position} hosté`).toBeTruthy()
        expect(s.home_id).not.toBe(s.away_id)
        expect(s.played, `${round.name} #${s.position} odehráno`).toBe(true)
      }
      const inRound = rs.flatMap(s => [s.home_id, s.away_id])
      expect(new Set(inRound).size, `${round.name}: tým dvakrát v jednom kole`).toBe(inRound.length)
    }

    const final = slotsOfRound(allRounds[allRounds.length - 1].id)[0]
    const champion = winnerOf(final)
    expect(champion).toBe('G0T0')
  })
})
