// Records the requests the hook sends, so the page can show how they group into sessions.
// It wraps two methods of the real places library and passes everything through unchanged.
const listeners = new Set()
let entries = []
let nextSession = 1
const sessionNumbers = new WeakMap()
const sessionOfPlace = new Map()

const sessionOf = (token) => {
  if (!token) return null
  if (!sessionNumbers.has(token)) sessionNumbers.set(token, nextSession++)
  return sessionNumbers.get(token)
}

const add = (entry) => {
  entries = [...entries, { ...entry, id: entries.length }]
  listeners.forEach((listener) => listener())
}

export const getEntries = () => entries
export const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function watchPlaces() {
  const { AutocompleteSuggestion, Place } = await window.google.maps.importLibrary('places')

  const fetchSuggestions = AutocompleteSuggestion.fetchAutocompleteSuggestions
  AutocompleteSuggestion.fetchAutocompleteSuggestions = async function (request) {
    const session = sessionOf(request.sessionToken)
    try {
      const result = await fetchSuggestions.call(this, request)
      for (const s of result.suggestions) if (s.placePrediction) sessionOfPlace.set(s.placePrediction.placeId, session)
      add({ kind: 'autocomplete', session, text: request.input, detail: `${result.suggestions.length} suggestions` })
      return result
    } catch (error) {
      add({ kind: 'autocomplete', session, text: request.input, detail: 'failed', error: true })
      throw error
    }
  }

  const fetchFields = Place.prototype.fetchFields
  Place.prototype.fetchFields = async function (options) {
    const session = sessionOfPlace.get(this.id) ?? null
    try {
      const result = await fetchFields.call(this, options)
      add({ kind: 'details', session, text: this.displayName ?? this.formattedAddress ?? this.id, detail: options.fields.join(', ') })
      return result
    } catch (error) {
      add({ kind: 'details', session, text: this.id, detail: 'failed', error: true })
      throw error
    }
  }
}
