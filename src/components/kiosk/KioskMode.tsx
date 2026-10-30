import { useState, useEffect, useRef, useCallback } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { calcGroupStandings } from '../../lib/standings'
import { TeamLogo } from '../ui/TeamLogo'
import QRCode from '../ui/QRCode'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { Sponsor } from '../../hooks/useSponsors'
import { TvPartnerBar } from '../ui/TvPartnerBar'
import { currentSeasonRound } from '../../lib/fixtures'
import { formatDateWeekday } from '../../lib/dates'
import { getSportDef } from '../../lib/sports'
import { TV, TV_SIZE, tvLogo } from '../tv/tvTheme'
import { TvGroupTable } from '../tv/TvGroupTable'
import { FitBox } from '../tv/FitBox'
import { standingsZones } from '../../lib/zones'
import { tournamentQrUrl } from '../../lib/share'
import { useModule } from '../../lib/ModulesContext'
import { useTvEvents } from '../../hooks/useTvEvents'
import { GoalOverlay, GOAL_SHOW_MS, type GoalShow } from '../tv/GoalOverlay'
import { TvSpot, buildSpots } from '../tv/TvSpot'
import { getTitlePartner } from '../../lib/partners'
import { announcementText, cancelSpeech, hasCzechVoice, loadAnnouncerSettings, saveAnnouncerSettings, speak, speechAvailable, type AnnouncerSettings } from '../../lib/announcer'
import type { TvEvent } from '../../lib/tvEvents'
import { TvVote, pickVoteGame, type VoteGame } from '../tv/TvVote'
import { useFanVotes } from '../../hooks/useFanVotes'
import { voteOpen } from '../../lib/fanVote'
import { buildFixtures } from '../../lib/fixtures'
import { fixtureId } from '../../lib/details'
import { matchUrl, withAccessCode } from '../../lib/share'
import { useTvMinutes } from '../../hooks/useTvMinutes'
import { trackTvSpot } from '../../lib/partnerReach'

/* ── Palette ───────────────────────────────────────────── */
// Tmavá broadcast paleta — shodná s TV tabulí (Scoreboard).
const C = TV

/* ── Fluid sizes (Scoreboard-quality scale) ─────────────── */
const S = TV_SIZE

/* ── Views config ──────────────────────────────────────── */
type KioskView = 'matches' | 'table' | 'bracket' | 'spot' | 'vote'
function getViews(_sportIcon?: string): { key: KioskView; label: string }[] {
  return [
    { key: 'matches', label: 'Zápasy' },
    { key: 'table',   label: 'Tabulka' },
    { key: 'bracket', label: 'Pavouk' },
  ]
}
const ROTATION_MS = 15_000
/** Spot partnera / oznámení (modul tv_spots) */
const SPOT_MS = 8_000
/** Jak dlouho chytrá režie drží obrazovku po události */
const DIRECTOR_HOLD_MS = 20_000

/* ── Clock hook ────────────────────────────────────────── */
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

/* ── Sub-components for KioskMatches ───────────────────── */

function GroupMatchesSubCol({ groupName, matches, teams }: { groupName: string; matches: Match[]; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#64748b', logo_url: null }
  return (
    <div style={{ padding: '.4rem .5rem', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden', gap: '.18rem' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: S.section, letterSpacing: '.12em', color: C.accent, paddingBottom: '.15rem', borderBottom: `2px solid ${C.border}`, flexShrink: 0 }}>
        {groupName}
      </div>
      {matches.map(m => {
        const hw = m.played && m.home_score > m.away_score
        const aw = m.played && m.away_score > m.home_score
        return (
          <div key={m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', alignItems: 'center', gap: '.2rem', padding: '.1rem .3rem', borderRadius: 4, background: m.played ? C.col : C.upcoming, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ fontSize: S.label, color: m.played ? C.muted : C.accent, fontWeight: m.played ? 400 : 700, flexShrink: 0, minWidth: '3em', textAlign: 'center' }}>
              {m.scheduled_time || ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(m.home_id)}</span>
              <TeamLogo team={tt(m.home_id)} size={tvLogo(28)} />
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.2rem, calc(3.5 * var(--tv-vw, 1vw)), 5rem)' }}>
              {(m.played || m.home_score + m.away_score > 0)
                ? <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: m.played ? C.text : C.live, letterSpacing: '.06em', lineHeight: 1 }}>{m.home_score}:{m.away_score}</span>
                : <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: C.muted, letterSpacing: '.06em' }}>VS</span>
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem', minWidth: 0, overflow: 'hidden' }}>
              <TeamLogo team={tt(m.away_id)} size={tvLogo(28)} />
              <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(m.away_id)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatchCell({ match, teams }: { match: Match; teams: Team[] }) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id)
  const hw = match.played && match.home_score > match.away_score
  const aw = match.played && match.away_score > match.home_score
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '.18rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', minWidth: 0 }}>
        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(match.home_id)}</span>
        {tt(match.home_id) && <TeamLogo team={tt(match.home_id)!} size={tvLogo(28)} />}
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '3em' }}>
        {(match.played || match.home_score + match.away_score > 0)
          ? <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: match.played ? C.text : C.live, letterSpacing: '.06em' }}>{match.home_score}:{match.away_score}</span>
          : <span style={{ fontFamily: 'var(--font-display)', fontSize: S.small, color: C.muted }}>VS</span>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem', minWidth: 0 }}>
        {tt(match.away_id) && <TeamLogo team={tt(match.away_id)!} size={tvLogo(28)} />}
        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(match.away_id)}</span>
      </div>
    </div>
  )
}

