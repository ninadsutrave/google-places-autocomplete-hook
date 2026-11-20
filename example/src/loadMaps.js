// Loads the Maps JavaScript API with the key from .env.local (VITE_GOOGLE_MAPS_KEY).
// It loads async, after React has rendered, which the hook handles.
// Without a key, a stand-in answers from a short built-in list; that's what the hosted demo runs on.
import { installDemoMaps } from './demoMaps'

const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
export const isDemo = !key

if (key) {
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async`
  script.async = true
  document.head.append(script)
} else {
  installDemoMaps()
}
