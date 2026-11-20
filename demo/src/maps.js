// Loads the Maps JavaScript API with the visitor's own key. The key is kept in this browser's localStorage
// and only ever sent to Google.
const storageKey = 'google-places-autocomplete-hook-demo:key'

export const readKey = () => {
  try {
    return localStorage.getItem(storageKey) ?? ''
  } catch {
    return ''
  }
}

let sessionKey = ''
let loaded = false

// The Maps script can only be loaded once per page, so a new key means a reload.
export const saveKey = (key) => {
  try {
    if (key) localStorage.setItem(storageKey, key)
    else localStorage.removeItem(storageKey)
  } catch {
    // storage blocked: use the key until the page is closed
    sessionKey = key
    if (!loaded) return loadMaps()
  }
  location.reload()
}

const authListeners = new Set()
export let authFailed = false
export const onAuthFailure = (listener) => {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

// local development can take the key from demo/.env.local instead of the form
const devKey = import.meta.env.DEV ? (import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '') : ''

export function loadMaps() {
  const key = readKey() || sessionKey || devKey
  if (!key || loaded) return loaded
  loaded = true
  // Google calls this when it rejects the key (wrong restrictions or APIs)
  window.gm_authFailure = () => {
    authFailed = true
    authListeners.forEach((listener) => listener())
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async`
  script.async = true
  document.head.append(script)
  return true
}
