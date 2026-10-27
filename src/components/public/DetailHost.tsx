// Otevírání detailu týmu / zápasu odkudkoli na veřejném webu.
// - URL: ?zapas={id} / ?tym={id} — odkaz otevře turnaj rovnou s detailem
// - Historie: otevření = nový záznam, tlačítko Zpět zavře (nebo vrátí předchozí detail),
//   křížek zavře všechny otevřené detaily najednou.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DetailContext, type DetailTarget } from '../../lib/TournamentDataContext'
import TeamDetailDrawer from './TeamDetailDrawer'
import MatchDetailDrawer from './MatchDetailDrawer'

const PARAM = { match: 'zapas', team: 'tym' } as const

function urlFor(target: DetailTarget | null): string {
  const url = new URL(window.location.href)
  url.searchParams.delete(PARAM.match)
  url.searchParams.delete(PARAM.team)
  if (target) url.searchParams.set(PARAM[target.kind], target.id)
  return url.pathname + url.search + url.hash
}

function targetFromUrl(): DetailTarget | null {
  const p = new URLSearchParams(window.location.search)
  const match = p.get(PARAM.match)
  if (match) return { kind: 'match', id: match }
  const team = p.get(PARAM.team)
  if (team) return { kind: 'team', id: team }
  return null
}

interface HistoryState { detail?: DetailTarget; detailDepth?: number; [k: string]: unknown }
const hs = (): HistoryState => (window.history.state ?? {}) as HistoryState

export default function DetailHost({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const closingAll = useRef(false)

  // Odkaz s ?zapas= / ?tym= — otevřít bez nového záznamu v historii (hloubka 0)
  useEffect(() => {
    const t = targetFromUrl()
    if (!t) return
    window.history.replaceState({ ...hs(), detail: t, detailDepth: 0 }, '', urlFor(t))
    setDetail(t)
  }, [])

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = (e.state ?? {}) as HistoryState
      if (closingAll.current) {
        closingAll.current = false
        // Dorazili jsme na záznam otevřený z odkazu → odstranit detail i z URL
        if (st.detail) window.history.replaceState({ ...st, detail: undefined, detailDepth: undefined }, '', urlFor(null))
        setDetail(null)
        return
      }
      setDetail(st.detail ?? null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((t: DetailTarget) => {
    const cur = hs()
    if (cur.detail && cur.detail.kind === t.kind && cur.detail.id === t.id) return
    window.history.pushState({ ...cur, detail: t, detailDepth: (cur.detailDepth ?? 0) + 1 }, '', urlFor(t))
    setDetail(t)
  }, [])

  const close = useCallback(() => {
    const depth = hs().detailDepth ?? 0
    if (depth > 0) {
      closingAll.current = true
      window.history.go(-depth)
    } else {
      window.history.replaceState({ ...hs(), detail: undefined, detailDepth: undefined }, '', urlFor(null))
      setDetail(null)
    }
  }, [])

  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail, close])

  const api = useMemo(() => ({
    openTeam: (id: string) => open({ kind: 'team', id }),
    openMatch: (id: string) => open({ kind: 'match', id }),
  }), [open])

  return (
    <DetailContext.Provider value={api}>
      {children}
      {detail?.kind === 'team' && <TeamDetailDrawer key={detail.id} teamId={detail.id} onClose={close} />}
      {detail?.kind === 'match' && <MatchDetailDrawer key={detail.id} matchId={detail.id} onClose={close} />}
    </DetailContext.Provider>
  )
}
