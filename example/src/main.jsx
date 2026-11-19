import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlaceSearch } from './PlaceSearch'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PlaceSearch />
  </StrictMode>,
)
