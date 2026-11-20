import { useState } from 'react'
import usePlacesAutocomplete, { getDetails, getLatLng, getZipCode } from 'google-places-autocomplete-hook/compat'

// The same search written against use-places-autocomplete's API; only the import differs.
export function CompatDemo({ disabled }) {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete()
  const [result, setResult] = useState(null)

  const select = async ({ place_id, description }) => {
    setValue(description, false)
    clearSuggestions()
    const details = await getDetails({ placeId: place_id, fields: ['formatted_address', 'geometry', 'address_components'] })
    setResult({ address: details.formatted_address, ...getLatLng(details), zip: getZipCode(details) })
  }

  return (
    <div className="search">
      <label htmlFor="compat-input">Search a place</label>
      <input
        id="compat-input"
        value={value}
        disabled={disabled || !ready}
        placeholder={disabled ? 'Add your key above first' : ready ? 'Start typing…' : 'Loading Google Maps…'}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
      {status === 'OK' && (
        <ul role="listbox">
          {data.map((s) => (
            <li key={s.place_id} role="option" aria-selected={false} onClick={() => select(s)}>
              <strong>{s.structured_formatting.main_text}</strong> <span>{s.structured_formatting.secondary_text}</span>
            </li>
          ))}
        </ul>
      )}
      {status === 'ZERO_RESULTS' && <p className="status">No places found.</p>}
      {status === 'UNKNOWN_ERROR' && <p className="status error">The request failed. The browser console has the details.</p>}
      {result && (
        <dl className="result">
          <dt>formatted_address</dt>
          <dd>{result.address}</dd>
          <dt>getLatLng</dt>
          <dd>
            {result.lat.toFixed(5)}, {result.lng.toFixed(5)}
          </dd>
          <dt>getZipCode</dt>
          <dd>{result.zip ?? 'none'}</dd>
        </dl>
      )}
    </div>
  )
}
