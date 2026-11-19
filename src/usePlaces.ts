import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AutocompleteRequest, Place, Session, Suggestion, createSession, isLoaded, loadPlaces, sessionOf, toSuggestion } from './places'

export interface UsePlacesOptions {
  /** Sent with every request, e.g. { includedRegionCodes: ['in'], language: 'en' } */
  request?: AutocompleteRequest
  /** Milliseconds to wait after typing before fetching. Default 200 */
  debounce?: number
  /** Shortest input that fetches suggestions. Default 1 */
  minLength?: number
  defaultValue?: string
  /** Load the places library on mount. Default true */
  initOnMount?: boolean
}

export type PlacesStatus = 'idle' | 'ok' | 'zero-results' | 'error'

export interface UsePlacesResult {
  /** The places library has loaded */
  ready: boolean
  value: string
  /** Update the input value, and fetch suggestions for it. With shouldFetch false, for example after a selection, the current session ends too */
  setValue: (value: string, shouldFetch?: boolean) => void
  suggestions: Suggestion[]
  status: PlacesStatus
  loading: boolean
  error: unknown
  clearSuggestions: () => void
  /** Fetch details for a suggestion (default fields: id, formattedAddress, location). This ends its session, so the next keystroke starts a new one. */
  getPlace: (suggestion: Suggestion, fields?: readonly string[]) => Promise<Place>
  /** Load the places library, for when the Maps script loads after mount */
  init: () => void
}

interface State {
  status: PlacesStatus
  suggestions: Suggestion[]
  loading: boolean
  error: unknown
}

const idle: State = { status: 'idle', suggestions: [], loading: false, error: undefined }

// useLayoutEffect warns during server rendering on React 17 and 18, where no effect runs anyway
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// all in Google's cheapest Place Details tier (Essentials); displayName and most other fields cost more
export const defaultFields: readonly string[] = Object.freeze(['id', 'formattedAddress', 'location'])

export function usePlaces({
  request,
  debounce = 200,
  minLength = 1,
  defaultValue = '',
  initOnMount = true,
}: UsePlacesOptions = {}): UsePlacesResult {
  const [ready, setReady] = useState(false)
  const [value, setValueState] = useState(defaultValue)
  const [state, setState] = useState<State>(idle)

  const session = useRef<Session | null>(null)
  if (session.current == null) session.current = createSession()
  // newest request id; responses for older ones are dropped
  const latest = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(false)
  // read the latest options at fetch time without re-creating callbacks; updated as soon as a render commits
  const options = useRef(request)
  useIsomorphicLayoutEffect(() => {
    options.current = request
  })

  const init = useCallback(() => {
    if (!isLoaded()) return
    loadPlaces().then(
      () => mounted.current && setReady(true),
      (error) => mounted.current && setState({ ...idle, status: 'error', error }),
    )
  }, [])

  useEffect(() => {
    mounted.current = true
    let poll: ReturnType<typeof setInterval> | undefined
    if (initOnMount) {
      if (isLoaded()) init()
      // the Maps script is usually async and arrives after the first render, so check until it's there
      else
        poll = setInterval(() => {
          if (!isLoaded()) return
          clearInterval(poll)
          init()
        }, 100)
    }
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
      clearInterval(poll)
    }
  }, [init, initOnMount])

  const fetchSuggestions = useCallback(async (input: string) => {
    const id = ++latest.current
    const current = session.current!
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const library = await loadPlaces()
      const { suggestions } = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        ...options.current,
        input,
        sessionToken: current.token(library),
      })
      if (id !== latest.current || !mounted.current) return
      const data = suggestions.flatMap((s) => (s.placePrediction ? [toSuggestion(s.placePrediction)] : []))
      for (const s of data) sessionOf.set(s.prediction, current)
      setReady(true)
      setState({ status: data.length ? 'ok' : 'zero-results', suggestions: data, loading: false, error: undefined })
    } catch (error) {
      if (id !== latest.current || !mounted.current) return
      setState({ ...idle, status: 'error', error })
    }
  }, [])

  const clearSuggestions = useCallback(() => {
    latest.current++
    clearTimeout(timer.current)
    setState(idle)
  }, [])

  const setValue = useCallback(
    (next: string, shouldFetch = true) => {
      setValueState(next)
      clearTimeout(timer.current)
      if (!shouldFetch) {
        // a value set without fetching is a selection or a reset: that search is over, so the next one gets its own session
        session.current = createSession()
        return
      }
      if (next.trim().length < minLength) return clearSuggestions()
      timer.current = setTimeout(() => fetchSuggestions(next), debounce)
    },
    [debounce, minLength, fetchSuggestions, clearSuggestions],
  )

  const getPlace = useCallback(async (suggestion: Suggestion, fields: readonly string[] = defaultFields) => {
    // The prediction carries the token of the session it came from, so this call ends that session at Google
    // whatever happens here. If that session is the current one, move on to a new one now, before the details
    // call resolves, so a keystroke in the meantime doesn't reuse a token that is about to be spent.
    const owner = sessionOf.get(suggestion.prediction)
    if (!owner || owner === session.current) session.current = createSession()
    const place = suggestion.prediction.toPlace()
    await place.fetchFields({ fields: [...fields] })
    return place
  }, [])

  return { ready, value, setValue, ...state, clearSuggestions, getPlace, init }
}
