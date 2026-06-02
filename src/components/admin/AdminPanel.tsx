import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { Assist } from '../../hooks/useAssists'
import type { Card } from '../../hooks/useCards'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketAssist } from '../../hooks/useBracketAssists'
import type { BracketCard } from '../../hooks/useBracketCards'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { RuleItem } from '../../hooks/useRuleItems'
import type { Referee } from '../../hooks/useReferees'
import InfoTab from './tabs/InfoTab'
import AnnouncementsTab from './tabs/AnnouncementsTab'
import RuleItemsTab from './tabs/RuleItemsTab'
import TeamsTab from './tabs/TeamsTab'
import GroupsTab from './tabs/GroupsTab'
import MatchesTab from './tabs/MatchesTab'
import ScorersTab from './tabs/ScorersTab'
import BracketTab from './tabs/BracketTab'
import SettingsTab from './tabs/SettingsTab'
import TipsAdminTab from './tabs/TipsAdminTab'
import RefereesTab from './tabs/RefereesTab'
import SponsorsTab from './tabs/SponsorsTab'
import type { Sponsor } from '../../hooks/useSponsors'

type ATab = 'info' | 'announcements' | 'rules' | 'teams' | 'referees' | 'groups' | 'matches' | 'scorers' | 'bracket' | 'tips' | 'sponsors' | 'settings'

const ADMIN_TABS: [ATab, string][] = [
  ['info',          'Info'],
  ['announcements', 'Informace'],
  ['rules',         'Pravidla'],
  ['teams',         'Týmy'],
  ['referees',      'Rozhodčí'],
  ['groups',        'Skupiny'],
  ['scorers',       'Střelci'],
  ['matches',       'Zápasy'],
  ['bracket',       'Play-off'],
  ['tips',          'Tipovačka'],
  ['sponsors',      'Sponzoři'],
  ['settings',      'Nastavení'],
]

// Záložky aktivně používané při turnaji — zvýraznit
const ACTION_TABS: ATab[] = ['matches', 'bracket', 'tips']

