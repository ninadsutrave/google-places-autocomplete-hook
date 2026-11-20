import { useState } from 'react'
import { usePlaces } from 'google-places-autocomplete-hook'

const fields = ['formattedAddress', 'location', 'addressComponents']

// An accessible combobox on usePlaces: arrow keys move, Enter picks, Escape closes.
export function HookDemo({ disabled }) {
  const { ready, value, setValue, suggestions, status, loading, error, clearSuggestions, getPlace } = usePlaces()
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState(null)
  const open = status === 'ok' && suggestions.length > 0

  const select = async (s) => {
    setValue(s.text, false)
    clearSuggestions()
    setActive(-1)
    const result = await getPlace(s, fields)
    setPlace({
      name: s.mainText,
      address: result.formattedAddress,
      lat: result.location.lat(),
      lng: result.location.lng(),
      postalCode: result.addressComponents?.find((c) => c.types.includes('postal_code'))?.longText,
    })
  }

  const onKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') setActive((i) => (i + 1) % suggestions.length)
    else if (e.key === 'ArrowUp') setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    else if (e.key === 'Enter' && active >= 0) select(suggestions[active])
    else if (e.key === 'Escape') clearSuggestions()
    else return
    e.preventDefault()
  }

  return (
    <div className="search">
      <label htmlFor="hook-input">Search a place</label>
      <input
        id="hook-input"
        role="combobox"
        aria-expanded={open}
        aria-controls="hook-list"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `hook-option-${active}` : undefined}
        value={value}
        disabled={disabled || !ready}
        placeholder={disabled ? 'Add your key above first' : ready ? 'Start typing…' : 'Loading Google Maps…'}
        onChange={(e) => {
          setValue(e.target.value)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && (
        <ul id="hook-list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`hook-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(s)}
            >
              <strong>{s.mainText}</strong> <span>{s.secondaryText}</span>
            </li>
          ))}
        </ul>
      )}
      {loading && <p className="status">Searching…</p>}
      {status === 'zero-results' && <p className="status">No places found.</p>}
      {status === 'error' && <p className="status error">{error?.message ?? 'The request failed.'}</p>}
      {place && (
        <dl className="result">
          <dt>Place</dt>
          <dd>{place.name}</dd>
          <dt>Address</dt>
          <dd>{place.address}</dd>
          <dt>Location</dt>
          <dd>
            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
          </dd>
          {place.postalCode && (
            <>
              <dt>Postal code</dt>
              <dd>{place.postalCode}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
