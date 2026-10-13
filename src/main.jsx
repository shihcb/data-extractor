import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MOTION, prefersReducedMotion } from './motion.js'

// The opening spinner (index.html, financial-dashboard's boot) goes once the
// app has drawn and its fonts are in: it fades out as the app fades in, on
// the shared curve. Never kept past 3s.
let booted = false
function bootDone() {
  if (booted) return
  booted = true
  const boot = document.getElementById('boot')
  const root = document.getElementById('root')
  const still = prefersReducedMotion()
  if (!still && boot?.animate) {
    boot.animate([{ opacity: 1 }, { opacity: 0 }], { ...MOTION, fill: 'forwards' })
    root.animate([{ opacity: 0 }, { opacity: 1 }], { ...MOTION, fill: 'backwards' })
  }
  setTimeout(() => boot?.remove(), still ? 0 : MOTION.duration + 50)
}

function Booted({ children }) {
  useEffect(() => {
    const fonts = document.fonts?.ready ?? Promise.resolve()
    fonts.then(() => requestAnimationFrame(bootDone), bootDone)
    const cap = setTimeout(bootDone, 3000)
    return () => clearTimeout(cap)
  }, [])
  return children
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Booted>
      <App />
    </Booted>
  </StrictMode>,
)

// Offline support for the installed app (public/sw.js is generated at build
// time with the list of files to keep). Dev builds skip it so a stale cache
// never hides code changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
