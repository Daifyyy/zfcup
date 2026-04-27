import { addMinutes } from './constants'

export interface LeagueMatch {
  home_id: string
  away_id: string
  scheduled_time: string
}

function circleRounds(teamIds: string[]): Array<Array<[string, string]>> {
  const BYE = '__bye__'
  const arr = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE]
  const size = arr.length
  const fixed = arr[0]
  const rotatable = arr.slice(1)
  const rounds: Array<Array<[string, string]>> = []

  for (let r = 0; r < size - 1; r++) {
    const current = [fixed, ...rotatable]
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < size / 2; i++) {
      const home = current[i]
      const away = current[size - 1 - i]
      if (home !== BYE && away !== BYE) pairs.push([home, away])
    }
    rounds.push(pairs)
    rotatable.unshift(rotatable.pop()!)
  }

  return rounds
}

// Generate all ways to split pairs into 2 equal groups (slot A and slot B)
function combinations(n: number, k: number): number[][] {
  const result: number[][] = []
  const go = (start: number, current: number[]): void => {
    if (current.length === k) { result.push([...current]); return }
    for (let i = start; i <= n - (k - current.length); i++) go(i + 1, [...current, i])
  }
  go(0, [])
  return result
}

interface Split {
  slotA: Array<[string, string]>
  slotB: Array<[string, string]>
  slotATeams: Set<string>
  slotBTeams: Set<string>
}

function computeSplits(pairs: Array<[string, string]>): Split[] {
  const n = pairs.length
  const half = Math.floor(n / 2)
  return combinations(n, half).map(aIdx => {
    const aSet = new Set(aIdx)
    const bIdx = Array.from({ length: n }, (_, i) => i).filter(i => !aSet.has(i))
    const slotA = aIdx.map(i => pairs[i])
    const slotB = bIdx.map(i => pairs[i])
    return {
      slotA,
      slotB,
      slotATeams: new Set(slotA.flatMap(([h, a]) => [h, a])),
      slotBTeams: new Set(slotB.flatMap(([h, a]) => [h, a])),
    }
  })
}

// DP over all rounds to globally minimize back-to-back matches.
// Primary cost: 1000 per back-to-back (team in prevSlotB → currSlotA, 0 rest between matches).
// Secondary cost: 1 per A→B transition (2 slots rest — secondary criterion to balance rest evenly).
// Since secondary max per transition < 1000, primary always wins ties.
function dpOptimize(rounds: Array<Array<[string, string]>>): Split[] {
  if (rounds.length === 0) return []

  const allSplits = rounds.map(computeSplits)
  const numRounds = rounds.length
  const INF = 1e8

  type Entry = { cost: number; parent: number }

  let prev: Entry[] = allSplits[0].map(() => ({ cost: 0, parent: -1 }))
  const track: Entry[][] = [prev]

  for (let r = 1; r < numRounds; r++) {
    const curr: Entry[] = allSplits[r].map(() => ({ cost: INF, parent: -1 }))
    const currSplits = allSplits[r]
    const prevSplits = allSplits[r - 1]

    for (let s2 = 0; s2 < currSplits.length; s2++) {
      const { slotATeams, slotBTeams } = currSplits[s2]

      for (let s1 = 0; s1 < prevSplits.length; s1++) {
        const { slotBTeams: prevB, slotATeams: prevA } = prevSplits[s1]

        // Primary: team in slot B of round r-1 plays slot A of round r → 0 rest
        let backToBack = 0
        for (const t of prevB) if (slotATeams.has(t)) backToBack++

        // Secondary: A→B transition gives 2 slots rest, making rest uneven
        let longRest = 0
        for (const t of prevA) if (slotBTeams.has(t)) longRest++

        const cost = prev[s1].cost + backToBack * 1000 + longRest
        if (cost < curr[s2].cost) curr[s2] = { cost, parent: s1 }
      }
    }

    prev = curr
    track.push(curr)
  }

  // Find best final split
  let bestS = 0
  for (let s = 1; s < prev.length; s++) {
    if (prev[s].cost < prev[bestS].cost) bestS = s
  }

  // Backtrack to recover chosen splits
  const chosen: number[] = new Array(numRounds)
  chosen[numRounds - 1] = bestS
  for (let r = numRounds - 1; r > 0; r--) chosen[r - 1] = track[r][chosen[r]].parent

  return chosen.map((s, r) => allSplits[r][s])
}

function countBackToBack(assignments: Split[]): number {
  let n = 0
  for (let r = 1; r < assignments.length; r++) {
    for (const t of assignments[r - 1].slotBTeams) {
      if (assignments[r].slotATeams.has(t)) n++
    }
  }
  return n
}

export function generateLeagueSchedule(
  teamIds: string[],
  startTime: string,
  matchDurationMin: number,
  roundBreakMin: number,
): LeagueMatch[] {
  // Try every rotation of the team array as starting point for the circle method.
  // Different "fixed" teams produce different pair orderings → different optimal slot splits.
  // Pick the rotation that yields fewest back-to-back matches after DP.
  let bestAssignments: Split[] = []
  let bestCost = Infinity

  for (let rot = 0; rot < teamIds.length; rot++) {
    const rotated = [...teamIds.slice(rot), ...teamIds.slice(0, rot)]
    const rounds = circleRounds(rotated)
    const assignments = dpOptimize(rounds)
    const cost = countBackToBack(assignments)
    if (cost < bestCost) {
      bestCost = cost
      bestAssignments = assignments
    }
    if (bestCost === 0) break // Perfect schedule found
  }

  const slotDuration = matchDurationMin + roundBreakMin
  const result: LeagueMatch[] = []
  let slotIndex = 0

  for (const { slotA, slotB } of bestAssignments) {
    const timeA = startTime ? addMinutes(startTime, slotIndex * slotDuration) : ''
    const timeB = startTime ? addMinutes(startTime, (slotIndex + 1) * slotDuration) : ''
    for (const [home_id, away_id] of slotA) result.push({ home_id, away_id, scheduled_time: timeA })
    for (const [home_id, away_id] of slotB) result.push({ home_id, away_id, scheduled_time: timeB })
    slotIndex += 2
  }

  return result
}

export function leagueMatchCount(n: number): number {
  return (n * (n - 1)) / 2
}

export function leagueSlotCount(n: number): number {
  const rounds = n % 2 === 0 ? n - 1 : n
  return rounds * 2
}
