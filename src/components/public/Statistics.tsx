import { useState, type ReactNode } from 'react'
import { Share2 } from 'lucide-react'
import type { Sponsor } from '../../hooks/useSponsors'
import { ShareLeadersDialog } from '../share/lazy'
import type { LeaderRow } from '../share/templates'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { Assist } from '../../hooks/useAssists'
import type { BracketAssist } from '../../hooks/useBracketAssists'
import type { Card as CardRecord } from '../../hooks/useCards'
import type { BracketCard } from '../../hooks/useBracketCards'
import type { Penalty } from '../../hooks/usePenalties'
import type { BracketPenalty } from '../../hooks/useBracketPenalties'
import type { Player } from '../../hooks/usePlayers'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'
import { Card, SectionHeader } from '../ui/Card'
import { CardChip } from '../ui/CardChip'
import { getSportDef } from '../../lib/sports'

interface Props {
  goals: Goal[]
  bracketGoals: BracketGoal[]
  assists: Assist[]
  bracketAssists: BracketAssist[]
  cards: CardRecord[]
  bracketCards: BracketCard[]
  penalties: Penalty[]
  bracketPenalties: BracketPenalty[]
  players: Player[]
  teams: Team[]
  tournament: Tournament | null
  sponsors?: Sponsor[]
  showToast?: (msg: string) => void
}

function PlayerCell({ player, team }: { player?: Player; team?: Team }) {
  if (!player) return null
  return (
    <div className="st-player">
      {player.avatar_url
        ? <img className="st-player__avatar" src={player.avatar_url} alt="" />
        : team && <TeamLogo team={team} size={28} />}
      <div style={{ minWidth: 0 }}>
        <div className="st-player__name">{player.name}</div>
        {team && <div className="st-player__team">{team.name}</div>}
      </div>
    </div>
  )
}

interface BoardRow { id: string; cells: ReactNode[]; primary: ReactNode }

