import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { Announcement } from '../../hooks/useAnnouncements'
import InfoTab from './tabs/InfoTab'
import AnnouncementsTab from './tabs/AnnouncementsTab'
import TeamsTab from './tabs/TeamsTab'
import GroupsTab from './tabs/GroupsTab'
import MatchesTab from './tabs/MatchesTab'
import ScorersTab from './tabs/ScorersTab'
import BracketTab from './tabs/BracketTab'
import SettingsTab from './tabs/SettingsTab'
import TipsAdminTab from './tabs/TipsAdminTab'

type ATab = 'info' | 'announcements' | 'teams' | 'groups' | 'matches' | 'scorers' | 'bracket' | 'tips' | 'settings'

const ADMIN_TABS: [ATab, string][] = [
  ['info',          'Info'],
  ['announcements', 'Informace'],
  ['teams',         'Týmy'],
  ['groups',        'Skupiny'],
  ['matches',       'Zápasy'],
  ['scorers',       'Střelci'],
  ['bracket',       'Pavouk'],
  ['tips',          'Tipovačka'],
  ['settings',      'Nastavení'],
]

interface Props {
  session: Session | null
  tournament: Tournament | null
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  goals: Goal[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  announcements: Announcement[]
  bracketGoals: BracketGoal[]
  refetchMatches: () => void
  refetchGoals: () => void
  refetchBracketGoals: () => void
  showToast: (msg: string) => void
  onClose: () => void
}

export default function AdminPanel(props: Props) {
  const { session, onClose, showToast, refetchMatches, refetchGoals, refetchBracketGoals } = props
  const [aTab, setATab] = useState<ATab>('info')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const login = async () => {
    if (!email || !password) { setErr('Vyplňte email a heslo.'); return }
    setLoading(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setErr('Špatné přihlašovací údaje.')
    else { setEmail(''); setPassword('') }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    showToast('Odhlášen ✓')
  }

  const tabProps = { ...props, showToast, refetchMatches, refetchGoals, refetchBracketGoals }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
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
            <button onClick={logout} className="btn btn-d btn-sm" style={{ marginRight: '.25rem' }}>
              Odhlásit
            </button>
          )}
          <button onClick={onClose} className="btn btn-d btn-sm">✕ Zavřít</button>
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
            <button className="btn btn-p btn-full" onClick={login} disabled={loading}>
              {loading ? 'Přihlašuji…' : 'Přihlásit'}
            </button>
            {err && <p style={{ color: 'var(--danger)', fontSize: '.78rem' }}>{err}</p>}
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
              {ADMIN_TABS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setATab(key)}
                  style={{
                    background: 'none', border: 'none',
                    color: aTab === key ? 'var(--accent)' : 'var(--muted)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '.67rem', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '.09em',
                    padding: '.62rem .6rem', cursor: 'pointer',
                    whiteSpace: 'nowrap', position: 'relative',
                    transition: 'color .2s',
                    borderBottom: aTab === key ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.15rem 1.2rem' }}>
              {aTab === 'info'          && <InfoTab {...tabProps} />}
              {aTab === 'announcements' && <AnnouncementsTab {...tabProps} />}
              {aTab === 'teams'         && <TeamsTab {...tabProps} />}
              {aTab === 'groups'        && <GroupsTab {...tabProps} />}
              {aTab === 'matches'       && <MatchesTab {...tabProps} />}
              {aTab === 'scorers'       && <ScorersTab {...tabProps} />}
              {aTab === 'bracket'       && <BracketTab {...tabProps} />}
              {aTab === 'tips'          && <TipsAdminTab showToast={showToast} teams={props.teams} groups={props.groups} />}
              {aTab === 'settings'      && <SettingsTab {...tabProps} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
