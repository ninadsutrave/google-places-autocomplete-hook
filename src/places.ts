// The parts of the Maps JavaScript API "places" library (Places API (New)) this package uses.
// Declared here so users don't need @types/google.maps.

export interface StringRange {
  startOffset: number
  endOffset: number
}

export interface FormattableText {
  text: string
  matches: StringRange[]
}

export interface LatLng {
  lat(): number
  lng(): number
}

export interface LatLngBounds {
  getNorthEast(): LatLng
  getSouthWest(): LatLng
  toJSON(): { north: number; south: number; east: number; west: number }
}

export interface AddressComponent {
  longText: string | null
  shortText: string | null
  types: string[]
}

/**
 * A google.maps.places.Place. Fields are undefined until fetched, and null when Google has no value.
 * Fields beyond these are present as well; ask for them in fetchFields and read them through the index signature.
 */
export interface Place {
  id: string
  displayName?: string | null
  formattedAddress?: string | null
  adrFormatAddress?: string | null
  location?: LatLng | null
  viewport?: LatLngBounds | null
  addressComponents?: AddressComponent[] | null
  types?: string[] | null
  primaryType?: string | null
  googleMapsURI?: string | null
  websiteURI?: string | null
  nationalPhoneNumber?: string | null
  internationalPhoneNumber?: string | null
  rating?: number | null
  userRatingCount?: number | null
  priceLevel?: string | null
  businessStatus?: string | null
  utcOffsetMinutes?: number | null
  fetchFields(options: { fields: string[] }): Promise<{ place: Place }>
  [field: string]: unknown
}

export interface PlacePrediction {
  placeId: string
  text: FormattableText
  mainText?: FormattableText | null
  secondaryText?: FormattableText | null
  types: string[]
  distanceMeters?: number | null
  toPlace(): Place
}

export interface LatLngLiteral {
  lat: number
  lng: number
}

/** Options for AutocompleteSuggestion.fetchAutocompleteSuggestions, without input and sessionToken. */
export interface AutocompleteRequest {
  includedPrimaryTypes?: string[]
  includedRegionCodes?: string[]
  language?: string
  region?: string
  locationBias?: unknown
  locationRestriction?: unknown
  origin?: LatLngLiteral | unknown
  inputOffset?: number
  [option: string]: unknown
}

export interface PlacesLibrary {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(
      request: AutocompleteRequest & { input: string; sessionToken?: unknown },
    ): Promise<{ suggestions: { placePrediction?: PlacePrediction | null }[] }>
  }
  AutocompleteSessionToken: new () => unknown
  Place: new (options: { id: string; requestedLanguage?: string }) => Place
}

/** A place suggestion, flattened from Google's PlacePrediction. */
export interface Suggestion {
  placeId: string
  /** Full text, e.g. "Pune, Maharashtra, India" */
  text: string
  /** Ranges of `text` that match the input */
  matches: StringRange[]
  /** e.g. "Pune" */
  mainText: string
  mainTextMatches: StringRange[]
  /** e.g. "Maharashtra, India" */
  secondaryText: string
  types: string[]
  distanceMeters?: number
  /** The original PlacePrediction from Google */
  prediction: PlacePrediction
}

/** The part of window.google.maps this package uses */
interface MapsGlobal {
  importLibrary?: (name: string) => Promise<unknown>
}

const getMaps = (): MapsGlobal | undefined =>
  typeof window === 'undefined' ? undefined : (window as { google?: { maps?: MapsGlobal } }).google?.maps

const notLoaded = () => new Error('google-places-autocomplete-hook: the Google Maps JavaScript API is not loaded')

/** True once the Maps JavaScript API script has loaded. */
export const isLoaded = (): boolean => typeof getMaps()?.importLibrary === 'function'

export const loadLibrary = <T>(name: string): Promise<T> => {
  const importLibrary = getMaps()?.importLibrary
  return importLibrary ? (importLibrary(name) as Promise<T>) : Promise.reject(notLoaded())
}

let places: Promise<PlacesLibrary> | undefined

export const loadPlaces = (): Promise<PlacesLibrary> => {
  if (!isLoaded()) return Promise.reject(notLoaded())
  if (!places) {
    // forget a failed load so the next call can try again
    places = loadLibrary<PlacesLibrary>('places').catch((error: unknown) => {
      places = undefined
      throw error
    })
  }
  return places
}

export const toSuggestion = (prediction: PlacePrediction): Suggestion => ({
  placeId: prediction.placeId,
  text: prediction.text.text,
  matches: prediction.text.matches ?? [],
  mainText: prediction.mainText?.text ?? prediction.text.text,
  mainTextMatches: prediction.mainText?.matches ?? [],
  secondaryText: prediction.secondaryText?.text ?? '',
  types: prediction.types ?? [],
  distanceMeters: prediction.distanceMeters ?? undefined,
  prediction,
})

/**
 * One autocomplete session: the requests made while typing share a token, and the details call that ends the session
 * carries it too (a prediction's toPlace() keeps the token it was fetched with). A new search gets a new session.
 */
export const createSession = () => {
  let token: unknown
  return {
    token: (library: PlacesLibrary) => (token ??= new library.AutocompleteSessionToken()),
  }
}

export type Session = ReturnType<typeof createSession>

/** The session each prediction was fetched in */
export const sessionOf = new WeakMap<PlacePrediction, Session>()
