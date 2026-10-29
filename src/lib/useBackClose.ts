import { useEffect, useRef } from 'react'

// Vrstva přes obrazovku (tabule, bulletin, sdílení, nabídka „Více“, potvrzení…) jako krok v historii:
// tlačítko/gesto Zpět (iPhone swipe, Android) zavře jen ji a nechá uživatele na stránce.
// Zavření tlačítkem v aplikaci krok v historii zase spotřebuje (history.back()).
//
// React StrictMode ve vývoji spouští efekt dvakrát (připojit → odpojit → připojit). Aby druhé
// připojení nevyrobilo nový krok a odložený back() nezavřel vrstvu, opakované připojení se stejným
// klíčem během jednoho tiku převezme existující krok (pendingBack).

const pendingBack = new Map<string, { marker: string; timer: ReturnType<typeof setTimeout> }>()
let seq = 0

export function useBackClose(open: boolean, onClose: () => void, key: string) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    let marker: string
    const pending = pendingBack.get(key)
    if (pending) {
      clearTimeout(pending.timer)
      pendingBack.delete(key)
      marker = pending.marker
    } else {
      marker = `${key}:${++seq}`
      window.history.pushState({ ...(window.history.state ?? {}), overlay: marker }, '')
    }

    let popped = false
    const onPop = (e: PopStateEvent) => {
      // Zpět z této vrstvy → stav už nenese její značku. (Zavření vnořené vrstvy vrátí značku této → zůstat.)
      if (e.state?.overlay !== marker) {
        popped = true
        closeRef.current()
      }
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      if (popped) return
      // Zavřeno v aplikaci → spotřebovat krok, ale jen pokud je pořád navrchu
      // (když mezitím akce přidala vlastní krok, např. přechod jinam, nesahat na něj).
      const timer = setTimeout(() => {
        pendingBack.delete(key)
        if (window.history.state?.overlay === marker) window.history.back()
      }, 0)
      pendingBack.set(key, { marker, timer })
    }
  }, [open, key])
}
