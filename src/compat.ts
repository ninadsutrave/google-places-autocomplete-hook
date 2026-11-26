// Same API as use-places-autocomplete 4.x, running on the Places API (New).
// Switch by changing the import to "google-places-autocomplete-hook/compat".
import { useEffect, useMemo, useState } from 'react'
import {
  AddressComponent as PlaceAddressComponent,
  AutocompleteRequest,
  LatLngLiteral,
  Place,
  PlacePrediction,
  StringRange,
  Suggestion as PlaceSuggestion,
  loadLibrary,
  loadPlaces,
} from './places'
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
  /** Places API (New) names, passed on as they are */
  includedPrimaryTypes?: string[]
  includedRegionCodes?: string[]
  inputOffset?: number
  /** Ignored, as the legacy API ignored keys it didn't know */
  [option: string]: unknown
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

/** The legacy PlacesServiceStatus values, or '' before the first request. This package only produces the first four. */
export type Status = '' | 'OK' | 'ZERO_RESULTS' | 'UNKNOWN_ERROR' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED'

/** One item of suggestions.data, under the name use-places-autocomplete used */
export type Suggestion = AutocompletePrediction

export interface Suggestions {
  readonly loading: boolean
  readonly status: Status
  data: Suggestion[]
}

export type SetValue = (value: string, shouldFetchData?: boolean) => void
export type ClearSuggestions = () => void
export type ClearCache = (key?: string) => void
export type Init = () => void

export interface HookReturn {
  ready: boolean
  value: string
  suggestions: Suggestions
  setValue: SetValue
  clearSuggestions: ClearSuggestions
  clearCache: ClearCache
  init: Init
}

// the legacy "address" type is the street-level types; "geocode" and "establishment" have no equivalent, so no filter applies
const addressTypes = ['street_address', 'premise', 'subpremise', 'route']

const primaryTypes = (types: string[]) => {
  if (types.some((t) => t === 'geocode' || t === 'establishment')) return undefined
  return [...new Set(types.flatMap((t) => (t === 'address' ? addressTypes : [t])))].slice(0, 5)
}

// the legacy API ignored keys it didn't know; AutocompleteSuggestion throws on them, so only these are passed on
const passedThrough = [
  'language',
  'region',
  'locationBias',
  'locationRestriction',
  'origin',
  'includedPrimaryTypes',
  'includedRegionCodes',
  'inputOffset',
] as const