function LeagueMatchesCol({ matches, teams, numPitches = 2, pitchLabel }: { matches: Match[]; teams: Team[]; numPitches?: number; pitchLabel: string }) {
  const slotsMap = new Map<string, Match[]>()
  for (const m of [...matches].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
    const key = m.scheduled_time ?? ''
    if (!slotsMap.has(key)) slotsMap.set(key, [])
    slotsMap.get(key)!.push(m)
  }
  const sortedSlots = [...slotsMap.entries()]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '.3rem .55rem', gap: '.18rem', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '0 .4rem', flexShrink: 0 }}>
        <div style={{ minWidth: '3.1em', flexShrink: 0 }} />
        {'ABCD'.slice(0, numPitches).split('').map((letter, i) => (
          <div key={letter} style={{ display: 'contents' }}>
            {i > 0 && <div style={{ width: 1, flexShrink: 0 }} />}
            <div style={{ flex: 1, textAlign: 'center', fontSize: S.label, color: C.accent, fontWeight: 700, letterSpacing: '.08em' }}>{pitchLabel.toUpperCase()} {letter}</div>
          </div>
        ))}
      </div>
      {sortedSlots.map(([time, slotMatches], si) => {
        const allPlayed = slotMatches.every(m => m.played)
        return (
          <div key={time || si} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.15rem .4rem', borderRadius: 5, background: allPlayed ? C.col : C.upcoming, border: `1px solid ${C.border}`, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: S.label, color: allPlayed ? C.muted : C.accent, fontWeight: allPlayed ? 400 : 700, flexShrink: 0, minWidth: '3.1em', textAlign: 'center' }}>{time || '—'}</div>
            {'ABCD'.slice(0, numPitches).split('').map((letter, i) => (
              <div key={letter} style={{ display: 'contents' }}>
                {i > 0 && <div style={{ width: 1, alignSelf: 'stretch', background: C.border, flexShrink: 0 }} />}
                {slotMatches[i] ? <MatchCell match={slotMatches[i]} teams={teams} /> : <div style={{ flex: 1 }} />}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

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
            <div style={{ fontFamily: 'var(--font-display)', fontSize: S.label, letterSpacing: '.16em', color: accentColor, textTransform: 'uppercase', marginBottom: '.2rem', paddingBottom: '.14rem', borderBottom: `1px solid ${accentColor}` }}>
              {round.name}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '.15rem', overflow: 'hidden' }}>
              {roundSlots.map(s => {
                const hT = gt(s.home_id), aT = gt(s.away_id)
                const hw = s.played && s.home_score > s.away_score
                const aw = s.played && s.away_score > s.home_score
                return (
                  <div key={s.id} style={{ flex: 1, minHeight: 0, borderRadius: 5, background: s.played ? C.col : C.upcoming, border: `1px solid ${isFinal ? 'rgba(245,196,81,.45)' : isThird ? 'rgba(208,138,74,.35)' : C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {s.scheduled_time && !s.played && (
                      <div style={{ fontSize: S.label, color: C.muted, padding: '.1rem .5rem 0', fontWeight: 600 }}>{s.scheduled_time}</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '.3rem', padding: '.26rem .5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.25rem', minWidth: 0 }}>
                        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hw ? accentColor : C.muted, fontStyle: hT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(s.home_id)}</span>
                        {hT && <TeamLogo team={hT} size={tvLogo(28)} />}
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(2.4rem, calc(4 * var(--tv-vw, 1vw)), 5.5rem)' }}>
                        {(s.played || s.home_score + s.away_score > 0)
                          ? <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: s.played ? accentColor : C.live, letterSpacing: '.06em', lineHeight: 1 }}>{s.home_score}:{s.away_score}</span>
                          : <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: C.muted }}>VS</span>
                        }
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem', minWidth: 0 }}>
                        {aT && <TeamLogo team={aT} size={tvLogo(28)} />}
                        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aw ? accentColor : C.muted, fontStyle: aT ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tn(s.away_id)}</span>
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

/* ── View A: Zápasy ─────────────────────────────────────── */
function KioskMatches({ tournament, teams, groups, matches, bracketRounds, bracketSlots }: {
  tournament: Tournament | null; teams: Team[]; groups: Group[]
  matches: Match[]; bracketRounds: BracketRound[]; bracketSlots: BracketSlot[]
}) {
  const isLeague = tournament?.format === 'league'
  const groupMatches = matches.filter(m => m.group_id !== null)
  const allGroupMatchesPlayed = groups.length > 0 && groupMatches.length > 0 && groupMatches.every(m => m.played)
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  if (allGroupMatchesPlayed) {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <PlayoffMatchesSubCol rounds={bracketRounds} slots={bracketSlots} teams={teams} />
      </div>
    )
  }

  if (!groupMatches.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.section }}>
      Žádné zápasy
    </div>
  )

  // Sezóna: jen aktuální kolo (zápasy jsou v různé dny)
  const seasonRound = currentSeasonRound(groupMatches)
  if (seasonRound) {
    return <GroupMatchesSubCol groupName={`${seasonRound.round}${seasonRound.date ? ` · ${formatDateWeekday(seasonRound.date)}` : ''}`} matches={seasonRound.matches} teams={teams} />
  }

  if (isLeague) {
    return <LeagueMatchesCol matches={groupMatches} teams={teams} numPitches={tournament?.num_pitches ?? 2} pitchLabel={getSportDef(tournament?.sport).terms.pitchLabel} />
  }

  const numCols = sortedGroups.length <= 3 ? sortedGroups.length : Math.ceil(sortedGroups.length / 2)
  const columns: Group[][] = Array.from({ length: numCols }, () => [])
  sortedGroups.forEach((g, i) => columns[i % numCols].push(g))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, 1fr)`, height: '100%', overflow: 'hidden' }}>
      {columns.map((colGroups, colIdx) => (
        <div key={colIdx} style={{ borderLeft: colIdx > 0 ? `1px solid ${C.border}` : 'none', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {colGroups.map((group, gi) => {
            const gMatches = groupMatches.filter(m => m.group_id === group.id)
            return (
              <div key={group.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', borderTop: gi > 0 ? `2px solid ${C.border}` : 'none' }}>
                <GroupMatchesSubCol groupName={group.name} matches={gMatches} teams={teams} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ── View B: Tabulka (standings + scorers) ──────────────── */
function KioskTable({ tournament, teams, players, groups, matches, goals, bracketGoals }: {
  tournament: Tournament | null; teams: Team[]; players: Player[]; groups: Group[]
  matches: Match[]; goals: Goal[]; bracketGoals: BracketGoal[]
}) {
  const isLeague = tournament?.format === 'league'
  const sportDef = getSportDef(tournament?.sport)

  const zones = standingsZones(tournament)
  const teamById = new Map(teams.map(t => [t.id, t]))

  // Top 10 scorers — aggregate group goals + bracket_goals (O(n) pass)
  const goalsAgg: Record<string, number> = {}
  for (const g of goals) goalsAgg[g.player_id] = (goalsAgg[g.player_id] ?? 0) + g.count
  for (const g of bracketGoals) goalsAgg[g.player_id] = (goalsAgg[g.player_id] ?? 0) + g.count
  const scorers = players
    .map(p => ({ id: p.id, name: p.name, team: teams.find(t => t.id === p.team_id), total: goalsAgg[p.id] ?? 0 }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const podium = [C.gold, C.silver, C.bronze]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', height: '100%', overflow: 'hidden' }}>
      {/* Left: Standings */}
      <div style={{ borderRight: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '.6rem .8rem .2rem' }}>
        <FitBox watch={`${groups.length}|${matches.length}`} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'calc(.6rem * var(--tv-fit, 1))' }}>
          {groups.length === 0 ? (
            <div style={{ color: C.muted, fontSize: S.body, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Žádné skupiny</div>
          ) : (
            groups.map((group, gi) => (
              <TvGroupTable key={group.id} group={group} rows={calcGroupStandings(group, matches, sportDef)} teamById={teamById} sportDef={sportDef} zones={zones} showNotes={isLeague} showLegend={gi === 0} logoSize={28} />
            ))
          )}
        </FitBox>
      </div>

      {/* Right: Scorers */}
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '.6rem .8rem .4rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: S.section, letterSpacing: '.1em', color: C.gold, marginBottom: '.3rem', flexShrink: 0 }}>
          {sportDef.terms.scorersLabel}
        </div>
        {scorers.length === 0 ? (
          <div style={{ color: C.muted, fontSize: S.body, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>Žádní střelci</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.22rem', flex: 1, overflow: 'hidden' }}>
            {scorers.map((sc, i) => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.3rem .5rem', borderRadius: 6, background: i === 0 ? 'rgba(245,196,81,.08)' : 'transparent', borderLeft: i < 3 ? `3px solid ${podium[i]}` : '3px solid transparent' }}>
                <div style={{ width: '2em', textAlign: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: S.pts, color: i < 3 ? podium[i] : C.muted, lineHeight: 1 }}>{i + 1}</span>
                </div>
                {sc.team && <TeamLogo team={sc.team} size={tvLogo(28)} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: S.body, fontWeight: i < 3 ? 700 : 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.name}</div>
                  {sc.team && <div style={{ fontSize: S.label, color: C.muted }}>{sc.team.name}</div>}
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: i === 0 ? C.gold : C.accent, flexShrink: 0, lineHeight: 1 }}>{sc.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── View C: Pavouk ─────────────────────────────────────── */
function KioskBracket({ rounds, slots, teams }: { rounds: BracketRound[]; slots: BracketSlot[]; teams: Team[] }) {
  const gt = (id: string | null) => id ? teams.find(t => t.id === id) ?? null : null
  const tn = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? 'Určí se' : 'Určí se'
  const sorted = [...rounds].sort((a, b) => a.position - b.position)

  if (!sorted.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: S.section }}>
      Pavouk není nastaven
    </div>
  )

  return (
    <div style={{ padding: '.7rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '.7rem', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {sorted.map(round => {
        const roundSlots = [...slots].filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position)
        const isFinal   = /finále/i.test(round.name) && !/[3579]/i.test(round.name)
        const isThird   = /o\s*3/i.test(round.name) || /třet/i.test(round.name) || /bronze/i.test(round.name)
        const isFifth   = /o\s*5/i.test(round.name) || /5[\.-]/i.test(round.name)
        const isSeventh = /o\s*7/i.test(round.name) || /7[\.-]/i.test(round.name)
        const isNinth   = /o\s*9/i.test(round.name) || /9[\.-]/i.test(round.name)
        const accentColor = isFinal ? C.gold : isThird ? C.bronze : isFifth ? C.fifth : isSeventh ? C.seventh : isNinth ? C.ninth : C.accent
        const borderColor = isFinal ? 'rgba(245,196,81,.45)' : isThird ? 'rgba(208,138,74,.35)' : C.border

        return (
          <div key={round.id} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: S.section, letterSpacing: '.13em', color: accentColor, marginBottom: '.3rem', paddingBottom: '.2rem', borderBottom: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
              {round.name}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '.5rem', overflow: 'hidden' }}>
              {roundSlots.map(slot => {
                const hT = gt(slot.home_id), aT = gt(slot.away_id)
                const hw = slot.played && slot.home_score > slot.away_score
                const aw = slot.played && slot.away_score > slot.home_score
                return (
                  <div key={slot.id} style={{ flex: 1, minWidth: 0, background: slot.played ? C.col : C.upcoming, border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden', boxShadow: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {slot.scheduled_time && !slot.played && (
                      <div style={{ fontSize: S.label, color: C.muted, padding: '.2rem .7rem 0', fontWeight: 600 }}>{slot.scheduled_time}</div>
                    )}
                    {/* Home row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem .7rem', borderBottom: `1px solid ${borderColor}`, background: hw ? (isFinal ? 'rgba(245,196,81,.12)' : TV.accentSoft) : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {hT && <TeamLogo team={hT} size={tvLogo(28)} />}
                        <span style={{ fontSize: S.body, fontWeight: hw ? 700 : 400, color: hT ? (hw ? accentColor : C.text) : C.muted, fontStyle: hT ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hT?.name ?? 'Určí se'}</span>
                      </div>
                      {(slot.played || slot.home_score + slot.away_score > 0) && <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: !slot.played ? C.live : hw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>{slot.home_score}</span>}
                    </div>
                    {/* Away row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem .7rem', background: aw ? (isFinal ? 'rgba(245,196,81,.12)' : TV.accentSoft) : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', minWidth: 0 }}>
                        {aT && <TeamLogo team={aT} size={tvLogo(28)} />}
                        <span style={{ fontSize: S.body, fontWeight: aw ? 700 : 400, color: aT ? (aw ? accentColor : C.text) : C.muted, fontStyle: aT ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aT?.name ?? 'Určí se'}</span>
                      </div>
                      {(slot.played || slot.home_score + slot.away_score > 0) && <span style={{ fontFamily: 'var(--font-display)', fontSize: S.score, color: !slot.played ? C.live : aw ? accentColor : C.muted, marginLeft: 8, flexShrink: 0 }}>{slot.away_score}</span>}
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

/* ── Sub-header labels ───────────────────────────────────── */
function getSubheaders(_sportIcon?: string): Record<KioskView, { label: string }> {
  return {
    matches: { label: 'Zápasy — výsledky' },
    table:   { label: 'Tabulka a střelci' },
    bracket: { label: 'Play-off — pavouk' },
    spot:    { label: 'Partneři a oznámení' },
    vote:    { label: 'Hlasování diváků — hráč zápasu' },
  }
}

const VOICE_OPTIONS: [keyof AnnouncerSettings, string][] = [
  ['goals', 'Góly'], ['starts', 'Začátek zápasu'], ['ends', 'Konec zápasu'],
  ['milestones', 'Dohraná skupina a vítěz'], ['partner', 'Zmínka generálního partnera'],
]

/* ── Main KioskMode ─────────────────────────────────────── */
interface Props {
  tournament: Tournament | null
  teams: Team[]; players: Player[]; groups: Group[]
  matches: Match[]; goals: Goal[]; bracketGoals: BracketGoal[]
  bracketRounds: BracketRound[]; bracketSlots: BracketSlot[]
  announcements: Announcement[]
  onExit: () => void
  onScoreboard: () => void
  sponsors?: Sponsor[]
}

export default function KioskMode({ tournament, teams, players, groups, matches, goals, bracketGoals, bracketRounds, bracketSlots, announcements, onExit, onScoreboard, sponsors = [] }: Props) {
  const sportIcon = getSportDef(tournament?.sport).icon
  const bracketActive = bracketSlots.some(s => s.home_id != null || s.away_id != null)
  const allViews = getViews(sportIcon)
  // Moduly (systém modulů, Vlna 5) — změna přijde realtime, projeví se bez obnovení
  const goalAnimOn = useModule('goal_animation')
  const announcerOn = useModule('announcer')
  const directorOn = useModule('smart_director')
  const spotsOn = useModule('tv_spots')
  const spots = spotsOn ? buildSpots(sponsors, announcements) : []
  // Hlasování diváků: rozehraný zápas, jinak poslední dnes dohraný (modul fan_vote)
  const fanVoteOn = useModule('fan_vote')
  const voteFixture = fanVoteOn
    ? pickVoteGame(buildFixtures(matches, groups, bracketRounds, bracketSlots).filter(f => voteOpen(f, tournament) === 'open'))
    : null
  const voteGame: VoteGame | null = voteFixture && voteFixture.home_id && voteFixture.away_id
    ? { id: fixtureId(voteFixture), home_id: voteFixture.home_id, away_id: voteFixture.away_id, h: voteFixture.home_score, a: voteFixture.away_score, played: voteFixture.played, label: voteFixture.label }
    : null
  const { results: voteResults } = useFanVotes(tournament?.id ?? '', fanVoteOn && !!voteGame)
  const baseViews = bracketActive ? allViews : allViews.filter(v => v.key !== 'bracket')
  const effectiveViews: { key: KioskView; label: string }[] = [
    ...baseViews,
    ...(voteGame ? [{ key: 'vote' as const, label: 'Hlasování' }] : []),
    ...(spots.length ? [{ key: 'spot' as const, label: 'Partneři' }] : []),
  ]

  const [idx, setIdx] = useState(0)
  const [spotIdx, setSpotIdx] = useState(0)
  /** Chytrá režie: obrazovka držená déle než běžná rotace */
  const [holdMs, setHoldMs] = useState<number | null>(null)
  const [goalQueue, setGoalQueue] = useState<GoalShow[]>([])
  const [voiceOn, setVoiceOn] = useState(false)
  const [voiceMenu, setVoiceMenu] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState<AnnouncerSettings>(loadAnnouncerSettings)
  const [paused, setPaused] = useState(false)
  const [barKey, setBarKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const clock = useClock()

  const currentView = effectiveViews[idx % effectiveViews.length]
  const viewMs = holdMs ?? (currentView.key === 'spot' ? SPOT_MS : ROTATION_MS)
  const viewCount = effectiveViews.length
  const spotPos = effectiveViews.findIndex(v => v.key === 'spot')

  const advance = useCallback(() => {
    setHoldMs(null)
    setIdx(i => {
      const next = (i + 1) % viewCount
      if (next === spotPos) setSpotIdx(n => n + 1)
      return next
    })
    setBarKey(k => k + 1)
  }, [viewCount, spotPos])

  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(advance, viewMs)
    return () => clearTimeout(timerRef.current)
  }, [idx, paused, advance, viewMs, barKey])

  // ── Události (gól, začátek/konec zápasu, skupina, vítěz) — jen „od teď“ ──
  const tvEvents = useTvEvents(
    { tournament, matches, groups, bracketRounds, bracketSlots, goals, bracketGoals, players },
    goalAnimOn || announcerOn || directorOn,
  )
  const titlePartner = getTitlePartner(sponsors)
  const gameOf = (id: string) => {
    const m = matches.find(x => x.id === id)
    if (m) return { home_id: m.home_id, away_id: m.away_id, h: m.home_score, a: m.away_score, label: groups.find(g => g.id === m.group_id)?.name ?? m.round ?? '' }
    const sl = bracketSlots.find(x => x.id === id)
    return sl ? { home_id: sl.home_id, away_id: sl.away_id, h: sl.home_score, a: sl.away_score, label: bracketRounds.find(r => r.id === sl.round_id)?.name ?? 'Play-off' } : undefined
  }
  const latestRef = useRef({ gameOf, goalAnimOn, announcerOn, directorOn, voiceOn, voiceSettings, effectiveViews })
  latestRef.current = { gameOf, goalAnimOn, announcerOn, directorOn, voiceOn, voiceSettings, effectiveViews }

  useEffect(() => {
    if (!tvEvents.events.length) return
    const cur = latestRef.current
    for (const e of tvEvents.events as TvEvent[]) {
      if (e.type === 'goal' && cur.goalAnimOn) {
        const g = cur.gameOf(e.gameId)
        setGoalQueue(q => [...q, { key: e.key, teamId: e.teamId, scorers: e.scorers, count: e.count, homeId: g?.home_id ?? null, awayId: g?.away_id ?? null, h: e.h, a: e.a }])
      }
      if (cur.announcerOn && cur.voiceOn) {
        const text = announcementText(e, {
          teamName: id => teams.find(t => t.id === id)?.name ?? '',
          playerName: id => players.find(p => p.id === id)?.name ?? '',
          game: cur.gameOf,
          groupName: id => groups.find(g => g.id === id)?.name ?? 'Skupina',
          partner: cur.voiceSettings.partner ? titlePartner?.name : null,
        }, cur.voiceSettings)
        if (text) speak(text)
      }
      if (cur.directorOn) {
        const target: KioskView | null = e.type === 'goal' || e.type === 'match_end' ? 'matches' : e.type === 'group_done' ? 'table' : e.type === 'champion' ? 'bracket' : null
        const i = target ? cur.effectiveViews.findIndex(v => v.key === target) : -1
        if (i >= 0) {
          // po animaci gólu (běží přes celou obrazovku) přepnout na zápasy a chvíli držet
          const delay = e.type === 'goal' && cur.goalAnimOn ? GOAL_SHOW_MS : 0
          setTimeout(() => {
            if (!latestRef.current.directorOn) return
            clearTimeout(timerRef.current)
            setIdx(i)
            setHoldMs(DIRECTOR_HOLD_MS)
            setBarKey(k => k + 1)
          }, delay)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvEvents.id])

  // Dosah partnera: minuty běhu TV a zobrazení spotu partnera (jen při zapnutém modulu)
  const reachOn = useModule('partner_reach')
  useTvMinutes(tournament?.id, reachOn)
  const shownSpot = currentView.key === 'spot' && spots.length ? spots[spotIdx % spots.length] : null
  const shownSponsorId = shownSpot?.kind === 'partner' ? shownSpot.sponsor.id : null
  useEffect(() => {
    if (reachOn && tournament?.id && shownSponsorId) trackTvSpot(tournament.id, shownSponsorId)
  }, [reachOn, tournament?.id, shownSponsorId, spotIdx])

  // Hlasatel: vypnutí modulu nebo hlasu = okamžité ztišení; odchod z TV také
  useEffect(() => { if (!announcerOn || !voiceOn) cancelSpeech() }, [announcerOn, voiceOn])
  useEffect(() => () => cancelSpeech(), [])
  // Animace gólu: vypnutí modulu zahodí frontu
  useEffect(() => { if (!goalAnimOn) setGoalQueue([]) }, [goalAnimOn])
  // Chytrá režie vypnutá → zpět k běžnému střídání
  useEffect(() => { if (!directorOn) setHoldMs(null) }, [directorOn])
  // Vypnuté spoty: zůstat na platné obrazovce
  useEffect(() => { if (idx >= viewCount) setIdx(0) }, [idx, viewCount])
  const finishGoal = useCallback(() => setGoalQueue(q => q.slice(1)), [])

  function toggleVoice() {
    if (!voiceOn) {
      // Prohlížeč pustí hlas jen po kliknutí — krátké hlášení zvuk odemkne
      speak('Hlasatel zapnut.')
      setVoiceOn(true)
    } else {
      setVoiceOn(false)
    }
  }
  function changeVoiceSetting(k: keyof AnnouncerSettings) {
    setVoiceSettings(v => { const next = { ...v, [k]: !v[k] }; saveAnnouncerSettings(next); return next })
  }

  useEffect(() => {
    document.documentElement.requestFullscreen().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onExit])

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-kiosk-ctrl]')) return
    clearTimeout(timerRef.current)
    setPaused(p => !p)
  }

  const goTo = (i: number) => {
    clearTimeout(timerRef.current)
    setHoldMs(null)
    if (i === spotPos) setSpotIdx(n => n + 1)
    setIdx(i)
    setBarKey(k => k + 1)
    setPaused(false)
  }

  const subhdr = getSubheaders(sportIcon)[currentView.key]

  return (
    <div onClick={handleClick} style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: C.bg, cursor: paused ? 'pointer' : 'default', userSelect: 'none', fontFamily: 'var(--font-body)', color: C.text }}>
      <style>{`@keyframes kioskBar { from { width:0% } to { width:100% } }`}</style>

      {/* ── Progress bar ── */}
      <div style={{ height: 4, background: 'rgba(255,255,255,.08)', flexShrink: 0, position: 'relative' }}>
        <div key={paused ? 'p' : `b${barKey}`} style={{
          position: 'absolute', left: 0, top: 0, height: '100%', background: 'var(--brand)',
          animation: paused ? 'none' : `kioskBar ${viewMs}ms linear forwards`,
          width: paused ? '0%' : undefined,
        }} />
      </div>

      {/* ── Header ── */}
      <div style={{ background: C.hdr, flexShrink: 0, padding: '.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: S.title, letterSpacing: '.08em', color: '#fff', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tournament?.name || 'Turnaj'}
          </div>
          {tournament?.subtitle && (
            <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.6)', marginTop: '.1rem' }}>{tournament.subtitle}</div>
          )}
        </div>

        {/* Tab pills */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.5rem' }}>
          {effectiveViews.map((v, i) => (
            <button type="button" key={v.key} onClick={e => { e.stopPropagation(); goTo(i) }} style={{
              background: i === idx ? 'rgba(255,255,255,.2)' : 'transparent',
              color: i === idx ? '#fff' : 'rgba(255,255,255,.5)',
              border: `2px solid ${i === idx ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.15)'}`,
              borderRadius: 'var(--radius)', padding: '.3rem 1rem',
              fontSize: S.label, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.08em',
              cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', gap: '.35rem',
            }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Clock */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: S.title, color: C.text, letterSpacing: '.08em', flexShrink: 0 }}>
          {clock}
        </div>

        {/* Controls */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.7rem', alignItems: 'center', flexShrink: 0 }}>
          {paused && (
            <span style={{ fontSize: S.label, color: 'rgba(255,255,255,.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Pozastaveno</span>
          )}
          {announcerOn && speechAvailable() && (
            <div style={{ position: 'relative', display: 'flex', gap: '.35rem' }}>
              <button type="button" onClick={e => { e.stopPropagation(); toggleVoice() }} title={hasCzechVoice() ? 'Hlasatel' : 'V zařízení chybí český hlas — hlasatel bude mluvit s cizím přízvukem'}
                style={{ background: voiceOn ? 'color-mix(in srgb, var(--brand-on-dark) 35%, transparent)' : 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', borderRadius: 8, color: '#fff', fontSize: S.label, fontWeight: 700, padding: '.35rem 1rem', cursor: 'pointer' }}>
                Hlas: {voiceOn ? 'zap' : 'vyp'}
              </button>
              <button type="button" aria-label="Co hlásit" title="Co hlásit" onClick={e => { e.stopPropagation(); setVoiceMenu(m => !m) }}
                style={{ background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', borderRadius: 8, color: 'rgba(255,255,255,.8)', fontSize: S.label, fontWeight: 700, padding: '.35rem .6rem', cursor: 'pointer' }}>
                <SlidersHorizontal size={16} />
              </button>
              {voiceMenu && (
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 10, background: C.hdr, border: `1px solid ${C.border}`, borderRadius: 10, padding: '.6rem .8rem', minWidth: 220, display: 'flex', flexDirection: 'column', gap: '.35rem', fontSize: S.label, boxShadow: '0 12px 30px rgba(0,0,0,.5)' }}>
                  {VOICE_OPTIONS.map(([k, l]) => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', color: C.text }}>
                      <input type="checkbox" checked={voiceSettings[k]} onChange={() => changeVoiceSetting(k)} />{l}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); onScoreboard() }} style={{ background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', borderRadius: 8, color: 'rgba(255,255,255,.7)', fontSize: S.label, fontWeight: 700, padding: '.35rem 1rem', cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--brand-on-dark) 28%, transparent)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}>
            Tabule
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onExit() }} style={{ background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', borderRadius: 8, color: 'rgba(255,255,255,.7)', fontSize: S.label, fontWeight: 700, padding: '.35rem 1rem', cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,.4)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}>
            Ukončit
          </button>
        </div>
      </div>

      {/* ── Sub-header ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '.32rem 1.5rem', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: S.label, letterSpacing: '.16em', color: C.accent, textTransform: 'uppercase' }}>
          {subhdr.label}
        </span>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: currentView.key === 'table' ? C.col : C.panel }}>
        {currentView.key === 'matches' && (
          <KioskMatches tournament={tournament} teams={teams} groups={groups} matches={matches} bracketRounds={bracketRounds} bracketSlots={bracketSlots} />
        )}
        {currentView.key === 'table' && (
          <KioskTable tournament={tournament} teams={teams} players={players} groups={groups} matches={matches} goals={goals} bracketGoals={bracketGoals} />
        )}
        {currentView.key === 'bracket' && (
          <KioskBracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />
        )}
        {currentView.key === 'vote' && voteGame && tournament && (
          <TvVote game={voteGame} teams={teams} players={players} rows={voteResults.get(voteGame.id) ?? []}
            url={withAccessCode(matchUrl(tournament.id, voteGame.id), tournament) ?? matchUrl(tournament.id, voteGame.id)} />
        )}
        {currentView.key === 'spot' && spots.length > 0 && (
          <TvSpot spot={spots[spotIdx % spots.length]} />
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: 'var(--chrome)', borderTop: `1px solid ${C.border}`, flexShrink: 0, padding: '.8rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
        {/* Nav dots */}
        <div data-kiosk-ctrl style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          {effectiveViews.map((v, i) => (
            <div key={v.key} onClick={e => { e.stopPropagation(); goTo(i) }} style={{ width: i === idx ? '2.5rem' : '.8rem', height: '.8rem', minWidth: i === idx ? 28 : 10, minHeight: 10, maxWidth: i === idx ? 44 : 16, maxHeight: 16, borderRadius: 10, background: i === idx ? 'var(--brand)' : 'rgba(255,255,255,.25)', transition: 'all .35s', cursor: 'pointer' }} />
          ))}
          <span style={{ fontSize: S.label, color: 'rgba(255,255,255,.5)', marginLeft: '.4rem', fontFamily: 'var(--font-display)', letterSpacing: '.1em' }}>
            {currentView.label}
          </span>
        </div>

        {sponsors.some(sp => sp.logo_url) ? (
          <div style={{ flex: 1, minWidth: 0 }} title={paused ? 'Klikni pro pokračování' : `Přepne za ${ROTATION_MS / 1000}s · Klik = pauza`}>
            <TvPartnerBar sponsors={sponsors} />
          </div>
        ) : (
          <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.4)', textAlign: 'center' }}>
            {paused ? 'Klikni pro pokračování' : `Přepne za ${ROTATION_MS / 1000}s · Klik = pauza`}
          </div>
        )}

        {/* QR */}
        <div data-kiosk-ctrl style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: S.body, color: '#fff', letterSpacing: '.1em' }}>Sdílet</div>
            <div style={{ fontSize: S.label, color: 'rgba(255,255,255,.5)' }}>Naskenuj QR kód</div>
          </div>
          <div style={{ background: '#fff', padding: 4, borderRadius: 4, lineHeight: 0 }}>
            <QRCode size={52} url={tournamentQrUrl(tournament)} />
          </div>
        </div>
      </div>
      {goalAnimOn && goalQueue[0] && (
        <GoalOverlay goal={goalQueue[0]} teams={teams} players={players} partner={titlePartner} onDone={finishGoal} />
      )}
    </div>
  )
}
