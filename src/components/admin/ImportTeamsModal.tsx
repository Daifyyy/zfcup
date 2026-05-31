import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { TEAM_COLORS } from '../../lib/constants'
import type { Team } from '../../hooks/useTeams'

interface ImportedPlayer {
  name: string
  number: number | null
  role: string | null
}

interface ImportedTeam {
  name: string
  players: ImportedPlayer[]
}

interface Props {
  open: boolean
  existingTeams: Team[]
  tournamentId: string
  onClose: () => void
  onImported: () => void
  showToast: (msg: string) => void
}

function parseRole(raw: string | undefined | null): string | null {
  if (!raw) return null
  const v = String(raw).trim().toLowerCase()
  if (v === 'k' || v === 'kapitán' || v === 'kapitan') return 'captain'
  if (v === 'b' || v === 'brankář' || v === 'brankar') return 'goalkeeper'
  if (v === 'kb' || v === 'bk' || v === 'kapitán+brankář' || v === 'both') return 'both'
  return null
}

function parseNumber(raw: unknown): number | null {
  const n = Number(raw)
  return !isNaN(n) && n > 0 ? Math.round(n) : null
}

function parseSheets(wb: XLSX.WorkBook, fileName: string): ImportedTeam[] {
  const teams: ImportedTeam[] = []

  if (wb.SheetNames.length === 1) {
    // Varianta A: jeden list — sloupce Tým | Hráč | Číslo | Role
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const teamMap = new Map<string, ImportedPlayer[]>()

    for (const row of rows) {
      const vals = Object.values(row).map(String)
      // Najdi sloupce dle hlavičky nebo pořadí (fallback)
      const keys = Object.keys(row)
      const teamKey = keys.find(k => /tým|tym|team/i.test(k)) ?? keys[0]
      const nameKey = keys.find(k => /hráč|hrac|jméno|jmeno|player|name/i.test(k)) ?? keys[1]
      const numKey  = keys.find(k => /číslo|cislo|number|num|#/i.test(k)) ?? keys[2]
      const roleKey = keys.find(k => /role|pozice|position/i.test(k)) ?? keys[3]

      const teamName = String(row[teamKey] ?? '').trim()
      const playerName = String(row[nameKey] ?? '').trim()
      if (!teamName || !playerName) continue

      if (!teamMap.has(teamName)) teamMap.set(teamName, [])
      teamMap.get(teamName)!.push({
        name: playerName,
        number: parseNumber(row[numKey]),
        role: parseRole(String(row[roleKey] ?? '')),
      })
      void vals
    }
    for (const [name, players] of teamMap) teams.push({ name, players })

  } else {
    // Varianta B: každý list = jeden tým — sloupce Hráč | Číslo | Role
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const players: ImportedPlayer[] = []

      for (const row of rows) {
        const keys = Object.keys(row)
        const nameKey = keys.find(k => /hráč|hrac|jméno|jmeno|player|name/i.test(k)) ?? keys[0]
        const numKey  = keys.find(k => /číslo|cislo|number|num|#/i.test(k)) ?? keys[1]
        const roleKey = keys.find(k => /role|pozice|position/i.test(k)) ?? keys[2]

        const playerName = String(row[nameKey] ?? '').trim()
        if (!playerName) continue
        players.push({
          name: playerName,
          number: parseNumber(row[numKey]),
          role: parseRole(String(row[roleKey] ?? '')),
        })
      }
      if (players.length > 0) {
        teams.push({ name: sheetName, players })
      }
    }
  }

  void fileName
  return teams
}

export default function ImportTeamsModal({ open, existingTeams, tournamentId, onClose, onImported, showToast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportedTeam[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')

  if (!open) return null

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const teams = parseSheets(wb, file.name)
        if (teams.length === 0) { showToast('Soubor neobsahuje žádná data'); return }
        setPreview(teams)
      } catch {
        showToast('Nepodařilo se přečíst soubor')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      let teamCount = 0, playerCount = 0
      const usedColors = new Set(existingTeams.map(t => t.color))
      const availableColors = TEAM_COLORS.filter(c => !usedColors.has(c))
      let colorIdx = 0

      for (const importedTeam of preview) {
        // Zkontroluj jestli tým už existuje
        const existing = existingTeams.find(t => t.name.toLowerCase() === importedTeam.name.toLowerCase())
        let teamId: string

        if (existing) {
          teamId = existing.id
        } else {
          const color = availableColors[colorIdx % availableColors.length] ?? TEAM_COLORS[colorIdx % TEAM_COLORS.length]
          colorIdx++
          const { data, error } = await supabase.from('teams')
            .insert({ name: importedTeam.name, color, tournament_id: tournamentId })
            .select('id')
            .single()
          if (error) { showToast('Chyba vytváření týmu: ' + error.message); setImporting(false); return }
          teamId = data.id
          teamCount++
        }

        if (importedTeam.players.length > 0) {
          const { error } = await supabase.from('players').insert(
            importedTeam.players.map(p => ({ team_id: teamId, name: p.name, number: p.number, role: p.role, tournament_id: tournamentId }))
          )
          if (error) { showToast('Chyba přidávání hráčů: ' + error.message); setImporting(false); return }
          playerCount += importedTeam.players.length
        }
      }

      showToast(`Import dokončen ✓ — ${teamCount} nových týmů, ${playerCount} hráčů`)
      onImported()
      setPreview(null)
      setFileName('')
      onClose()
    } finally {
      setImporting(false)
    }
  }

  const totalPlayers = preview?.reduce((s, t) => s + t.players.length, 0) ?? 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '1rem 1.2rem .75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '.06em' }}>Import týmů z CSV/Excel</span>
          <button type="button" className="btn btn-d btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.2rem' }}>
          {!preview ? (
            <>
              <div className="info-box" style={{ marginBottom: '.85rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '.3rem', fontSize: '.78rem' }}>Podporované formáty</div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                  <strong>Varianta A — jeden list:</strong> sloupce <code>Tým | Hráč | Číslo | Role</code><br />
                  <strong>Varianta B — více listů:</strong> každý list = tým, sloupce <code>Hráč | Číslo | Role</code><br />
                  Role: <code>K</code>=kapitán, <code>B</code>=brankář, <code>KB</code>=oboje, prázdné=žádná
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              <button type="button" className="btn btn-p" onClick={() => fileRef.current?.click()} style={{ width: '100%' }}>
                📥 Vybrat soubor CSV / Excel
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '.73rem', color: 'var(--muted)', marginBottom: '.75rem' }}>
                Soubor: <strong>{fileName}</strong> · {preview.length} týmů · {totalPlayers} hráčů
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {preview.map((team, i) => (
                  <div key={i} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '.6rem .8rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', marginBottom: '.3rem' }}>
                      {existingTeams.find(t => t.name.toLowerCase() === team.name.toLowerCase())
                        ? <span style={{ color: 'var(--muted)' }}>🔄 {team.name} <span style={{ fontWeight: 400 }}>(existující tým)</span></span>
                        : <span>🆕 {team.name}</span>
                      }
                    </div>
                    {team.players.length > 0 ? (
                      <div style={{ fontSize: '.7rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                        {team.players.map((p, j) => (
                          <span key={j}>
                            {p.name}{p.number ? ` #${p.number}` : ''}{p.role ? ` (${p.role === 'captain' ? 'C' : p.role === 'goalkeeper' ? 'B' : 'CB'})` : ''}
                            {j < team.players.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>— žádní hráči</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {preview && (
          <div style={{ padding: '.75rem 1.2rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-d" onClick={() => { setPreview(null); setFileName('') }}>← Zpět</button>
            <button type="button" className="btn btn-p" onClick={handleImport} style={{ opacity: importing ? .6 : 1 }}>
              {importing ? 'Importuji…' : `Importovat (${preview.length} týmů)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
