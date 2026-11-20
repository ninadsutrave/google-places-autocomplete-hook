import './loadMaps'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Frame } from './Frame'
import { PlaceSearch } from './PlaceSearch'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Frame page="hook">
      <PlaceSearch />
    </Frame>
  </StrictMode>,
)
