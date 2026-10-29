import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import './styles/ui.css'
import './styles/layout.css'
import './styles/pages.css'
import './styles/landing.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ConfirmHost } from './components/ui/ConfirmDialog'

// iOS Safari přibližuje stránku při kliknutí do políčka (a sám ji neoddálí).
// maximum-scale=1 to vypne, ruční přiblížení dvěma prsty iOS ponechá (od iOS 10 ho nejde zakázat).
// Jen pro iOS — na Androidu by maximum-scale zakázalo i přiblížení prsty (přístupnost).
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
if (isIOS) {
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <ConfirmHost />
    </ErrorBoundary>
  </StrictMode>,
)
