import { useEffect, useState, useMemo } from 'react'
import { calcGroupStandings } from '../../lib/standings'
import { addMinutes } from '../../lib/constants'
import { getSportDef } from '../../lib/sports'
import QRCode from '../ui/QRCode'
import { TeamLogo } from '../ui/TeamLogo'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Sponsor } from '../../hooks/useSponsors'
import { X } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { TvPartnerBar } from '../ui/TvPartnerBar'
import { getMatchState } from '../../lib/matchState'
import { currentSeasonRound } from '../../lib/fixtures'
import { formatDateWeekday } from '../../lib/dates'
import { TV, TV_SIZE, tvLogo } from '../tv/tvTheme'
import { TvGroupTable } from '../tv/TvGroupTable'
import { FitBox } from '../tv/FitBox'
import { standingsZones } from '../../lib/zones'
import { useBackClose } from '../../lib/useBackClose'
import { tournamentQrUrl } from '../../lib/share'

interface Props {
  tournament: Tournament | null
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  goals: Goal[]
  bracketGoals: BracketGoal[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  onExit: () => void
  sponsors?: Sponsor[]
  presentedBy?: Sponsor | null
  /** Zápis do historie prohlížeče (Zpět zavře tabuli); ukázka na úvodní stránce = false */
  historyStep?: boolean
}

// ── palette ──────────────────────────────────────────────────────────────────
// Tmavá broadcast paleta (TV / projektor). Akcent je světlejší varianta značky,
// aby byl čitelný na tmavém pozadí.
const C = TV

// ── fluid sizes ───────────────────────────────────────────────────────────────
const S = TV_SIZE

function useClock() {
  const fmt = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 10_000)
    return () => clearInterval(id)
  }, [])
  return t
}

