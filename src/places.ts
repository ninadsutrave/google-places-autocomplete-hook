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

export interface Place {
  id: string
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

const getMaps = (): any => (typeof window === 'undefined' ? undefined : (window as any).google?.maps)

/** True once the Maps JavaScript API script has loaded. */
export const isLoaded = (): boolean => typeof getMaps()?.importLibrary === 'function'

let places: Promise<PlacesLibrary> | undefined

export const loadPlaces = (): Promise<PlacesLibrary> => {
  if (!isLoaded()) return Promise.reject(new Error('placeahead: the Google Maps JavaScript API is not loaded'))
  if (!places) {
    // forget a failed load so the next call can try again
    places = getMaps()
      .importLibrary('places')
      .catch((error: unknown) => {
        places = undefined
        throw error
      })
  }
  return places as Promise<PlacesLibrary>
}

export const loadLibrary = <T>(name: string): Promise<T> =>
  isLoaded() ? getMaps().importLibrary(name) : Promise.reject(new Error('placeahead: the Google Maps JavaScript API is not loaded'))

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
 * One autocomplete session. Google bills the requests made while typing as a single session
 * when they share a token and end with a details call, so the token is kept until then.
 */
export const createSession = () => {
  let token: unknown
  return {
    token: (library: PlacesLibrary) => (token ??= new library.AutocompleteSessionToken()),
    end: () => {
      token = undefined
    },
  }
}

export type Session = ReturnType<typeof createSession>
