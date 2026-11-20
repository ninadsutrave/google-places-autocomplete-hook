# google-places-autocomplete-hook

[![npm](https://img.shields.io/npm/v/google-places-autocomplete-hook)](https://www.npmjs.com/package/google-places-autocomplete-hook)
[![ci](https://github.com/ninadsutrave/google-places-autocomplete-hook/actions/workflows/ci.yml/badge.svg)](https://github.com/ninadsutrave/google-places-autocomplete-hook/actions/workflows/ci.yml)
[![size](https://img.shields.io/bundlejs/size/google-places-autocomplete-hook)](https://bundlejs.com/?q=google-places-autocomplete-hook)
[![license](https://img.shields.io/npm/l/google-places-autocomplete-hook)](LICENSE)

A small React hook for Google Places Autocomplete on the **Places API (New)**.

Google moved the old Places API and `AutocompleteService` to legacy status on 1 March 2025. Since then the legacy API is hidden from new projects and left out of new API keys, and [Google says](https://developers.google.com/maps/documentation/javascript/legacy/places) that since October 2026 it can no longer be enabled for new Google Cloud projects. Popular hooks such as `use-places-autocomplete` still depend on it. This package uses the new `AutocompleteSuggestion` API instead. It keeps one session token per search, so typing and the final details request are billed as a session rather than request by request. It also includes a [drop-in mode](#migrating-from-use-places-autocomplete) for `use-places-autocomplete`.

If the browser console shows `LegacyApiNotActivatedMapError` ("You're calling a legacy API, which is not enabled for your project") or says `AutocompleteService` is not available to new customers, your code is calling the legacy Places API. This package calls the new one.

- Headless: bring your own input and list
- Session tokens handled for you
- Debounced, ignores out-of-order responses, safe to unmount mid-request
- TypeScript types without needing `@types/google.maps`
- React 16.8 to 19, works with server rendering, no dependencies

On the server, [google-maps-fetch](https://github.com/ninadsutrave/google-maps-fetch) is the companion package: a small client for Places, Routes, Geocoding and the other Maps web APIs, with a drop-in replacement for `@googlemaps/google-maps-services-js`.

## Install

```sh
npm install google-places-autocomplete-hook
```

Enable **Places API (New)** for your key in Google Cloud, then load the Maps JavaScript API:

```html
<script async src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&loading=async"></script>
```

Any loader that defines `google.maps.importLibrary` works too. The hook loads the `places` library itself.

## Usage

```jsx
import { usePlaces } from 'google-places-autocomplete-hook'

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

|                                                |                                                                                                                              |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `ready`                                        | The places library has loaded                                                                                                |
| `value`, `setValue(value, shouldFetch = true)` | The input value. Pass `false` to set it without fetching, for example after a selection; that also ends the search's session |
| `suggestions`                                  | `{ placeId, text, mainText, secondaryText, matches, mainTextMatches, types, distanceMeters, prediction }[]`                  |
| `status`                                       | `'idle'`, `'ok'`, `'zero-results'` or `'error'`                                                                              |
| `loading`, `error`                             |                                                                                                                              |
| `clearSuggestions()`                           | Empty the list and ignore any request in flight                                                                              |
| `getPlace(suggestion, fields?)`                | Fetch place details, ending the session the suggestion came from. Default fields: `id`, `formattedAddress`, `location`       |
| `init()`                                       | Load the library, if the Maps script loads after the component mounts                                                        |

## Sessions and billing

Every request while the user types shares one session token. A suggestion remembers the session it came from, so `getPlace` ends that session whenever you call it, and `setValue(text, false)` (a selection or a reset) closes the current search so the next keystroke starts a new one. You never handle tokens yourself.

What Google charges for a session depends on how it ends ([session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing)):

- **`getPlace` with Essentials fields only** (the default: `id`, `formattedAddress`, `location`; also `viewport`, `addressComponents`, `types`): the first 12 autocomplete requests in the session are billed per request, any beyond that are free, and the details request is billed at Essentials.
- **`getPlace` with any Pro or Enterprise field** (`displayName`, `rating`, phone numbers, website, ...): every autocomplete request is free, and the details request is billed at Enterprise + Atmosphere, whatever else you asked for.
- **No `getPlace`**, for example when you only need the suggestion's text or you geocode the address instead: every autocomplete request is billed per request.

So for a box that only needs an address and coordinates, the defaults are the cheapest option. If you need a display name or more, one details request at the top tier buys free autocomplete ([field tiers](https://developers.google.com/maps/documentation/javascript/place-class-data-fields)).

## Migrating from use-places-autocomplete

Change the import:

```diff
- import usePlacesAutocomplete, { getDetails, getGeocode, getLatLng, getZipCode } from 'use-places-autocomplete'
+ import usePlacesAutocomplete, { getDetails, getGeocode, getLatLng, getZipCode } from 'google-places-autocomplete-hook/compat'
```

The hook returns the same `{ ready, value, suggestions: { loading, status, data }, setValue, clearSuggestions, clearCache, init }`. Each item in `data` has the legacy prediction shape: `description`, `place_id`, `structured_formatting`, `matched_substrings`, `terms` and `types`.

Differences:

- **`requestOptions`** is converted: `componentRestrictions.country` becomes `includedRegionCodes`, `types` becomes `includedPrimaryTypes`, and `location` with `radius` or `bounds` becomes `locationBias`. Google's new API accepts a different list of types, so check yours ([supported types](https://developers.google.com/maps/documentation/places/web-service/place-types)).
- **`getDetails`** asks for `place_id`, `formatted_address`, `geometry` and `address_components` unless you pass `fields`, all in Google's cheapest tier. The old version asked for every field and was billed for all of them. Adding `name` or any other Pro or Enterprise field bills the details request at Enterprise + Atmosphere, which in return makes the session's autocomplete requests free (see [Sessions and billing](#sessions-and-billing)). For a place the hook suggested, the details are fetched through that suggestion, which ends its session; the `language` option then has no effect, since the suggestion already has the hook's language.
- **`getGeocode`** still works, but it doesn't end the autocomplete session, so those requests are billed one by one. Use `getDetails` with `geometry` and `getLatLng` if you only need coordinates.
- **`cache`, `cacheKey` and `googleMaps`** are accepted and ignored.
- **`status`** is one of `''`, `'OK'`, `'ZERO_RESULTS'` or `'UNKNOWN_ERROR'`; the type also allows the other legacy values so existing comparisons compile.
- **Coming from 1.x**: `getLatLng` and `getZipCode` return plain values, not Promises, so `await` them or use the result directly; `.then()` on them throws. `getZipCode` returns `undefined` rather than `null` when there is no postal code. The `LatLon` type is still exported.
- **`types`**: `address` becomes the street-level types; `geocode` and `establishment` have no equivalent in the new API, so no type filter is applied for them.

## Example

[`example/`](example) has an accessible search box with keyboard navigation, built with `usePlaces`, and the same search on `/compat`. It runs against Google with your own key; [example/README.md](example/README.md) has the steps.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [code of conduct](CODE_OF_CONDUCT.md), and report security issues as described in [SECURITY.md](SECURITY.md).

## Maintainer

Maintained by [Ninad Sutrave](https://ninadsutrave.com).

## License

[MIT](LICENSE)

This is an independent project, not affiliated with or endorsed by Google. Google Maps is a trademark of Google LLC.
