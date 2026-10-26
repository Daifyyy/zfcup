import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface Props {
  /** Ikona. Řetězec (dříve emoji) se ignoruje a nahradí se neutrální ikonou. */
  icon?: ReactNode | string
  text: string
}

export default function Empty({ icon, text }: Props) {
  const iconNode = typeof icon === 'string' || icon == null ? <Inbox size={28} strokeWidth={1.5} /> : icon
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon">{iconNode}</div>
      <div className="ui-empty__text">{text}</div>
    </div>
  )
}
