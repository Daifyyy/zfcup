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
