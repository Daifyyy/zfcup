import type { MouseEvent } from 'react'
import { BRAND, contactHref } from '../../lib/brand'
import { LEGAL_DOCS, OPERATOR, legalPath, type LegalDoc } from '../../lib/legal'

const contact = contactHref()

/** Přechod na právní stránku bez znovunačtení (App poslouchá popstate). */
export function goToLegal(doc: LegalDoc, e?: MouseEvent) {
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) return // nová karta apod.
  e?.preventDefault()
  window.history.pushState({}, '', legalPath(doc))
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  window.scrollTo(0, 0)
}

export function copyrightLine(): string {
  return `© ${new Date().getFullYear()} ${OPERATOR.name.trim() || BRAND.name}. Všechna práva vyhrazena.`
}

/**
 * Patička s © a odkazy na právní dokumenty.
 * `dark` = celošířková tmavá lišta (úvodní stránka, soutěž, klub, právní stránky),
 * `inline` = nenápadný řádek pod obsahem turnaje.
 */
export default function SiteFooter({ variant = 'dark' }: { variant?: 'dark' | 'inline' }) {
  const links = (
    <nav className="site-foot__links" aria-label="Právní informace">
      {LEGAL_DOCS.map(d => (
        <a key={d.id} href={legalPath(d.id)} onClick={e => goToLegal(d.id, e)}>{d.short}</a>
      ))}
      {contact && <a href={contact}>Kontakt</a>}
    </nav>
  )

  if (variant === 'inline') {
    return (
      <footer className="site-foot site-foot--inline">
        <span>{copyrightLine()}{OPERATOR.name.trim() ? ` Provozováno na platformě ${BRAND.name}.` : ''}</span>
        {links}
      </footer>
    )
  }

  return (
    <footer className="lp-footer">
      <div className="lp-wrap site-foot">
        <div className="lp-footer__inner">
          <span className="lp-brand__name" style={{ fontSize: '1.1rem' }}>{BRAND.name}</span>
          <span>{BRAND.tagline}</span>
        </div>
        <div className="site-foot__bottom">
          <span>{copyrightLine()}</span>
          {links}
        </div>
      </div>
    </footer>
  )
}
