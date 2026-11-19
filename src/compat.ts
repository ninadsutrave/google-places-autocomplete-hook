// Same API as use-places-autocomplete 4.x, running on the Places API (New).
// Switch by changing the import to "google-places-autocomplete-hook/compat".
import { useEffect } from 'react'
import { AutocompleteRequest, LatLngLiteral, Place, PlacePrediction, StringRange, Suggestion, loadLibrary, loadPlaces } from './places'
import { usePlaces } from './usePlaces'

type LatLngLike = LatLngLiteral | { lat(): number; lng(): number }

/** use-places-autocomplete's requestOptions, converted to an AutocompleteRequest */
export interface RequestOptions {
  componentRestrictions?: { country: string | string[] }
  types?: string[]
  language?: string
  region?: string
  location?: LatLngLike
  radius?: number
  bounds?: unknown
  locationBias?: unknown
  locationRestriction?: unknown
  origin?: unknown
  offset?: number
  /** Ignored: sessions are handled for you */
  sessionToken?: unknown
}

export interface HookArgs {
  requestOptions?: RequestOptions
  debounce?: number
  defaultValue?: string
  initOnMount?: boolean
  /** Name of a global callback (as in the script's &callback=) that initialises the hook */
  callbackName?: string
  /** Ignored: the Places API (New) bills a session as one request, so there is nothing to cache */
  cache?: number | false
  cacheKey?: string
  /** Ignored: the hook uses window.google.maps */
  googleMaps?: unknown
}

export interface MatchedSubstring {
  offset: number
  length: number
}

/** Same shape as the legacy google.maps.places.AutocompletePrediction */
export interface AutocompletePrediction {
  description: string
  place_id: string
  types: string[]
  matched_substrings: MatchedSubstring[]
  structured_formatting: {
    main_text: string
    main_text_matched_substrings: MatchedSubstring[]
    secondary_text: string
  }
  terms: { offset: number; value: string }[]
  distance_meters?: number
}

export type Status = '' | 'OK' | 'ZERO_RESULTS' | 'UNKNOWN_ERROR'

export interface HookReturn {
  ready: boolean
  value: string
  suggestions: { loading: boolean; status: Status; data: AutocompletePrediction[] }
  setValue: (value: string, shouldFetchData?: boolean) => void
  clearSuggestions: () => void
  clearCache: () => void
  init: () => void
}

export const toAutocompleteRequest = (options: RequestOptions = {}): AutocompleteRequest => {
  const { componentRestrictions, types, location, radius, bounds, offset, sessionToken, ...rest } = options
  const request: AutocompleteRequest = { ...rest }
  if (componentRestrictions?.country) request.includedRegionCodes = ([] as string[]).concat(componentRestrictions.country)
  if (types) request.includedPrimaryTypes = types
  if (!request.locationBias && location && radius != null) request.locationBias = { center: location, radius }
  if (!request.locationBias && bounds) request.locationBias = bounds
  if (offset != null) request.inputOffset = offset
  return request
}

const toSubstrings = (ranges: StringRange[]): MatchedSubstring[] =>
  ranges.map((r) => ({ offset: r.startOffset, length: r.endOffset - r.startOffset }))

// the legacy API split the description on ", " into terms
const toTerms = (description: string) => {
  let offset = 0
  return description.split(', ').map((value) => {
    const term = { offset, value }
    offset += value.length + 2
    return term
  })
}

export const toAutocompletePrediction = (s: Suggestion): AutocompletePrediction => ({
  description: s.text,
  place_id: s.placeId,
  types: s.types,
  matched_substrings: toSubstrings(s.matches),
  structured_formatting: {
    main_text: s.mainText,
    main_text_matched_substrings: toSubstrings(s.mainTextMatches),
    secondary_text: s.secondaryText,
  },
  terms: toTerms(s.text),
  ...(s.distanceMeters != null ? { distance_meters: s.distanceMeters } : {}),
})

// suggestions on screen, so getDetails can end their session instead of starting a separate lookup
const recent = new Map<string, { suggestion: Suggestion; getPlace: (s: Suggestion, fields: string[]) => Promise<Place> }>()

