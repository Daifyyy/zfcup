// Diplomy (modul `diplomas`) — kdo dostane diplom. Čisté funkce nad daty turnaje.
// Umístění z konečného pořadí (finalStandings), nejlepší střelec (při shodě všichni),
// hráč turnaje a nejlepší brankář z týmu turnaje (bestTeam, vč. ručních úprav pořadatele).
import type { TournamentData } from './TournamentDataContext'
import type { Team } from '../hooks/useTeams'
import type { Player } from '../hooks/usePlayers'
import { finalStandingsOf } from './tournamentGraphics'
import { placeLabel } from './finalStandings'
import { bestTeamInput, computeBestTeam } from './bestTeam'
import { statFlags } from './details'
import { getSportDef } from './sports'

export type DiplomaKind = 'place' | 'scorer' | 'player' | 'keeper'

export interface Diploma {
  key: string
  kind: DiplomaKind
  /** „za 1. místo“, „Nejlepší střelec“… */
  title: string
  /** Jméno týmu / hráče */
  recipient: string
  /** Tým hráče (u hráčských diplomů) */
  team?: Team
  player?: Player
  /** „5 gólů“, „1,2 obdrženého gólu na zápas“… */
  detail?: string
  /** 1., 2., 3. místo → zlatá / stříbrná / bronzová */
  medal?: 1 | 2 | 3
}

export interface DiplomaOptions {
  /** Umístění: jen pódium, nebo všechna známá místa */
  places: 'podium' | 'all' | 'none'
  scorer: boolean
  player: boolean
  keeper: boolean
}

export const DEFAULT_DIPLOMA_OPTIONS: DiplomaOptions = { places: 'podium', scorer: true, player: true, keeper: true }

const goalsWord = (n: number) => (n === 1 ? 'gól' : n >= 2 && n <= 4 ? 'góly' : 'gólů')

export function diplomaList(d: TournamentData, o: DiplomaOptions): { decided: boolean; diplomas: Diploma[] } {
  const out: Diploma[] = []
  const standings = finalStandingsOf(d)

  if (o.places !== 'none') {
    const rows = o.places === 'podium' ? standings.rows.filter(r => r.from <= 3) : standings.rows
    for (const r of rows) {
      const shared = r.from !== r.to
      out.push({
        key: `place:${r.team.id}`, kind: 'place', title: `za ${placeLabel(r)} místo`, recipient: r.team.name, team: r.team,
        medal: !shared && r.from <= 3 ? (r.from as 1 | 2 | 3) : undefined,
      })
    }
  }

  if (o.scorer) {
    const goals = new Map<string, number>()
    for (const g of [...d.goals, ...d.bracketGoals]) goals.set(g.player_id, (goals.get(g.player_id) ?? 0) + g.count)
    const max = Math.max(0, ...goals.values())
    if (max > 0) {
      for (const [pid, n] of goals) {
        if (n !== max) continue
        const p = d.players.find(x => x.id === pid)
        if (!p) continue
        out.push({ key: `scorer:${pid}`, kind: 'scorer', title: 'Nejlepší střelec', recipient: p.name, player: p, team: d.teams.find(t => t.id === p.team_id), detail: `${n} ${goalsWord(n)}` })
      }
    }
  }

  if (o.player || o.keeper) {
    const team = computeBestTeam(bestTeamInput(d, statFlags(d)), getSportDef(d.tournament.sport), { overrides: d.tournament.best_team?.slots ?? null })
    if (o.player) {
      // hráč turnaje = nejvíc bodů v poli (ruční místo 1 má přednost — pořadatel tak určí hráče turnaje)
      const best = team.field[0]?.manual ? team.field[0] : [...team.field].sort((a, b) => b.score - a.score)[0]
      if (best) {
        const parts = [best.goals && `${best.goals} ${goalsWord(best.goals)}`, best.assists && `${best.assists} asist.`, best.mvp && `${best.mvp}× hráč zápasu`].filter(Boolean)
        out.push({ key: `player:${best.player.id}`, kind: 'player', title: 'Nejlepší hráč turnaje', recipient: best.player.name, player: best.player, team: best.team, detail: parts.join(' · ') || undefined })
      }
    }
    if (o.keeper && team.goalkeeper) {
      const k = team.goalkeeper
      const avg = k.keeper ? (k.keeper.against / k.keeper.games).toFixed(1).replace('.', ',') : null
      out.push({ key: `keeper:${k.player.id}`, kind: 'keeper', title: 'Nejlepší brankář', recipient: k.player.name, player: k.player, team: k.team, detail: avg ? `${avg} obdrženého gólu na zápas` : undefined })
    }
  }

  return { decided: standings.decided, diplomas: out }
}
