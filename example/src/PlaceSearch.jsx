import { useState } from 'react'
import { usePlaces } from 'placeahead'

// An accessible combobox: arrow keys move through suggestions, Enter picks one, Escape closes the list.
export function PlaceSearch() {
  const { ready, value, setValue, suggestions, status, loading, clearSuggestions, getPlace } = usePlaces({ debounce: 250 })
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState(null)
  const open = status === 'ok' && suggestions.length > 0

  const select = async (suggestion) => {
    setValue(suggestion.text, false)
    clearSuggestions()
    setActive(-1)
    // fields from Google's cheapest Place Details tier
    const result = await getPlace(suggestion, ['formattedAddress', 'location'])
    setPlace({
      name: suggestion.mainText,
      address: result.formattedAddress,
      lat: result.location.lat(),
      lng: result.location.lng(),
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
    <main style={{ maxWidth: 480, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <label htmlFor="place">Search a place</label>
      <input
        id="place"
        role="combobox"
        aria-expanded={open}
        aria-controls="place-list"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `place-${active}` : undefined}
        value={value}
        disabled={!ready}
        placeholder={ready ? 'Start typing…' : 'Loading Google Maps…'}
        onChange={(e) => {
          setValue(e.target.value)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8, marginTop: 4 }}
      />
      {open && (
        <ul id="place-list" role="listbox" style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid #ccc' }}>
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`place-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(s)}
              style={{ padding: 8, cursor: 'pointer', background: i === active ? '#eef' : undefined }}
            >
              <strong>{s.mainText}</strong> <small>{s.secondaryText}</small>
            </li>
          ))}
        </ul>
      )}
      {loading && <p aria-live="polite">Searching…</p>}
      {status === 'zero-results' && <p>No places found.</p>}
      {place && (
        <p id="result">
          {place.name}: {place.address} ({place.lat}, {place.lng})
        </p>
      )}
    </main>
  )
}