// ── Standings + Scorers column ────────────────────────────────────────────────
function StandingsCol({ groups, matches, teams, players, goals, bracketGoals, tournament }: {
  groups: Group[]; matches: Match[]; teams: Team[]; players: Player[]; goals: Goal[]; bracketGoals: BracketGoal[]; tournament: Tournament | null
}) {
  const isLeague = tournament?.format === 'league'
  const sportDef = getSportDef(tournament?.sport)

  // Top 5 scorers — aggregate group goals + bracket_goals (memoized)
  const scorers = useMemo(() => {
    const agg: Record<string, number> = {}
    for (const g of goals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
    for (const g of bracketGoals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
    return players
      .filter(p => (agg[p.id] ?? 0) > 0)
      .map(p => ({ name: p.name, team: teams.find(t => t.id === p.team_id), total: agg[p.id] }))
  }, [players, goals, bracketGoals, teams])
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const zones = standingsZones(tournament)
  const teamById = new Map(teams.map(t => [t.id, t]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Tabulky skupin — když se nevejdou, FitBox plynule zmenší písmo (nic se neusekne) */}
      <FitBox watch={`${groups.length}|${matches.length}`} style={{ flex: 1, minHeight: 0, padding: '.6rem .8rem .2rem', display: 'flex', flexDirection: 'column', gap: 'calc(.6rem * var(--tv-fit, 1))' }}>
        {groups.length === 0 ? (
          <div style={{ color: C.muted, fontSize: S.body }}>Žádné skupiny</div>
        ) : (
          groups.map((group, gi) => (
            <TvGroupTable key={group.id} group={group} rows={calcGroupStandings(group, matches, sportDef)} teamById={teamById} sportDef={sportDef} zones={zones} showNotes={isLeague} showLegend={gi === 0} />
          ))
        )}
      </FitBox>

      {/* Top scorers — always visible at bottom, compact single-line */}
      {scorers.length > 0 && (
        <div style={{ flexShrink: 0, padding: '.3rem .8rem .4rem', borderTop: `2px solid ${C.border}` }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: S.body,
            letterSpacing: '.1em',
            color: C.gold,
            marginBottom: '.15rem',
          }}>
            {sportDef.terms.scorersLabel}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.08rem' }}>
            {scorers.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.08rem .05rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: S.label, color: i === 0 ? C.gold : C.muted, width: 14, textAlign: 'center', flexShrink: 0 }}>
                  {i + 1}
                </span>
                {s.team && <TeamLogo team={s.team} size={tvLogo(26)} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: S.small, fontWeight: i === 0 ? 700 : 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                  {s.team && <span style={{ color: C.muted, fontWeight: 400 }}> · {s.team.name}</span>}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: S.body, color: i === 0 ? C.gold : C.accent, flexShrink: 0 }}>
                  {s.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single-group matches sub-column ───────────────────────────────────────────
function GroupMatchesSubCol({ groupName, matches, teams, tournament }: { groupName: string; matches: Match[]; teams: Team[]; tournament: Tournament | null }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#64748b', logo_url: null }

  return (
    <div style={{ padding: '.4rem .5rem', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden', gap: '.18rem' }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: S.section,
        letterSpacing: '.12em',
        color: C.accent,
        paddingBottom: '.15rem',
        borderBottom: `2px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {groupName}
      </div>
      {matches.map(m => {
        const hw = m.played && m.home_score > m.away_score
        const aw = m.played && m.away_score > m.home_score
        const live = getMatchState(m, tournament) === 'live'
        return (
          <div key={m.id} className={live ? 'sb-live' : undefined} style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto 1fr',
            alignItems: 'center',
            gap: '.2rem',
            padding: '.1rem .3rem',
            borderRadius: 4,
            background: m.played ? C.col : C.upcoming,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}>
            {/* Čas */}
            <div style={{ fontSize: S.label, color: m.played ? C.muted : C.accent, fontWeight: m.played ? 400 : 700, flexShrink: 0, minWidth: '3em', textAlign: 'center' }}>
              {live ? <span className="sb-live-tag"><span className="ui-live-dot" />Živě</span> : (m.scheduled_time || '')}
            </div>
            {/* Home */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tn(m.home_id)}
              </span>
              <TeamLogo team={tt(m.home_id)} size={tvLogo(28)} />
            </div>
            {/* Skóre */}
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.2rem, calc(3.5 * var(--tv-vw, 1vw)), 5rem)' }}>
              {m.played ? (
                <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: C.text, letterSpacing: '.06em', lineHeight: 1 }}>
                  {m.home_score}:{m.away_score}
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: C.muted, letterSpacing: '.06em' }}>VS</span>
              )}
            </div>
            {/* Away */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem', minWidth: 0, overflow: 'hidden' }}>
              <TeamLogo team={tt(m.away_id)} size={tvLogo(28)} />
              <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tn(m.away_id)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Playoff matches sub-column (po odehrání skupin) ────────────────────────────
function PlayoffMatchesSubCol({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) ?? null : null
  const tn = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? 'Určí se' : 'Určí se'

  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  if (!sorted.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Play-off není nastaven
    </div>
  )

  return (
    <div style={{ padding: '.5rem .8rem', display: 'flex', flexDirection: 'column', gap: '.4rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        const isFinal   = /finále/i.test(round.name) && !/[3579]/i.test(round.name)
        const isThird   = /o\s*3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)
        const isFifth   = /o\s*5/i.test(round.name) || /5[\.-]/i.test(round.name)
        const isSeventh = /o\s*7/i.test(round.name) || /7[\.-]/i.test(round.name)
        const isNinth   = /o\s*9/i.test(round.name) || /9[\.-]/i.test(round.name)
        const accentColor = isFinal ? C.gold : isThird ? C.bronze : isFifth ? C.fifth : isSeventh ? C.seventh : isNinth ? C.ninth : C.accent
        return (
          <div key={round.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: S.label,
              letterSpacing: '.16em',
              color: accentColor,
              textTransform: 'uppercase',
              marginBottom: '.2rem',
              paddingBottom: '.14rem',
              borderBottom: `1px solid ${accentColor}`,
            }}>
              {round.name}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '.15rem', overflow: 'hidden' }}>
              {roundSlots.map(s => {
                const hT = gt(s.home_id), aT = gt(s.away_id)
                const hw = s.played && s.home_score > s.away_score
                const aw = s.played && s.away_score > s.home_score
                return (
                  <div key={s.id} style={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 5,
                    background: s.played ? C.col : C.upcoming,
                    border: `1px solid ${isFinal ? 'rgba(245,196,81,.45)' : isThird ? 'rgba(208,138,74,.35)' : C.border}`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}>
                  {s.scheduled_time && !s.played && (
                    <div style={{ fontSize: S.label, color: C.muted, padding: '.1rem .5rem 0', fontWeight: 600 }}>{s.scheduled_time}</div>
                  )}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '.3rem',
                    padding: '.26rem .5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.25rem', minWidth: 0 }}>
                      <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? accentColor : hT ? C.muted : C.muted, fontStyle: hT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tn(s.home_id)}
                      </span>
                      {hT && <TeamLogo team={hT} size={tvLogo(28)} />}
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.4rem, calc(4 * var(--tv-vw, 1vw)), 5.5rem)' }}>
                      {s.played ? (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: accentColor, letterSpacing: '.06em', lineHeight: 1 }}>
                          {s.home_score}:{s.away_score}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: C.muted }}>VS</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem', minWidth: 0 }}>
                      {aT && <TeamLogo team={aT} size={tvLogo(28)} />}
                      <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? accentColor : aT ? C.muted : C.muted, fontStyle: aT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tn(s.away_id)}
                      </span>
                    </div>
                  </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── League match cell (one of 2 simultaneous matches) ─────────────────────────
function MatchCell({ match, teams }: { match: Match; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id)
  const hw = match.played && match.home_score > match.away_score
  const aw = match.played && match.away_score > match.home_score
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '.18rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', minWidth: 0 }}>
        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tn(match.home_id)}
        </span>
        {tt(match.home_id) && <TeamLogo team={tt(match.home_id)!} size={tvLogo(28)} />}
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '3em' }}>
        {match.played ? (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: C.text, letterSpacing: '.06em' }}>
            {match.home_score}:{match.away_score}
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: S.small, color: C.muted }}>VS</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem', minWidth: 0 }}>
        {tt(match.away_id) && <TeamLogo team={tt(match.away_id)!} size={tvLogo(28)} />}
        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tn(match.away_id)}
        </span>
      </div>
    </div>
  )
}

// ── League matches — all slots grouped by time, N side by side ────────────────
const MAX_SLOTS_PER_PAGE = 12

function LeagueMatchesCol({ matches, teams, numPitches = 2, tournament }: { matches: Match[]; teams: Team[]; numPitches?: number; tournament: Tournament | null }) {
  // Group by scheduled_time
  const slotsMap = new Map<string, Match[]>()
  for (const m of [...matches].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
    const key = m.scheduled_time ?? ''
    if (!slotsMap.has(key)) slotsMap.set(key, [])
    slotsMap.get(key)!.push(m)
  }
  const sortedSlots = [...slotsMap.entries()]
  const totalPages = Math.ceil(sortedSlots.length / MAX_SLOTS_PER_PAGE)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (totalPages <= 1) return
    const id = setInterval(() => setPage(p => (p + 1) % totalPages), 5000)
    return () => clearInterval(id)
  }, [totalPages])

  const visibleSlots = totalPages > 1
    ? sortedSlots.slice(page * MAX_SLOTS_PER_PAGE, (page + 1) * MAX_SLOTS_PER_PAGE)
    : sortedSlots

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '.3rem .55rem', gap: '.18rem', boxSizing: 'border-box' }}>
      {/* Záhlaví hřišť — dynamicky N sloupců */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '0 .4rem', flexShrink: 0 }}>
        <div style={{ minWidth: '3.1em', flexShrink: 0 }} />
        {'ABCD'.slice(0, numPitches).split('').map((letter, i) => (
          <div key={letter} style={{ display: 'contents' }}>
            {i > 0 && <div style={{ width: 1, flexShrink: 0 }} />}
            <div style={{ flex: 1, textAlign: 'center', fontSize: S.label, color: C.accent, fontWeight: 700, letterSpacing: '.08em' }}>
              {getSportDef(tournament?.sport).terms.pitchLabel.toUpperCase()} {letter}
            </div>
          </div>
        ))}
        {totalPages > 1 && (
          <div style={{ flexShrink: 0, fontSize: S.label, color: C.muted, fontWeight: 600, marginLeft: '.5rem' }}>
            {page + 1}/{totalPages}
          </div>
        )}
      </div>
      {visibleSlots.map(([time, slotMatches], si) => {
        const allPlayed = slotMatches.every(m => m.played)
        const live = slotMatches.some(m => getMatchState(m, tournament) === 'live')
        return (
          <div key={time || si} className={live ? 'sb-live' : undefined} style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '.5rem',
            padding: '.15rem .4rem',
            borderRadius: 5,
            background: allPlayed ? C.col : C.upcoming,
            border: `1px solid ${C.border}`,
            minHeight: 0,
            overflow: 'hidden',
          }}>
            {/* Čas */}
            <div style={{ fontSize: S.label, color: allPlayed ? C.muted : C.accent, fontWeight: allPlayed ? 400 : 700, flexShrink: 0, minWidth: '3.1em', textAlign: 'center' }}>
              {live ? <span className="sb-live-tag"><span className="ui-live-dot" />Živě</span> : (time || '—')}
            </div>
            {/* N hřišť */}
            {'ABCD'.slice(0, numPitches).split('').map((letter, i) => (
              <div key={letter} style={{ display: 'contents' }}>
                {i > 0 && <div style={{ width: 1, alignSelf: 'stretch', background: C.border, flexShrink: 0 }} />}
                {slotMatches[i]
                  ? <MatchCell match={slotMatches[i]} teams={teams} />
                  : <div style={{ flex: 1 }} />}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Matches column — 2 skupiny nebo playoff ────────────────────────────────────
function MatchesCol({ matches, teams, groups, bracketRounds, bracketSlots, tournament }: {
  matches: Match[]
  teams: Team[]
  groups: Group[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  tournament: Tournament | null
}) {
  const isLeague = tournament?.format === 'league'
  const groupMatches = matches.filter(m => m.group_id !== null)
  const allGroupMatchesPlayed = groups.length > 0 && groupMatches.length > 0 && groupMatches.every(m => m.played)
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  if (allGroupMatchesPlayed) {
    return <PlayoffMatchesSubCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
  }

  if (!groupMatches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Žádné zápasy
    </div>
  )

  // Sezóna: jen aktuální kolo (zápasy jsou v různé dny)
  const seasonRound = currentSeasonRound(groupMatches)
  if (seasonRound) {
    return <GroupMatchesSubCol groupName={`${seasonRound.round}${seasonRound.date ? ` · ${formatDateWeekday(seasonRound.date)}` : ''}`} matches={seasonRound.matches} teams={teams} tournament={tournament} />
  }

  if (isLeague) {
    return <LeagueMatchesCol matches={groupMatches} teams={teams} numPitches={tournament?.num_pitches ?? 2} tournament={tournament} />
  }

  // Distribute groups into columns: 1–3 groups → N columns; 4+ → stack 2 groups per column
  const numCols = sortedGroups.length <= 3 ? sortedGroups.length : Math.ceil(sortedGroups.length / 2)
  const columns: Group[][] = Array.from({ length: numCols }, () => [])
  sortedGroups.forEach((g, i) => columns[i % numCols].push(g))

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${numCols}, 1fr)`,
      height: '100%',
      overflow: 'hidden',
    }}>
      {columns.map((colGroups, colIdx) => (
        <div key={colIdx} style={{ borderLeft: colIdx > 0 ? `1px solid ${C.border}` : 'none', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {colGroups.map((group, gi) => {
            const gMatches = groupMatches.filter(m => m.group_id === group.id)
            return (
              <div key={group.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', borderTop: gi > 0 ? `2px solid ${C.border}` : 'none' }}>
                <GroupMatchesSubCol groupName={group.name} matches={gMatches} teams={teams} tournament={tournament} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Flat bracket column ───────────────────────────────────────────────────────
function FlatBracketCol({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => (id ? teams.find(t => t.id === id) : null)

  if (!rounds.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.body }}>
      Pavouk není nastaven
    </div>
  )

  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  return (
    <div style={{ padding: '.7rem 1rem', display: 'flex', flexDirection: 'column', gap: '.9rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots]
          .filter(s => s.round_id === round.id)
          .sort((a, b) => a.position - b.position)

        const isFinal   = /finále/i.test(round.name) && !/[3579]/i.test(round.name)
        const isThird   = /o\s*3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)
        const isFifth   = /o\s*5/i.test(round.name) || /5[\.-]/i.test(round.name)
        const isSeventh = /o\s*7/i.test(round.name) || /7[\.-]/i.test(round.name)
        const isNinth   = /o\s*9/i.test(round.name) || /9[\.-]/i.test(round.name)

        const accentColor = isFinal ? C.gold : isThird ? C.bronze : isFifth ? C.fifth : isSeventh ? C.seventh : isNinth ? C.ninth : C.accent
        const borderColor = isFinal ? 'rgba(245,196,81,.45)' : isThird ? 'rgba(208,138,74,.35)' : C.border

        return (
          <div key={round.id}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: S.section,
              letterSpacing: '.13em',
              color: accentColor,
              marginBottom: '.35rem',
              paddingBottom: '.2rem',
              borderBottom: `2px solid ${accentColor}`,
              display: 'flex', alignItems: 'center', gap: '.4rem',
            }}>
              {round.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
              {roundSlots.map(slot => {
                const hT = gt(slot.home_id), aT = gt(slot.away_id)
                const hw = slot.played && slot.home_score > slot.away_score
                const aw = slot.played && slot.away_score > slot.home_score

                return (
                  <div key={slot.id} style={{
                    background: C.col,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: 'none',
                  }}>
                    {/* Home row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '.35rem .7rem',
                      borderBottom: `1px solid ${borderColor}`,
                      background: hw ? (isFinal ? 'rgba(245,196,81,.12)' : isThird ? 'rgba(208,138,74,.1)' : TV.accentSoft) : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {hT && <TeamLogo team={hT} size={tvLogo(30)} />}
                        <span style={{
                          fontSize: S.body,
                          fontWeight: hw ? 700 : 400,
                          color: hT ? (hw ? accentColor : C.text) : C.muted,
                          fontStyle: hT ? 'normal' : 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {hT?.name ?? 'Určí se'}
                        </span>
                      </div>
                      {slot.played && (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: hw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>
                          {slot.home_score}
                        </span>
                      )}
                    </div>
                    {/* Away row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '.35rem .7rem',
                      background: aw ? (isFinal ? 'rgba(245,196,81,.12)' : isThird ? 'rgba(208,138,74,.1)' : TV.accentSoft) : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {aT && <TeamLogo team={aT} size={tvLogo(30)} />}
                        <span style={{
                          fontSize: S.body,
                          fontWeight: aw ? 700 : 400,
                          color: aT ? (aw ? accentColor : C.text) : C.muted,
                          fontStyle: aT ? 'normal' : 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {aT?.name ?? 'Určí se'}
                        </span>
                      </div>
                      {slot.played && (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: aw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>
                          {slot.away_score}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Scoreboard ───────────────────────────────────────────────────────────
export default function Scoreboard({ tournament, teams, players, groups, matches, goals, bracketGoals, bracketRounds, bracketSlots, onExit, sponsors = [], presentedBy, historyStep = true }: Props) {
  const clock = useClock()
  // Zpět (gesto / tlačítko) zavře tabuli, ne turnaj; v ukázce na úvodní stránce vypnuto
  useBackClose(historyStep, onExit, 'scoreboard')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit])

  const isLeague = tournament?.format === 'league'
  const meta = [tournament?.date, tournament?.venue].filter(Boolean).join(' · ')
  const tournamentUrl = tournament?.id ? window.location.origin + '/' + tournament.id : undefined
  const cols = [
    isLeague ? 'Liga — tabulka a střelci' : 'Skupiny — tabulky a střelci',
    'Zápasy',
  ]

  return (
    <div className="sb" style={{ background: C.bg, color: C.text }}>
      {/* ── záhlaví ── */}
      <header className="sb-head">
        {tournament?.logo_url && (
          <div className="sb-head__crest"><img src={tournament.logo_url} alt="" /></div>
        )}
        <div className="sb-head__title">
          <div className="sb-head__name" style={{ fontSize: S.title }}>{tournament?.name || BRAND.name}</div>
          {meta && <div className="sb-head__meta" style={{ fontSize: S.label }}>{meta}</div>}
        </div>

        {presentedBy?.logo_url && (
          <div className="sb-head__presented">
            <span style={{ fontSize: S.label }}>Presented by</span>
            <img src={presentedBy.logo_url} alt={presentedBy.name} />
          </div>
        )}

        <div className="sb-head__clock" style={{ fontSize: S.title }}>{clock}</div>

        <div className="sb-head__qr">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: S.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Sledujte živě</div>
            <div style={{ fontSize: S.label, color: C.muted }}>naskenujte QR kód</div>
          </div>
          <div className="sb-head__qrbox"><QRCode size={52} url={tournamentQrUrl(tournament)} /></div>
        </div>

        <button type="button" onClick={onExit} className="sb-head__close" style={{ fontSize: S.label }} aria-label="Zavřít tabuli">
          <X size={16} />Zavřít
        </button>
      </header>

      {/* ── podzáhlaví sloupců ── */}
      <div className="sb-cols">
        {cols.map((label, i) => (
          <div key={i} className="sb-cols__item" style={{ fontSize: S.label }}>{label}</div>
        ))}
      </div>

      {/* ── obsah ── */}
      <div className="sb-body">
        <div style={{ background: C.col, borderRight: '1px solid ' + C.border, overflow: 'hidden' }}>
          <StandingsCol groups={groups} matches={matches} teams={teams} players={players} goals={goals} bracketGoals={bracketGoals} tournament={tournament} />
        </div>
        <div style={{ background: C.panel, overflow: 'hidden' }}>
          <MatchesCol matches={matches} teams={teams} groups={groups} bracketRounds={bracketRounds} bracketSlots={bracketSlots} tournament={tournament} />
        </div>
      </div>

      <footer className="sb-foot">
        <TvPartnerBar sponsors={sponsors} />
        <div className="sb-foot__brand" style={{ fontSize: S.label }}>{BRAND.name}</div>
      </footer>
    </div>
  )
}