interface Props {
  session: Session | null
  tournamentId: string
  tournament: Tournament | null
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  goals: Goal[]
  assists: Assist[]
  cards: Card[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  announcements: Announcement[]
  ruleItems: RuleItem[]
  bracketGoals: BracketGoal[]
  bracketAssists: BracketAssist[]
  bracketCards: BracketCard[]
  referees: Referee[]
  refetchTournament: () => void
  refetchTeams: () => void
  refetchPlayers: () => void
  refetchGroups: () => void
  refetchMatches: () => void
  refetchGoals: () => void
  refetchAssists: () => void
  refetchCards: () => void
  refetchBracket: () => void
  refetchBracketGoals: () => void
  refetchBracketAssists: () => void
  refetchBracketCards: () => void
  refetchReferees: () => void
  refetchAnnouncements: () => void
  refetchRuleItems: () => void
  sponsors: Sponsor[]
  refetchSponsors: () => void
  showToast: (msg: string) => void
  onClose: () => void
}

export default function AdminPanel(props: Props) {
  const { session, onClose, showToast, refetchMatches, refetchGoals, refetchBracket, refetchBracketGoals } = props
  const [aTab, setATab] = useState<ATab>('info')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const login = async () => {
    if (!email || !password) { setErr('Vyplňte email a heslo.'); return }
    setLoading(true); setErr('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErr('Špatné přihlašovací údaje.')
      else { setEmail(''); setPassword('') }
    } catch {
      setErr('Chyba připojení. Zkuste znovu.')
    } finally {
      setLoading(false)
    }
  }

  const sendReset = async () => {
    if (!resetEmail) { setErr('Zadej e-mail.'); return }
    setResetLoading(true); setErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    })
    setResetLoading(false)
    if (error) { setErr(error.message); return }
    setResetSent(true)
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    showToast(error ? 'Chyba odhlášení: ' + error.message : 'Odhlášen ✓')
  }

  const tabProps = { ...props, showToast, refetchMatches, refetchGoals, refetchBracket, refetchBracketGoals }
  const isLeagueNoPlayoff = props.tournament?.format === 'league' && !(props.tournament?.league_has_playoff ?? true)
  const visibleAdminTabs = ADMIN_TABS.filter(([id]) => !isLeagueNoPlayoff || id !== 'bracket')
  const mouseDownOnBackdrop = useRef(false)

  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget }}
      onClick={e => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div style={{
        width: 'min(560px, 100vw)',
        height: '100vh',
        background: '#fff',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-panel)',
        animation: 'slideIn .22s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Header */}
        <div style={{
          padding: '.85rem 1.3rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '.65rem',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚽</span>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '.06em', flex: 1 }}>
            Admin panel
          </h2>
          <span style={{
            fontSize: '.61rem', background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid rgba(37,99,235,.2)', padding: '2px 8px',
            borderRadius: 20, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em',
          }}>
            {session ? 'Přihlášen' : 'Správce'}
          </span>
          {session && (
            <button type="button" onClick={logout} className="btn btn-d btn-sm" style={{ marginRight: '.25rem' }}>
              Odhlásit
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-d btn-sm">✕ Zavřít</button>
        </div>

        {!session ? (
          /* Login form */
          <div style={{ padding: '1.7rem', display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '.06em' }}>Přihlášení</h3>
            <div className="field-group">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="admin@firma.cz"
                autoFocus
              />
            </div>
            <div className="field-group">
              <label className="field-label">Heslo</label>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="••••••••"
              />
            </div>
            <button type="button" className="btn btn-p btn-full" onClick={login} style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Přihlašuji…' : 'Přihlásit'}
            </button>
            {err && <p style={{ color: 'var(--danger)', fontSize: '.78rem' }}>{err}</p>}
            {!resetMode ? (
              <button type="button" onClick={() => { setResetMode(true); setErr('') }} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem',
                cursor: 'pointer', padding: 0, textDecoration: 'underline', alignSelf: 'flex-start',
              }}>
                Zapomenuté heslo?
              </button>
            ) : resetSent ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '.75rem', fontSize: '.82rem', fontFamily: "'DM Sans', sans-serif", color: '#166534' }}>
                ✅ E-mail s odkazem pro reset hesla byl odeslán. Zkontroluj schránku (včetně spamu).
                <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setResetEmail('') }} style={{ display: 'block', marginTop: '.5rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', padding: 0, textDecoration: 'underline' }}>
                  ← Zpět na přihlášení
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', background: '#f8fafc', borderRadius: 8, padding: '.85rem', border: '1px solid var(--border)' }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', margin: 0, color: '#374151' }}>
                  Zadej svůj e-mail a pošleme ti odkaz pro reset hesla.
                </p>
                <input
                  className="field-input"
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="admin@firma.cz"
                />
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button type="button" className="btn btn-p" onClick={sendReset} style={{ flex: 1, opacity: resetLoading ? 0.6 : 1 }}>
                    {resetLoading ? 'Odesílám…' : 'Odeslat reset'}
                  </button>
                  <button type="button" className="btn btn-d" onClick={() => { setResetMode(false); setErr(''); setResetEmail('') }}>
                    Zrušit
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Admin tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              padding: '0 .6rem',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              {visibleAdminTabs.map(([key, label]) => {
                const isActive = aTab === key
                const isAction = ACTION_TABS.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setATab(key)}
                    style={{
                      border: 'none',
                      background: isActive ? 'none' : isAction ? 'rgba(22,163,74,.08)' : 'none',
                      color: isActive ? 'var(--accent)' : isAction ? '#15803d' : 'var(--muted)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '.67rem', fontWeight: isAction ? 700 : 600,
                      textTransform: 'uppercase', letterSpacing: '.09em',
                      padding: '.62rem .6rem', cursor: 'pointer',
                      whiteSpace: 'nowrap', position: 'relative',
                      transition: 'color .2s',
                      borderBottom: isActive ? '2px solid var(--accent)' : isAction ? '2px solid rgba(22,163,74,.3)' : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              <div style={{ fontSize: '.62rem', color: 'var(--muted)', padding: '.25rem .75rem .4rem', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(22,163,74,.15)', border: '1px solid rgba(22,163,74,.35)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />
                Zelené záložky — aktivní při průběhu turnaje
              </div>
            </div>

            {/* Tab body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.15rem 1.2rem' }}>
              {aTab === 'info'          && <InfoTab {...tabProps} />}
              {aTab === 'announcements' && <AnnouncementsTab {...tabProps} />}
              {aTab === 'rules'         && <RuleItemsTab ruleItems={props.ruleItems} tournament={props.tournament} refetchRuleItems={props.refetchRuleItems} showToast={showToast} />}
              {aTab === 'teams'         && <TeamsTab {...tabProps} />}
              {aTab === 'referees'      && <RefereesTab referees={props.referees} tournament={props.tournament} refetchReferees={props.refetchReferees} showToast={showToast} />}
              {aTab === 'groups'        && <GroupsTab {...tabProps} />}
              {aTab === 'matches'       && <MatchesTab {...tabProps} />}
              {aTab === 'scorers'       && <ScorersTab {...tabProps} />}
              {aTab === 'bracket'       && <BracketTab {...tabProps} />}
              {aTab === 'tips'          && <TipsAdminTab showToast={showToast} tournament={props.tournament} teams={props.teams} players={props.players} groups={props.groups} matches={props.matches} bracketSlots={props.bracketSlots} bracketRounds={props.bracketRounds} />}
              {aTab === 'sponsors'      && <SponsorsTab sponsors={props.sponsors} tournament={props.tournament} refetchSponsors={props.refetchSponsors} showToast={showToast} />}
              {aTab === 'settings'      && <SettingsTab {...tabProps} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
