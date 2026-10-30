// TV režim → Hlasování diváků (modul fan_vote): QR na detail zápasu s hlasováním a živé výsledky.
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { VoteRow } from '../../lib/fanVote'
import { TeamLogo } from '../ui/TeamLogo'
import QRCode from '../ui/QRCode'
import { TV, tvLogo } from './tvTheme'

export interface VoteGame { id: string; home_id: string; away_id: string; h: number; a: number; played: boolean; label: string }

const vw = (n: number) => `calc(${n} * var(--tv-vw, 1vw))`

export function TvVote({ game, teams, players, rows, url }: { game: VoteGame; teams: Team[]; players: Player[]; rows: VoteRow[]; url: string }) {
  const home = teams.find(t => t.id === game.home_id)
  const away = teams.find(t => t.id === game.away_id)
  const total = rows.reduce((s, r) => s + r.votes, 0)
  const top = rows.slice(0, 5)
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: vw(3), alignItems: 'center', padding: `0 ${vw(4)}`, background: TV.col }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vw(1.4), textAlign: 'center' }}>
        <div style={{ fontSize: vw(1.3), fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: TV.accent }}>Hlasujte · hráč zápasu</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: vw(1.2), fontSize: vw(1.5), fontWeight: 700 }}>
          {home && <TeamLogo team={home} size={tvLogo(44)} />}
          <span style={{ maxWidth: vw(14), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{home?.name}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(3), color: game.played ? TV.text : TV.live }}>{game.h}:{game.a}</span>
          <span style={{ maxWidth: vw(14), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{away?.name}</span>
          {away && <TeamLogo team={away} size={tvLogo(44)} />}
        </div>
        <div style={{ fontSize: vw(1), color: TV.muted }}>{game.label}</div>
        <div style={{ background: '#fff', padding: vw(.8), borderRadius: 16, lineHeight: 0, marginTop: vw(.6) }}>
          <QRCode url={url} size={Math.round(tvLogo(260))} />
        </div>
        <div style={{ fontSize: vw(1.3), color: TV.text, fontWeight: 600 }}>Naskenujte kód a vyberte hráče</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: vw(.9) }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(2.2), textTransform: 'uppercase', color: TV.text }}>
          Průběžné výsledky <span style={{ color: TV.muted, fontSize: vw(1.3) }}>· {total} {total === 1 ? 'hlas' : total >= 2 && total <= 4 ? 'hlasy' : 'hlasů'}</span>
        </div>
        {top.length === 0 && <div style={{ fontSize: vw(1.5), color: TV.muted }}>Zatím žádné hlasy — buďte první!</div>}
        {top.map((r, i) => {
          const p = players.find(x => x.id === r.player_id)
          const team = teams.find(t => t.id === p?.team_id)
          const pct = total ? Math.round((r.votes / total) * 100) : 0
          return (
            <div key={r.player_id} style={{ display: 'grid', gridTemplateColumns: `${vw(3)} 1fr ${vw(5)}`, alignItems: 'center', gap: vw(1) }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(2), color: i === 0 ? TV.gold : TV.muted }}>{i + 1}.</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: vw(.6), fontSize: vw(1.5), fontWeight: i === 0 ? 800 : 600 }}>
                  {team && <TeamLogo team={team} size={tvLogo(26)} />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p?.name ?? '—'}</span>
                </div>
                <div style={{ height: vw(.6), marginTop: vw(.4), borderRadius: 6, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? 'var(--brand-on-dark)' : 'rgba(255,255,255,.35)' }} />
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(2), textAlign: 'right' }}>{pct} %</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Zápas pro hlasování na TV: rozehraný (nejpozdější výkop), jinak poslední dohraný dnes. */
export function pickVoteGame<T extends { played: boolean }>(open: T[]): T | null {
  const live = open.filter(g => !g.played)
  if (live.length) return live[live.length - 1]
  return open[open.length - 1] ?? null
}
