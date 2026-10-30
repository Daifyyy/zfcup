import { lazy, Suspense, type ComponentProps } from 'react'
import { withReloadOnChunkError } from '../../lib/lazyComponent'

const ShareMatchLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareMatch }))))
const ShareTableLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareTable }))))
const ShareLeadersLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareLeaders }))))
const ShareTournamentLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareTournament }))))

type MatchProps = ComponentProps<typeof import('./ShareKit').ShareMatch>
type TableProps = ComponentProps<typeof import('./ShareKit').ShareTable>
type LeadersProps = ComponentProps<typeof import('./ShareKit').ShareLeaders>
type TournamentProps = ComponentProps<typeof import('./ShareKit').ShareTournament>

export function ShareMatchDialog(p: MatchProps) {
  return <Suspense fallback={null}><ShareMatchLazy {...p} /></Suspense>
}
export function ShareTableDialog(p: TableProps) {
  return <Suspense fallback={null}><ShareTableLazy {...p} /></Suspense>
}
export function ShareLeadersDialog(p: LeadersProps) {
  return <Suspense fallback={null}><ShareLeadersLazy {...p} /></Suspense>
}
export function ShareTournamentDialog(p: TournamentProps) {
  return <Suspense fallback={null}><ShareTournamentLazy {...p} /></Suspense>
}

// Vlna 1, bod 3
const ShareDayLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareDay }))))
const ShareChampionLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareChampion }))))
const ShareFinalStandingsLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareFinalStandings }))))
const ShareMvpLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareMvp }))))
const ShareBestTeamLazy = lazy(withReloadOnChunkError(() => import('./ShareKit').then(m => ({ default: m.ShareBestTeam }))))

export function ShareDayDialog(p: ComponentProps<typeof import('./ShareKit').ShareDay>) {
  return <Suspense fallback={null}><ShareDayLazy {...p} /></Suspense>
}
export function ShareChampionDialog(p: ComponentProps<typeof import('./ShareKit').ShareChampion>) {
  return <Suspense fallback={null}><ShareChampionLazy {...p} /></Suspense>
}
export function ShareFinalStandingsDialog(p: ComponentProps<typeof import('./ShareKit').ShareFinalStandings>) {
  return <Suspense fallback={null}><ShareFinalStandingsLazy {...p} /></Suspense>
}
export function ShareMvpDialog(p: ComponentProps<typeof import('./ShareKit').ShareMvp>) {
  return <Suspense fallback={null}><ShareMvpLazy {...p} /></Suspense>
}
export function ShareBestTeamDialog(p: ComponentProps<typeof import('./ShareKit').ShareBestTeam>) {
  return <Suspense fallback={null}><ShareBestTeamLazy {...p} /></Suspense>
}
