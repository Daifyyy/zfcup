// Admin → Partneři → Dosah partnera (modul partner_reach, migrace 24):
// QR akce u každého partnera (cílový odkaz + výzva) a report po akci.
import { useState } from 'react'
import { BarChart3, Copy, QrCode, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useModule } from '../../../lib/ModulesContext'
import { usePartnerLinks } from '../../../hooks/usePartnerLinks'
import { newReachCode, normalizeTarget, reachUrl, type PartnerLink } from '../../../lib/partnerReach'
import { copyText } from '../../../lib/share'
import { lazyComponent } from '../../../lib/lazyComponent'
import { sortByTier, tierLabel, tierOf } from '../../../lib/partners'
import { confirmDialog } from '../../ui/ConfirmDialog'
import QRCode from '../../ui/QRCode'
import type { Sponsor } from '../../../hooks/useSponsors'
import type { Tournament } from '../../../hooks/useTournament'

const PartnerReport = lazyComponent(() => import('../PartnerReport'))

export default function PartnerReachSection({ tournament, sponsors, showToast }: { tournament: Pick<Tournament, 'id'> | null; sponsors: Sponsor[]; showToast: (m: string) => void }) {
  const on = useModule('partner_reach')
  const { links, refetch } = usePartnerLinks(tournament?.id ?? '', on)
  const [reportOpen, setReportOpen] = useState(false)
  if (!on || !tournament) return null
  const byId = new Map(links.filter(l => l.sponsor_id).map(l => [l.sponsor_id!, l]))

  return (
    <>
      <hr className="divider" />
      <div className="sub-title">Dosah partnera</div>
      <div className="info-box">
        U partnera nastavte <b>QR akci</b> — kam má QR kód vést a krátkou výzvu („Sleva 10 % s kódem CUP“). QR se objeví ve spotu na TV,
        u generálního partnera na grafikách a odkaz na stránce Partneři. Aplikace počítá skeny (bez cookies, jen součty) a připraví
        <b> report pro partnery</b>. Vytištěné QR fungují i po turnaji.
      </div>
      <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" style={{ marginBottom: '.7rem' }} onClick={() => setReportOpen(true)}>
        <BarChart3 size={15} />Report pro partnery (tisk / PDF)
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
        {sortByTier(sponsors).map(s => (
          <LinkEditor key={s.id + (byId.get(s.id)?.id ?? '')} tournament={tournament} sponsor={s} link={byId.get(s.id)} onSaved={refetch} showToast={showToast} />
        ))}
      </div>
      {reportOpen && <PartnerReport onClose={() => setReportOpen(false)} />}
    </>
  )
}

function LinkEditor({ tournament, sponsor, link, onSaved, showToast }: { tournament: Pick<Tournament, 'id'>; sponsor: Sponsor; link?: PartnerLink; onSaved: () => void; showToast: (m: string) => void }) {
  const [target, setTarget] = useState(link?.target_url ?? sponsor.website_url ?? '')
  const [cta, setCta] = useState(link?.cta ?? '')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(!!link)

  async function save() {
    if (saving) return
    const url = normalizeTarget(target)
    if (!url) { showToast('Zadejte platnou adresu (např. www.partner.cz/akce)'); return }
    setSaving(true)
    try {
      const payload = { target_url: url, cta: cta.trim() || null }
      // Nový odkaz: náhodný kód; při vzácné kolizi (UNIQUE) ještě jeden pokus
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = link
          ? await supabase.from('partner_links').update(payload).eq('id', link.id)
          : await supabase.from('partner_links').insert({ ...payload, tournament_id: tournament.id, sponsor_id: sponsor.id, code: newReachCode() })
        if (!error) { showToast('QR akce uložena ✓'); onSaved(); return }
        if (error.code === '23505' && !link) continue
        showToast(/partner_links|schema cache|42P01/i.test(error.message + error.code) ? 'Chybí migrace 24 (db-backup/24_partner_reach.sql)' : 'Chyba: ' + error.message)
        return
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!link) return
    if (!await confirmDialog('QR kód přestane fungovat — i ten, který už je vytištěný nebo sdílený. Naměřená čísla v reportu zůstanou.', { title: 'Zrušit QR akci?', confirmLabel: 'Zrušit akci', danger: true })) return
    const { error } = await supabase.from('partner_links').delete().eq('id', link.id)
    if (error) showToast('Chyba: ' + error.message)
    else { showToast('QR akce zrušena'); onSaved() }
  }

  const tvUrl = link ? reachUrl(link.code, 'tv') : ''
  return (
    <div className="lp-switch-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
        {sponsor.logo_url
          ? <img src={sponsor.logo_url} alt="" style={{ width: 56, height: 30, objectFit: 'contain', background: '#fff', borderRadius: 4 }} />
          : <span style={{ width: 56 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.name}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--ink-muted)' }}>{tierLabel(tierOf(sponsor))}{link ? ' · QR akce aktivní' : ''}</div>
        </div>
        {!open && (
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setOpen(true)}><QrCode size={15} />Nastavit QR akci</button>
        )}
      </div>
      {open && (
        <>
          <label style={{ fontSize: '.74rem', color: 'var(--ink-muted)' }}>Kam QR vede
            <input className="field-input" value={target} onChange={e => setTarget(e.target.value)} placeholder="www.partner.cz/akce" style={{ marginTop: 3 }} />
          </label>
          <label style={{ fontSize: '.74rem', color: 'var(--ink-muted)' }}>Výzva (krátce, ukáže se u QR)
            <input className="field-input" value={cta} onChange={e => setCta(e.target.value)} maxLength={120} placeholder="Naskenuj a získej slevu 10 % — kód CUP26" style={{ marginTop: 3 }} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" style={{ opacity: saving ? 0.5 : 1 }} onClick={save}>{link ? 'Uložit změny' : 'Vytvořit QR akci'}</button>
            {link && <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" style={{ color: 'var(--loss)' }} onClick={remove}><Trash2 size={14} />Zrušit</button>}
          </div>
          {link && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginTop: '.2rem' }}>
              <div style={{ background: '#fff', padding: 4, borderRadius: 6, lineHeight: 0, border: '1px solid var(--line)' }}>
                <QRCode url={reachUrl(link.code, 'print')} size={84} />
              </div>
              <div style={{ minWidth: 0, fontSize: '.74rem', color: 'var(--ink-muted)' }}>
                <div>QR pro tisk (letáky, plakáty) — počítá se jako „Tisk“. Na TV a grafikách se QR doplní samo.</div>
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" style={{ paddingLeft: 0 }}
                  onClick={async () => showToast(await copyText(reachUrl(link.code, 'print')) ? 'Odkaz zkopírován' : 'Nepodařilo se zkopírovat')}>
                  <Copy size={13} />{tvUrl.replace(/\?s=tv$/, '')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
