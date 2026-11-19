// Loads the Maps JavaScript API with the key from .env.local (VITE_GOOGLE_MAPS_KEY).
// It loads async, after React has rendered, which the hook handles.
const key = import.meta.env.VITE_GOOGLE_MAPS_KEY

if (key) {
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async`
  script.async = true
  document.head.append(script)
} else {
  console.warn('Set VITE_GOOGLE_MAPS_KEY in example/.env.local to load Google Maps')
}
