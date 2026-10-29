import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { unlockWithCode } from '../../lib/accessCodes'

/** Formulář pro přístupový kód soukromého turnaje. onUnlocked dostane id turnaje. */
export default function AccessCodeForm({ onUnlocked, autoFocus }: { onUnlocked: (tournamentId: string) => void; autoFocus?: boolean }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await unlockWithCode(code)
      if (res === 'unavailable') setError('Soukromé turnaje zatím nejsou na platformě aktivní.')
      else if (!res) setError('Neplatný kód. Zkontrolujte ho u pořadatele.')
      else onUnlocked(res)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acf" onSubmit={submit}>
      <label className="field-label" htmlFor="acf-code">Přístupový kód</label>
      <div className="acf__row">
        <input
          id="acf-code"
          className="field-input acf__input"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-EFGH"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        <button type="submit" className="ui-btn ui-btn--primary" style={{ opacity: busy ? 0.6 : 1 }}>
          <KeyRound size={16} />{busy ? 'Ověřuji…' : 'Vstoupit'}
        </button>
      </div>
      {error && <p className="acf__err">{error}</p>}
    </form>
  )
}
