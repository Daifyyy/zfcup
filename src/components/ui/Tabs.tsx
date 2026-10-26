import type { ReactNode } from 'react'

export function Tabs<T extends string>({ items, value, onChange, variant = 'light', ariaLabel }: {
  items: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  variant?: 'light' | 'chrome'
  ariaLabel?: string
}) {
  return (
    <nav className={variant === 'chrome' ? 'ui-tabs ui-tabs--chrome' : 'ui-tabs'} aria-label={ariaLabel}>
      {items.map(it => (
        <button
          key={it.value}
          type="button"
          className={it.value === value ? 'ui-tab ui-tab--active' : 'ui-tab'}
          aria-current={it.value === value ? 'page' : undefined}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </nav>
  )
}

export function Segmented<T extends string>({ items, value, onChange }: {
  items: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="ui-seg" role="tablist">
      {items.map(it => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          className={it.value === value ? 'ui-seg__btn ui-seg__btn--active' : 'ui-seg__btn'}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