export const toAutocompleteRequest = (options: RequestOptions = {}): AutocompleteRequest => {
  const { componentRestrictions, types, location, radius, bounds, offset } = options
  const request: AutocompleteRequest = {}
  for (const key of passedThrough) if (options[key] !== undefined) (request as Record<string, unknown>)[key] = options[key]
  if (componentRestrictions?.country) request.includedRegionCodes = ([] as string[]).concat(componentRestrictions.country)
  if (types?.length) {
    const primary = primaryTypes(types)
    if (primary) request.includedPrimaryTypes = primary
  }
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

export const toAutocompletePrediction = (s: PlaceSuggestion): AutocompletePrediction => ({
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

// Suggestions on screen, so getDetails(placeId) can fetch through the prediction (which carries its session token)
// instead of starting a separate lookup. Each hook keeps the entries of its latest non-empty list, kept after the list
// is cleared since the usual pattern is clearSuggestions() then getDetails(); they go when a new search shows results
// or the hook unmounts. An entry is used once, and getPlace only ends the session the suggestion came from.
interface Shown {
  owner: symbol
  suggestion: PlaceSuggestion
  getPlace: (s: PlaceSuggestion, fields: string[]) => Promise<Place>
}
const recent = new Map<string, Shown[]>()

const forget = (owner: symbol) => {
  for (const [id, list] of recent) {
    const kept = list.filter((s) => s.owner !== owner)
    if (kept.length) recent.set(id, kept)
    else recent.delete(id)
  }
}

const remember = (shown: Shown) => {
  const id = shown.suggestion.placeId
  recent.set(id, [...(recent.get(id) ?? []), shown])
}

/** The newest entry for a place, removed from the list */
const takeShown = (id: string): Shown | undefined => {
  const list = recent.get(id)
  if (!list?.length) return undefined
  const shown = list.pop()!
  if (list.length) recent.set(id, list)
  else recent.delete(id)
  return shown
}

export default function usePlacesAutocomplete({
  requestOptions,
  debounce = 200,
  defaultValue = '',
  initOnMount = true,
  callbackName,
}: HookArgs = {}): HookReturn {
  const places = usePlaces({ request: toAutocompleteRequest(requestOptions), debounce, defaultValue, initOnMount })
  const { suggestions, getPlace, init } = places
  const [owner] = useState(() => Symbol('usePlacesAutocomplete'))

  useEffect(() => {
    if (!suggestions.length) return
    forget(owner)
    for (const suggestion of suggestions) remember({ owner, suggestion, getPlace })
  }, [owner, suggestions, getPlace])

  useEffect(() => () => forget(owner), [owner])

  useEffect(() => {
    if (!callbackName) return
    const w = window as unknown as Record<string, unknown>
    w[callbackName] = init
    return () => {
      if (w[callbackName] === init) delete w[callbackName]
    }
  }, [callbackName, init])

  const status: Status = { idle: '', ok: 'OK', 'zero-results': 'ZERO_RESULTS', error: 'UNKNOWN_ERROR' }[places.status] as Status
  const data = useMemo(() => suggestions.map(toAutocompletePrediction), [suggestions])

  return {
    ready: places.ready,
    value: places.value,
    suggestions: { loading: places.loading, status, data },
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
  adr_address: 'adrFormatAddress',
  geometry: 'location',
  address_components: 'addressComponents',
  types: 'types',
  url: 'googleMapsURI',
  website: 'websiteURI',
  international_phone_number: 'internationalPhoneNumber',
  formatted_phone_number: 'nationalPhoneNumber',
  rating: 'rating',
  user_ratings_total: 'userRatingCount',
  utc_offset: 'utcOffsetMinutes',
  utc_offset_minutes: 'utcOffsetMinutes',
  business_status: 'businessStatus',
  price_level: 'priceLevel',
  opening_hours: 'regularOpeningHours',
  secondary_opening_hours: 'regularSecondaryOpeningHours',
  photo: 'photos',
  photos: 'photos',
  review: 'reviews',
  reviews: 'reviews',
  plus_code: 'plusCode',
  icon: 'svgIconMaskURI',
  icon_mask_base_uri: 'svgIconMaskURI',
  icon_background_color: 'iconBackgroundColor',
  editorial_summary: 'editorialSummary',
  wheelchair_accessible_entrance: 'accessibilityOptions',
}

export interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

export type LatLng = LatLngLiteral
/** @deprecated The 1.x name; use `LatLng` */
export type LatLon = LatLng
export type ZipCode = string | undefined

/** A google.maps.GeocoderResult, as far as this package types it */
export interface GeocodeResult {
  formatted_address: string
  place_id: string
  geometry: { location: LatLngLike; location_type?: string; viewport?: unknown; bounds?: unknown }
  address_components: AddressComponent[]
  types: string[]
  partial_match?: boolean
  plus_code?: { global_code: string; compound_code?: string }
  [field: string]: unknown
}
export type GeoArgs = Record<string, unknown>
export type GeoReturn = Promise<GeocodeResult[]>

export interface GetDetailsArgs {
  placeId: string
  fields?: string[]
  language?: string
  region?: string
  /** Ignored: a suggestion from the hook brings its own session */
  sessionToken?: unknown
}
export type DetailsResult = Promise<PlaceResult>

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
      result.address_components = (value as PlaceAddressComponent[]).map((c) => ({
        long_name: c.longText ?? '',
        short_name: c.shortText ?? '',
        types: c.types,
      }))
    else if (field === 'wheelchair_accessible_entrance')
      result.wheelchair_accessible_entrance = (value as { wheelchairAccessibleEntrance?: boolean } | null)?.wheelchairAccessibleEntrance
    else result[field] = value
  }
  return result
}

// legacy getDetails returned every field (and billed for all of them); default to fields in the cheapest tier
const basicFields = ['place_id', 'formatted_address', 'geometry', 'address_components']

export const getDetails = async ({ placeId, fields = basicFields, language }: GetDetailsArgs): DetailsResult => {
  const newFields = [...new Set(fields.map((f) => fieldNames[f] ?? f))]
  if (newFields.includes('location') && !newFields.includes('viewport')) newFields.push('viewport')
  // a place the hook suggested is fetched through its prediction, which ends the session it came from;
  // its language is the one the hook requested with
  const shown = takeShown(placeId)
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

/** Geocoder lookup (the Geocoding API is not legacy, so this is a thin wrapper) */
export const getGeocode = async (request: GeoArgs): GeoReturn => {
  const { Geocoder } = await loadLibrary<{ Geocoder: new () => { geocode(r: unknown): Promise<{ results: GeocodeResult[] }> } }>(
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

export const getZipCode = (result: { address_components?: AddressComponent[] }, useShortName = false): ZipCode => {
  const component = result.address_components?.find((c) => c.types.includes('postal_code'))
  return component && (useShortName ? component.short_name : component.long_name)
}

export type { PlacePrediction }
