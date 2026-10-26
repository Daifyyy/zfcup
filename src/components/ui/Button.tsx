import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'chrome'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'> {
  variant?: Variant
  size?: 'md' | 'sm'
  icon?: ReactNode
  iconOnly?: boolean
  block?: boolean
  /**
   * Náhrada za `disabled` (Android ignoruje touch eventy na disabled tlačítkách).
   * Tlačítko zešedne a klik se nepředá dál; toast řeší `onInactiveClick`.
   */
  inactive?: boolean
  onInactiveClick?: () => void
}

export function Button({
  variant = 'secondary', size = 'md', icon, iconOnly, block, inactive, onInactiveClick,
  className = '', children, onClick, ...rest
}: Props) {
  const cls = [
    'ui-btn', `ui-btn--${variant}`,
    size === 'sm' && 'ui-btn--sm',
    iconOnly && 'ui-btn--icon',
    block && 'ui-btn--block',
    inactive && 'ui-btn--inactive',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      aria-disabled={inactive || undefined}
      onClick={e => {
        if (inactive) { onInactiveClick?.(); return }
        onClick?.(e)
      }}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  )
}
