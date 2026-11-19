# placeahead

[![npm](https://img.shields.io/npm/v/placeahead)](https://www.npmjs.com/package/placeahead)
[![ci](https://github.com/ninadsutrave/placeahead/actions/workflows/ci.yml/badge.svg)](https://github.com/ninadsutrave/placeahead/actions/workflows/ci.yml)
[![size](https://img.shields.io/bundlejs/size/placeahead)](https://bundlejs.com/?q=placeahead)
[![license](https://img.shields.io/npm/l/placeahead)](LICENSE)

A small React hook for Google Places Autocomplete on the **Places API (New)**.

Google moved the old Places API and `AutocompleteService` to legacy status on 1 March 2025. Popular hooks such as `use-places-autocomplete` still use it. This package uses the new `AutocompleteSuggestion` API instead. It keeps one session token per search, so typing and the final details request are billed as one session. It also includes a [drop-in mode](#migrating-from-use-places-autocomplete) for `use-places-autocomplete`.

- Headless: bring your own input and list
- Session tokens handled for you
- Debounced, ignores out-of-order responses, safe to unmount mid-request
- TypeScript types without needing `@types/google.maps`
- React 16.8 to 19, works with server rendering, no dependencies

## Install

```sh
npm install placeahead
```

Enable **Places API (New)** for your key in Google Cloud, then load the Maps JavaScript API:

```html
<script async src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&loading=async"></script>
```

Any loader that defines `google.maps.importLibrary` works too. The hook loads the `places` library itself.

## Usage

```jsx
import { usePlaces } from 'placeahead'

export function PlaceSearch() {
  const { ready, value, setValue, suggestions, status, clearSuggestions, getPlace } = usePlaces({
    request: { includedRegionCodes: ['in'] },
  })

  const select = async (suggestion) => {
    setValue(suggestion.text, false)
    clearSuggestions()
    const place = await getPlace(suggestion, ['formattedAddress', 'location'])
    console.log(place.formattedAddress, place.location.lat(), place.location.lng())
  }

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} disabled={!ready} placeholder="Search a place" />
      {status === 'ok' && (
        <ul>
          {suggestions.map((s) => (
            <li key={s.placeId} onClick={() => select(s)}>
              <strong>{s.mainText}</strong> <small>{s.secondaryText}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Options

| Option         | Default |                                                                                                                                                                                                                                                                               |
| :------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request`      |         | Sent with every request: `includedRegionCodes`, `includedPrimaryTypes`, `language`, `region`, `locationBias`, `locationRestriction`, `origin`, ... ([reference](https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data#AutocompleteRequest)) |
| `debounce`     | `200`   | Milliseconds to wait after typing                                                                                                                                                                                                                                             |
| `minLength`    | `1`     | Shortest input that fetches suggestions                                                                                                                                                                                                                                       |
| `defaultValue` | `''`    |                                                                                                                                                                                                                                                                               |
| `initOnMount`  | `true`  | Load the places library on mount                                                                                                                                                                                                                                              |

### Returns

|                                                |                                                                                                             |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| `ready`                                        | The places library has loaded                                                                               |
| `value`, `setValue(value, shouldFetch = true)` | The input value. Pass `false` to set it without fetching, for example after a selection                     |
| `suggestions`                                  | `{ placeId, text, mainText, secondaryText, matches, mainTextMatches, types, distanceMeters, prediction }[]` |
| `status`                                       | `'idle'`, `'ok'`, `'zero-results'` or `'error'`                                                             |
| `loading`, `error`                             |                                                                                                             |
| `clearSuggestions()`                           | Empty the list and ignore any request in flight                                                             |
| `getPlace(suggestion, fields?)`                | Fetch place details and end the session. Default fields: `id`, `formattedAddress`, `location`               |
| `init()`                                       | Load the library, if the Maps script loads after the component mounts                                       |

## Sessions and billing

Every request while the user types shares one session token. `getPlace` fetches the details with that session and then starts a new one for the next search. Google bills a session that ends in a details request as one session, not one charge per keystroke.

If a search ends without `getPlace`, for example when the user picks a suggestion and you only need its text, the session is never concluded. Google then bills those requests individually. Ask only for the fields you need, because the most expensive field decides the price of the details request. `formattedAddress`, `location`, `viewport`, `addressComponents` and `types` are in Google's cheapest tier, Essentials. `displayName` is in the Pro tier, and phone numbers, websites and ratings are in Enterprise ([field list](https://developers.google.com/maps/documentation/javascript/place-class-data-fields)).

## Migrating from use-places-autocomplete

Change the import:

```diff
- import usePlacesAutocomplete, { getDetails, getGeocode, getLatLng, getZipCode } from 'use-places-autocomplete'
+ import usePlacesAutocomplete, { getDetails, getGeocode, getLatLng, getZipCode } from 'placeahead/compat'
```

The hook returns the same `{ ready, value, suggestions: { loading, status, data }, setValue, clearSuggestions, clearCache, init }`. Each item in `data` has the legacy prediction shape: `description`, `place_id`, `structured_formatting`, `matched_substrings`, `terms` and `types`.

Differences:

- **`requestOptions`** is converted: `componentRestrictions.country` becomes `includedRegionCodes`, `types` becomes `includedPrimaryTypes`, and `location` with `radius` or `bounds` becomes `locationBias`. Google's new API accepts a different list of types, so check yours ([supported types](https://developers.google.com/maps/documentation/places/web-service/place-types)).
- **`getDetails`** asks for `place_id`, `formatted_address`, `geometry` and `address_components` unless you pass `fields`, all in Google's cheapest tier. Add `name` if you need it (Pro tier). The old version asked for every field and was billed for all of them. Called with a suggestion from the hook, it also ends that session.
- **`getGeocode`** still works, but it doesn't end the autocomplete session. Use `getDetails` with `geometry` and `getLatLng` if you only need coordinates.
- **`cache`, `cacheKey` and `googleMaps`** are accepted and ignored.
- **`status`** is one of `''`, `'OK'`, `'ZERO_RESULTS'` or `'UNKNOWN_ERROR'`.

## Example

[`example/`](example) has an accessible search box with keyboard navigation, built with `usePlaces`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [code of conduct](CODE_OF_CONDUCT.md), and report security issues as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