function Leaderboard({ title, columns, rows, players, teams, footer, onShare, shareMenu }: {
  onShare?: () => void
  /** Více grafik k jedné tabulce (např. góly / kanadské body) */
  shareMenu?: { label: string; onClick: () => void }[]
  title: string
  columns: string[]
  rows: BoardRow[]
  players: Map<string, Player>
  teams: Map<string, Team>
  footer?: ReactNode
}) {
  return (
    <Card padded={false} title={title} actions={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
        {onShare && (
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon" title="Sdílet grafiku TOP 3" onClick={onShare}><Share2 size={14} /></button>
        )}
        {shareMenu && shareMenu.map(m => (
          <button key={m.label} type="button" className="ui-btn ui-btn--ghost ui-btn--sm" title={`Sdílet grafiku: ${m.label}`} onClick={m.onClick}><Share2 size={14} />{m.label === 'Kanadské body' ? 'Body' : 'Góly'}</button>
        ))}
        <span className="ui-badge">{rows.length}</span>
      </span>
    }>
      <table className="ui-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th className="is-left">Hráč</th>
            {columns.map(c => <th key={c} style={{ width: 56 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = players.get(r.id)
            const t = p ? teams.get(p.team_id) : undefined
            return (
              <tr key={r.id} className={i === 0 ? 'st-leader' : undefined}>
                <td className="is-muted" style={{ fontWeight: 700 }}>{i + 1}</td>
                <td className="is-left is-name"><PlayerCell player={p} team={t} /></td>
                {r.cells.map((c, j) => <td key={j} className="is-muted">{c}</td>)}
                <td><span className="st-val">{r.primary}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {footer && <div className="std-foot">{footer}</div>}
    </Card>
  )
}

export default function Statistics({ goals, bracketGoals, assists, bracketAssists, cards, bracketCards, penalties, bracketPenalties, players, teams, tournament, sponsors = [], showToast }: Props) {
  const [share, setShare] = useState<{ title: string; unit?: string; rows: LeaderRow[] } | null>(null)
  const showAssists = tournament?.assists_enabled ?? false
  const showCards = tournament?.cards_enabled ?? false
  const showPenalties = tournament?.penalty_minutes_enabled ?? false
  const sportDef = getSportDef(tournament?.sport)
  const playerById = new Map(players.map(p => [p.id, p]))
  const teamById = new Map(teams.map(t => [t.id, t]))

  const goalAgg: Record<string, number> = {}
  for (const g of [...goals, ...bracketGoals]) goalAgg[g.player_id] = (goalAgg[g.player_id] ?? 0) + g.count

  const assistAgg: Record<string, number> = {}
  if (showAssists) {
    for (const a of [...assists, ...bracketAssists]) assistAgg[a.player_id] = (assistAgg[a.player_id] ?? 0) + a.count
  }

  const scorers = players
    .map(p => ({ id: p.id, goals: goalAgg[p.id] ?? 0, assists: assistAgg[p.id] ?? 0 }))
    .filter(s => s.goals > 0 || (showAssists && s.assists > 0))
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals)

  const assisters = showAssists
    ? players.map(p => ({ id: p.id, assists: assistAgg[p.id] ?? 0 })).filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)
    : []

  const cardAgg: Record<string, { yellow: number; red: number; yellowRed: number; severity: number }> = {}
  if (showCards) {
    for (const c of [...cards, ...bracketCards]) {
      const a = (cardAgg[c.player_id] ??= { yellow: 0, red: 0, yellowRed: 0, severity: 0 })
      if (c.type === 'yellow') { a.yellow++; a.severity += 1 }
      if (c.type === 'red') { a.red++; a.severity += 2 }
      if (c.type === 'yellow_red') { a.yellowRed++; a.severity += 3 }
    }
  }
  const discipline = showCards
    ? Object.entries(cardAgg).map(([id, c]) => ({ id, ...c })).sort((a, b) => b.severity - a.severity)
    : []

  const penaltyAgg: Record<string, number> = {}
  if (showPenalties) {
    for (const p of [...penalties, ...bracketPenalties]) penaltyAgg[p.player_id] = (penaltyAgg[p.player_id] ?? 0) + p.minutes
  }
  const penaltyBoard = showPenalties
    ? Object.entries(penaltyAgg).map(([id, minutes]) => ({ id, minutes })).sort((a, b) => b.minutes - a.minutes)
    : []

  // Řádky sdílecí grafiky (TOP 3 na pódiu + další)
  const leaderRow = (id: string, value: string, cards?: LeaderRow['cards']): LeaderRow => {
    const p = playerById.get(id)
    return { name: p?.name ?? '', team: p ? teamById.get(p.team_id) : undefined, avatar: p?.avatar_url, value, cards }
  }
  const byGoals = [...scorers].filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals)
  const byPoints = [...scorers].filter(s => s.goals + s.assists > 0).sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals)
  const shareGoals = () => setShare({ title: `Nejlepší ${sportDef.terms.scorersLabel.toLowerCase()}`, unit: 'gólů', rows: byGoals.map(s => leaderRow(s.id, String(s.goals))) })
  const sharePoints = () => setShare({ title: 'Kanadské body', unit: 'bodů', rows: byPoints.map(s => leaderRow(s.id, String(s.goals + s.assists))) })
  const shareAssists = () => setShare({ title: 'Nejlepší nahrávači', unit: 'asistencí', rows: assisters.map(a => leaderRow(a.id, String(a.assists))) })
  const shareCards = () => setShare({ title: 'Disciplína', rows: discipline.map(r => leaderRow(r.id, '', { yellow: r.yellow, yellowRed: r.yellowRed, red: r.red })) })
  const sharePim = () => setShare({ title: 'Trestné minuty', unit: 'minut', rows: penaltyBoard.map(r => leaderRow(r.id, `${r.minutes}′`)) })

  const hasAnyData = scorers.length > 0 || assisters.length > 0 || discipline.length > 0 || penaltyBoard.length > 0
  if (!hasAnyData) return <Empty text="Statistiky se zobrazí po prvních odehraných zápasech." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader title="Statistiky" />
      <div className="st-grid">
        {scorers.length > 0 && (
          <Leaderboard
            title={sportDef.terms.scorersLabel}
            columns={showAssists ? ['G', 'A', 'B'] : ['G']}
            rows={scorers.map(s => showAssists
              ? { id: s.id, cells: [s.goals, s.assists], primary: s.goals + s.assists }
              : { id: s.id, cells: [], primary: s.goals })}
            players={playerById}
            teams={teamById}
            footer={showAssists ? <span>G = góly · A = asistence · B = kanadské body</span> : undefined}
            onShare={showAssists ? undefined : shareGoals}
            shareMenu={showAssists ? [{ label: 'Střelci (góly)', onClick: shareGoals }, { label: 'Kanadské body', onClick: sharePoints }] : undefined}
          />
        )}

        {assisters.length > 0 && (
          <Leaderboard
            title="Nahrávači"
            columns={['A']}
            rows={assisters.map(a => ({ id: a.id, cells: [], primary: a.assists }))}
            players={playerById}
            teams={teamById}
            onShare={shareAssists}
          />
        )}

        {discipline.length > 0 && (
          <Leaderboard
            title="Disciplína"
            columns={['Karty']}
            rows={discipline.map(r => ({
              id: r.id,
              cells: [],
              primary: (
                <span style={{ display: 'inline-flex', gap: '.4rem', justifyContent: 'center' }}>
                  {r.yellow > 0 && <CardChip kind="yellow" count={r.yellow} />}
                  {r.yellowRed > 0 && <CardChip kind="yellow_red" count={r.yellowRed} />}
                  {r.red > 0 && <CardChip kind="red" count={r.red} />}
                </span>
              ),
            }))}
            players={playerById}
            teams={teamById}
            onShare={shareCards}
            footer={<>
              <span><CardChip kind="yellow" />žlutá</span>
              <span><CardChip kind="yellow_red" />druhá žlutá → červená</span>
              <span><CardChip kind="red" />přímá červená</span>
            </>}
          />
        )}

        {penaltyBoard.length > 0 && (
          <Leaderboard
            title="Trestné minuty"
            columns={['TM']}
            rows={penaltyBoard.map(r => ({ id: r.id, cells: [], primary: `${r.minutes}′` }))}
            players={playerById}
            teams={teamById}
            onShare={sharePim}
          />
        )}
      </div>

      {share && (
        <ShareLeadersDialog
          tournament={tournament}
          sponsors={sponsors}
          title={share.title}
          unit={share.unit}
          rows={share.rows}
          onClose={() => setShare(null)}
          showToast={showToast}
        />
      )}
    </div>
  )
}
