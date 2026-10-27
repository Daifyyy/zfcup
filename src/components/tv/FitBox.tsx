// Přizpůsobení obsahu TV obrazovce: když se obsah nevejde na výšku, plynule zmenší
// písmo (CSS proměnná --tv-fit, kterou používají velikosti fit() z tvTheme.ts).
// Žádné useknuté řádky tabulky, ať je týmů kolik chce (v rozumných mezích, min. 50 %).
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const MIN = 0.5
const STEP = 0.04

export function FitBox({ children, watch, style }: { children: ReactNode; watch: unknown; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Změna velikosti obrazovky → začít znovu od 100 %
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => { setScale(1) }, [size.w, size.h, watch])

  // Po vykreslení: přetéká? → o krok menší
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.scrollHeight > el.clientHeight + 1 && scale > MIN) setScale(s => Math.max(MIN, +(s - STEP).toFixed(2)))
  })

  return (
    <div ref={ref} style={{ ...style, overflow: 'hidden', ['--tv-fit' as string]: scale } as CSSProperties}>
      {children}
    </div>
  )
}
