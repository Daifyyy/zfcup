// Data otevřeného turnaje pro detaily týmu a zápasu (drawery).
// Všechno načítá App.tsx už dnes — kontext jen zpřístupní data bez dalších props a dotazů.
import { createContext, useContext } from 'react'
import type { Tournament } from '../hooks/useTournament'
import type { Team } from '../hooks/useTeams'
import type { Player } from '../hooks/usePlayers'
import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'
import type { Goal } from '../hooks/useGoals'
import type { Assist } from '../hooks/useAssists'
import type { Card } from '../hooks/useCards'
import type { Penalty } from '../hooks/usePenalties'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { BracketGoal } from '../hooks/useBracketGoals'
import type { BracketAssist } from '../hooks/useBracketAssists'
import type { BracketCard } from '../hooks/useBracketCards'
import type { BracketPenalty } from '../hooks/useBracketPenalties'
import type { Referee } from '../hooks/useReferees'

export interface TournamentData {
  tournament: Tournament
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  goals: Goal[]
  assists: Assist[]
  cards: Card[]
  penalties: Penalty[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  bracketGoals: BracketGoal[]
  bracketAssists: BracketAssist[]
  bracketCards: BracketCard[]
  bracketPenalties: BracketPenalty[]
  referees: Referee[]
  /** Play-off se ještě načítá (App čeká jen na týmy/skupiny/zápasy) */
  bracketLoading: boolean
}

export const TournamentDataContext = createContext<TournamentData | null>(null)

export function useTournamentData(): TournamentData {
  const ctx = useContext(TournamentDataContext)
  if (!ctx) throw new Error('useTournamentData: chybí TournamentDataContext')
  return ctx
}

/** Co je otevřené v detailu: tým, nebo zápas (id zápasu i play-off slotu — UUID jsou unikátní). */
export type DetailTarget = { kind: 'team'; id: string } | { kind: 'match'; id: string }

export interface DetailApi {
  openTeam: (teamId: string) => void
  openMatch: (matchOrSlotId: string) => void
}

const noop: DetailApi = { openTeam: () => {}, openMatch: () => {} }

export const DetailContext = createContext<DetailApi>(noop)

/** Otevření detailu odkudkoli. Mimo provider (TV, kiosk, admin) nic nedělá. */
export function useDetail(): DetailApi {
  return useContext(DetailContext)
}
