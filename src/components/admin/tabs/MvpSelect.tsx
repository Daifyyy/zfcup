// Volba hráče zápasu (MVP) v editoru zápasu skupiny/ligy i play-off (migrace 22).
import { Award } from 'lucide-react'
import type { Player } from '../../../hooks/usePlayers'
import type { Team } from '../../../hooks/useTeams'
import { supabase } from '../../../lib/supabase'
import { isMissingColumnError } from '../../../lib/partners'

export function MvpSelect({ value, onChange, home, away, homePlayers, awayPlayers }: {
  value: string
  onChange: (id: string) => void
  home?: Team
  away?: Team
  homePlayers: Player[]
  awayPlayers: Player[]
}) {
  if (!homePlayers.length && !awayPlayers.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.65rem' }}>
      <Award size={14} style={{ color: 'var(--muted)' }} aria-label="Hráč zápasu" />
      <select className="field-input field-select" value={value} onChange={e => onChange(e.target.value)}
        aria-label="Hráč zápasu" style={{ fontSize: '.82rem', padding: '.25rem .45rem', flex: 1 }}>
        <option value="">— Hráč zápasu (nevybrán) —</option>
        {homePlayers.length > 0 && <optgroup label={home?.name ?? 'Domácí'}>{homePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
        {awayPlayers.length > 0 && <optgroup label={away?.name ?? 'Hosté'}>{awayPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
      </select>
    </div>
  )
}

/** Uloží hráče zápasu; bez migrace 22 vrátí srozumitelnou chybu (skóre se uloží zvlášť). */
export async function saveMvp(table: 'matches' | 'bracket_slots', id: string, playerId: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from(table).update({ mvp_player_id: playerId || null }).eq('id', id)
  if (error && isMissingColumnError(error, 'mvp_player_id')) return { error: { message: 'chybí migrace 22 (db-backup/22_mvp_best_team.sql)' } }
  return { error }
}
