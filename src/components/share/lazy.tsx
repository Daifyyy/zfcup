import { lazy, Suspense, type ComponentProps } from 'react'

const ShareMatchLazy = lazy(() => import('./ShareKit').then(m => ({ default: m.ShareMatch })))
const ShareTableLazy = lazy(() => import('./ShareKit').then(m => ({ default: m.ShareTable })))
const ShareScorersLazy = lazy(() => import('./ShareKit').then(m => ({ default: m.ShareScorers })))

type MatchProps = ComponentProps<typeof import('./ShareKit').ShareMatch>
type TableProps = ComponentProps<typeof import('./ShareKit').ShareTable>
type ScorersProps = ComponentProps<typeof import('./ShareKit').ShareScorers>

export function ShareMatchDialog(p: MatchProps) {
  return <Suspense fallback={null}><ShareMatchLazy {...p} /></Suspense>
}
export function ShareTableDialog(p: TableProps) {
  return <Suspense fallback={null}><ShareTableLazy {...p} /></Suspense>
}
export function ShareScorersDialog(p: ScorersProps) {
  return <Suspense fallback={null}><ShareScorersLazy {...p} /></Suspense>
}
