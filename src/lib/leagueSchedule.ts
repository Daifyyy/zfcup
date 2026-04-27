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

export function generateLeagueSchedule(
  teamIds: string[],
  startTime: string,
  matchDurationMin: number,
  roundBreakMin: number,
): LeagueMatch[] {
  const rounds = circleRounds(teamIds)
  const slotDuration = matchDurationMin + roundBreakMin
  const result: LeagueMatch[] = []

  let slotIndex = 0
  let recentTeams = new Set<string>()

  for (const roundPairs of rounds) {
    const slotA: Array<[string, string]> = []
    const chosen = new Set<number>()

    // Prefer matches where neither team played in the previous slot
    for (let i = 0; i < roundPairs.length && slotA.length < 2; i++) {
      const [h, a] = roundPairs[i]
      if (!recentTeams.has(h) && !recentTeams.has(a)) {
        slotA.push([h, a])
        chosen.add(i)
      }
    }

    // Fill slot A to 2 if not enough rested matches (back-to-back unavoidable)
    for (let i = 0; i < roundPairs.length && slotA.length < 2; i++) {
      if (!chosen.has(i)) { slotA.push(roundPairs[i]); chosen.add(i) }
    }

    const slotB = roundPairs.filter((_, i) => !chosen.has(i))

    const timeA = startTime ? addMinutes(startTime, slotIndex * slotDuration) : ''
    const timeB = startTime ? addMinutes(startTime, (slotIndex + 1) * slotDuration) : ''

    for (const [home_id, away_id] of slotA) result.push({ home_id, away_id, scheduled_time: timeA })
    for (const [home_id, away_id] of slotB) result.push({ home_id, away_id, scheduled_time: timeB })

    recentTeams = new Set(slotB.flatMap(([h, a]) => [h, a]))
    slotIndex += 2
  }

  return result
}

export function leagueMatchCount(n: number): number {
  return (n * (n - 1)) / 2
}

export function leagueSlotCount(n: number): number {
  // rounds = n if odd, n-1 if even; 2 slots per round
  const rounds = n % 2 === 0 ? n - 1 : n
  return rounds * 2
}
