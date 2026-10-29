import { useState } from 'react'
import { Check, Copy, Globe, Lock, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { isMissingColumnError } from '../../../lib/partners'
import { accessLink, formatCode, generateAccessCode } from '../../../lib/accessCodes'
import { copyText } from '../../../lib/share'
import { confirmDialog } from '../../ui/ConfirmDialog'
import type { Tournament } from '../../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
  refetchTournament: () => void
  showToast: (msg: string) => void
}

/** Admin → Nastavení → Viditelnost: veřejný / soukromý turnaj s přístupovým kódem (migrace 15). */
export default function VisibilitySection({ tournament, refetchTournament, showToast }: Props) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  if (!tournament) return null
  const available = tournament.visibility !== undefined
  const isPrivate = tournament.visibility === 'private'
  const code = tournament.access_code ?? ''

  async function save(patch: { visibility: 'public' | 'private'; access_code: string | null }) {
    if (!tournament || saving) return
    setSaving(true)
    try {
      // Kolize kódu (UNIQUE) je extrémně nepravděpodobná — pro jistotu jeden nový pokus
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase.from('tournament').update(patch).eq('id', tournament.id)
        if (!error) { refetchTournament(); showToast(patch.visibility === 'private' ? 'Turnaj je soukromý ✓' : 'Turnaj je veřejný ✓'); return }
        if (isMissingColumnError(error, 'visibility') || isMissingColumnError(error, 'access_code')) {
          showToast('Chybí migrace 15 (db-backup/15_private_tournaments.sql)'); return
        }
        if (error.code === '23505' && patch.access_code) { patch = { ...patch, access_code: generateAccessCode() }; continue }
        showToast('Chyba: ' + error.message); return
      }
    } finally {
      setSaving(false)
    }
  }

  async function makePrivate() {
    if (!await confirmDialog('Turnaj zmizí z vyhledávání a jeho stránky uvidí jen ten, kdo zadá přístupový kód (nebo otevře odkaz s kódem).\n\nLoga a fotky zůstanou dostupné přes přímou adresu obrázku.', { title: 'Udělat turnaj soukromým?', confirmLabel: 'Soukromý' })) return
    await save({ visibility: 'private', access_code: generateAccessCode() })
  }

  async function makePublic() {
    if (!await confirmDialog('Turnaj bude vidět všem a půjde vyhledat na úvodní stránce. Přístupový kód přestane platit.', { title: 'Zveřejnit turnaj?', confirmLabel: 'Zveřejnit' })) return
    await save({ visibility: 'public', access_code: null })
  }

  async function regenerate() {
    if (!await confirmDialog('Starý kód i odkazy s ním přestanou platit. Divákům, kteří turnaj už otevřeli, přestane fungovat.', { title: 'Vygenerovat nový kód?', confirmLabel: 'Nový kód', danger: true })) return
    await save({ visibility: 'private', access_code: generateAccessCode() })
  }

  async function copy(what: 'code' | 'link') {
    const ok = await copyText(what === 'code' ? formatCode(code) : accessLink(tournament!.id, code))
    if (ok) { setCopied(what); setTimeout(() => setCopied(null), 1500) }
    else showToast('Kopírování není dostupné — označte text ručně')
  }

  return (
    <div className="vis">
      {!available && (
        <p className="vis__note">Soukromé turnaje vyžadují migraci 15 (<code>db-backup/15_private_tournaments.sql</code>). Do té doby jsou všechny turnaje veřejné.</p>
      )}
      <div className="an-types" role="radiogroup" aria-label="Viditelnost turnaje" style={{ opacity: !available || saving ? 0.6 : 1 }}>
        <button type="button" role="radio" aria-checked={!isPrivate} className={!isPrivate ? 'an-type an-type--on' : 'an-type'}
          onClick={() => { if (!available) { showToast('Chybí migrace 15'); return } if (isPrivate) makePublic() }}>
          <Globe size={14} />Veřejný
        </button>
        <button type="button" role="radio" aria-checked={isPrivate} className={isPrivate ? 'an-type an-type--on' : 'an-type'}
          onClick={() => { if (!available) { showToast('Chybí migrace 15'); return } if (!isPrivate) makePrivate() }}>
          <Lock size={14} />Soukromý
        </button>
      </div>
      <p className="vis__note">
        {isPrivate
          ? 'Turnaj není ve vyhledávání. Divákům pošlete kód nebo odkaz s kódem — kód zadají na úvodní stránce (Mám přístupový kód).'
          : 'Turnaj je vidět všem a dá se vyhledat na úvodní stránce.'}
      </p>
      {isPrivate && code && (
        <div className="vis__code">
          <div>
            <div className="vis__label">Přístupový kód</div>
            <div className="vis__value">{formatCode(code)}</div>
          </div>
          <div className="vis__actions">
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => copy('code')}>
              {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}Kód
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => copy('link')}>
              {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}Odkaz s kódem
            </button>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={regenerate} style={{ opacity: saving ? 0.6 : 1 }}>
              <RefreshCw size={14} />Nový kód
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
