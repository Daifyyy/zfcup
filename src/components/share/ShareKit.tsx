// Hotové sdílecí dialogy. Načítají se líně (viz lazy.tsx), aby html-to-image
// nebylo v hlavním balíku aplikace.
import type { Team } from '../../hooks/useTeams'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { StandingRow } from '../../lib/standings'
import ShareModal from './ShareModal'
import { MatchGraphic, ScorersGraphic, TableGraphic } from './templates'

interface Base {
  tournament: Tournament | null
  sponsors: Sponsor[]
  onClose: () => void
  showToast?: (msg: string) => void
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grafika'
}

export function ShareMatch(p: Base & {
  home?: Team; away?: Team; homeScore: number; awayScore: number; label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
}) {
  const title = `${p.home?.name ?? '—'} ${p.homeScore}:${p.awayScore} ${p.away?.name ?? '—'}`
  return (
    <ShareModal
      title={title}
      fileName={slug(`vysledek-${p.home?.name}-${p.away?.name}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      render={format => <MatchGraphic format={format} {...p} />}
    />
  )
}

export function ShareTable(p: Base & { groupName: string; rows: StandingRow[]; teams: Team[]; allowDraws: boolean }) {
  return (
    <ShareModal
      title={`Tabulka · ${p.groupName}`}
      fileName={slug(`tabulka-${p.groupName}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      render={format => <TableGraphic format={format} {...p} />}
    />
  )
}

export function ShareScorers(p: Base & { title: string; rows: { name: string; team?: Team; value: number }[] }) {
  return (
    <ShareModal
      title={p.title}
      fileName={slug(p.title)}
      onClose={p.onClose}
      showToast={p.showToast}
      render={format => <ScorersGraphic format={format} {...p} />}
    />
  )
}
