// Hotové sdílecí dialogy. Načítají se líně (viz lazy.tsx), aby html-to-image
// nebylo v hlavním balíku aplikace.
import type { Team } from '../../hooks/useTeams'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { StandingRow } from '../../lib/standings'
import ShareModal from './ShareModal'
import type { SideEvents } from '../../lib/details'
import { LeadersGraphic, MatchGraphic, TableGraphic, TournamentGraphic, type LeaderRow } from './templates'

interface Base {
  tournament: Tournament | null
  sponsors: Sponsor[]
  onClose: () => void
  showToast?: (msg: string) => void
  /** Odkaz pro „Kopírovat odkaz“ */
  url?: string
  /** Soukromý turnaj: odkaz s přístupovým kódem (volba v okně sdílení) */
  codeUrl?: string | null
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grafika'
}

export function ShareMatch(p: Base & {
  home?: Team; away?: Team; homeScore: number; awayScore: number; label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
  live?: boolean
  /** Zápas ještě nezačal → grafika „Hrajeme“ s časem místo skóre */
  upcoming?: boolean
  time?: string | null
  events?: { home: SideEvents; away: SideEvents }
}) {
  const title = p.upcoming
    ? `${p.home?.name ?? 'Určí se'} – ${p.away?.name ?? 'Určí se'}`
    : `${p.home?.name ?? '—'} ${p.homeScore}:${p.awayScore} ${p.away?.name ?? '—'}`
  return (
    <ShareModal
      title={title}
      fileName={slug(`vysledek-${p.home?.name}-${p.away?.name}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
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
      url={p.url}
      codeUrl={p.codeUrl}
      render={format => <TableGraphic format={format} {...p} />}
    />
  )
}

export function ShareLeaders(p: Base & { title: string; unit?: string; rows: LeaderRow[] }) {
  return (
    <ShareModal
      title={p.title}
      fileName={slug(p.title)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      render={format => <LeadersGraphic format={format} {...p} />}
    />
  )
}

export function ShareTournament(p: Base & { teamCount: number; matchCount: number; goalCount: number; url: string }) {
  return (
    <ShareModal
      title={p.tournament?.name ?? 'Turnaj'}
      fileName={slug(p.tournament?.name ?? 'turnaj')}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      render={(format, withCode) => <TournamentGraphic format={format} {...p} url={withCode && p.codeUrl ? p.codeUrl : p.url} />}
    />
  )
}
