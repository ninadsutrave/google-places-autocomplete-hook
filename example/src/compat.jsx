// The same search written against use-places-autocomplete's API; only the import changed.
import './loadMaps'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import usePlacesAutocomplete, { getDetails, getLatLng } from 'google-places-autocomplete-hook/compat'
import { Frame } from './Frame'

function LegacySearch() {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({ debounce: 250 })
  const [result, setResult] = useState(null)

  const select = async ({ place_id, description }) => {
    setValue(description, false)
    clearSuggestions()
    const details = await getDetails({ placeId: place_id, fields: ['formatted_address', 'geometry'] })
    setResult({ address: details.formatted_address, ...getLatLng(details) })
  }

  return (
    <section className="search">
      <label htmlFor="place">Search a place (compat)</label>
      <input id="place" value={value} disabled={!ready} onChange={(e) => setValue(e.target.value)} />
      {status === 'OK' && (
        <ul role="listbox">
          {data.map((s) => (
            <li key={s.place_id} role="option" aria-selected={false} onClick={() => select(s)}>
              <strong>{s.structured_formatting.main_text}</strong> <small>{s.structured_formatting.secondary_text}</small>
            </li>
          ))}
        </ul>
      )}
      {result && (
        <p id="result">
          {result.address} ({result.lat}, {result.lng})
        </p>
      )}
    </section>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Frame page="compat">
      <LegacySearch />
    </Frame>
  </StrictMode>,
)
