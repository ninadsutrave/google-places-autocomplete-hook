import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadMaps } from './maps'
import { watchPlaces } from './requestLog'
import { App } from './App'

const hasKey = loadMaps()

// once the Maps script is up, start logging the requests the hook makes
if (hasKey) {
  const wait = setInterval(() => {
    if (!window.google?.maps?.importLibrary) return
    clearInterval(wait)
    watchPlaces().catch((error) => console.warn('Request log unavailable:', error))
  }, 50)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App hasKey={hasKey} />
  </StrictMode>,
)