export default function usePlacesAutocomplete({
  requestOptions,
  debounce = 200,
  defaultValue = '',
  initOnMount = true,
  callbackName,
}: HookArgs = {}): HookReturn {
  const places = usePlaces({ request: toAutocompleteRequest(requestOptions), debounce, defaultValue, initOnMount })
  const { suggestions, getPlace, init } = places

  // kept after the list is cleared, since the usual pattern is clearSuggestions() then getDetails()
  useEffect(() => {
    for (const suggestion of suggestions) {
      recent.delete(suggestion.placeId)
      recent.set(suggestion.placeId, { suggestion, getPlace })
    }
    while (recent.size > 50) recent.delete(recent.keys().next().value!)
  }, [suggestions, getPlace])

  useEffect(() => {
    if (!callbackName) return
    const w = window as unknown as Record<string, unknown>
    w[callbackName] = init
    return () => {
      if (w[callbackName] === init) delete w[callbackName]
    }
  }, [callbackName, init])

  const status: Status = { idle: '', ok: 'OK', 'zero-results': 'ZERO_RESULTS', error: 'UNKNOWN_ERROR' }[places.status] as Status

  return {
    ready: places.ready,
    value: places.value,
    suggestions: { loading: places.loading, status, data: suggestions.map(toAutocompletePrediction) },
    setValue: places.setValue,
    clearSuggestions: places.clearSuggestions,
    clearCache: () => {},
    init,
  }
}

// legacy PlaceResult field -> Places API (New) Place field
const fieldNames: Record<string, string> = {
  place_id: 'id',
  name: 'displayName',
  formatted_address: 'formattedAddress',
  geometry: 'location',
  address_components: 'addressComponents',
  types: 'types',
  url: 'googleMapsURI',
  website: 'websiteURI',
  international_phone_number: 'internationalPhoneNumber',
  formatted_phone_number: 'nationalPhoneNumber',
  rating: 'rating',
  user_ratings_total: 'userRatingCount',
  utc_offset_minutes: 'utcOffsetMinutes',
  business_status: 'businessStatus',
}

export interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

/** The legacy PlaceResult fields this package can fill in */
export interface PlaceResult {
  place_id?: string
  name?: string
  formatted_address?: string
  geometry?: { location: LatLngLike; viewport?: unknown }
  address_components?: AddressComponent[]
  types?: string[]
  url?: string
  website?: string
  international_phone_number?: string
  formatted_phone_number?: string
  rating?: number
  user_ratings_total?: number
  utc_offset_minutes?: number
  business_status?: string
  [field: string]: unknown
}

const toPlaceResult = (place: Place, fields: string[]): PlaceResult => {
  const result: PlaceResult = {}
  for (const field of fields) {
    const name = fieldNames[field] ?? field
    const value = place[name]
    if (value === undefined) continue
    if (field === 'geometry') result.geometry = { location: value as LatLngLike, ...(place.viewport ? { viewport: place.viewport } : {}) }
    else if (field === 'address_components')
      result.address_components = (value as { longText: string; shortText: string; types: string[] }[]).map((c) => ({
        long_name: c.longText,
        short_name: c.shortText,
        types: c.types,
      }))
    else result[field] = value
  }
  return result
}

// legacy getDetails returned every field (and billed for all of them); default to fields in the cheapest tier
const basicFields = ['place_id', 'formatted_address', 'geometry', 'address_components']

export const getDetails = async ({
  placeId,
  fields = basicFields,
  language,
}: {
  placeId: string
  fields?: string[]
  language?: string
}): Promise<PlaceResult> => {
  const newFields = fields.map((f) => fieldNames[f] ?? f)
  if (newFields.includes('location')) newFields.push('viewport')
  const shown = recent.get(placeId)
  let place: Place
  if (shown) {
    place = await shown.getPlace(shown.suggestion, newFields)
  } else {
    const { Place } = await loadPlaces()
    place = new Place({ id: placeId, ...(language ? { requestedLanguage: language } : {}) })
    await place.fetchFields({ fields: newFields })
  }
  return toPlaceResult(place, fields)
}

interface GeocoderResult {
  geometry: { location: LatLngLike }
  address_components: AddressComponent[]
  [field: string]: unknown
}

/** Geocoder lookup (the Geocoding API is not legacy, so this is a thin wrapper) */
export const getGeocode = async (request: Record<string, unknown>): Promise<GeocoderResult[]> => {
  const { Geocoder } = await loadLibrary<{ Geocoder: new () => { geocode(r: unknown): Promise<{ results: GeocoderResult[] }> } }>(
    'geocoding',
  )
  const { results } = await new Geocoder().geocode(request)
  return results
}

const value = (v: number | (() => number)) => (typeof v === 'function' ? v() : v)

export const getLatLng = (result: { geometry?: { location: LatLngLike } }): LatLngLiteral => {
  const location = result.geometry?.location as { lat: number | (() => number); lng: number | (() => number) } | undefined
  if (!location) throw new Error('google-places-autocomplete-hook: the result has no geometry; request the "geometry" field')
  return { lat: value(location.lat), lng: value(location.lng) }
}

export const getZipCode = (result: { address_components?: AddressComponent[] }, useShortName = false): string | undefined => {
  const component = result.address_components?.find((c) => c.types.includes('postal_code'))
  return component && (useShortName ? component.short_name : component.long_name)
}

export type { PlacePrediction }
