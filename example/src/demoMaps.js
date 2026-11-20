// Stands in for the Maps JavaScript API when there's no key, so the demo page answers from the list in
// demoPlaces.js and never calls Google. It covers the parts of the "places" library the hook uses.
import { places } from './demoPlaces'

const byId = new Map(places.map((p) => [p.id, p]))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const latLng = (lat, lng) => ({ lat: () => lat, lng: () => lng, toJSON: () => ({ lat, lng }) })

// where the input starts a word in text, as Google's matches would mark it
const matchIn = (text, input) => {
  const lower = text.toLowerCase()
  for (let i = lower.indexOf(input); i !== -1; i = lower.indexOf(input, i + 1)) {
    if (i === 0 || /[\s,(-]/.test(lower[i - 1])) return { startOffset: i, endOffset: i + input.length }
  }
  return null
}

class Place {
  constructor({ id }) {
    this.id = id
  }

  async fetchFields({ fields }) {
    await wait(150)
    const p = byId.get(this.id)
    if (!p) throw new Error(`No demo place with id ${this.id}`)
    const d = p.types[0] === 'locality' ? 0.1 : 0.005
    const values = {
      displayName: p.name,
      formattedAddress: p.address,
      location: latLng(p.lat, p.lng),
      viewport: {
        getNorthEast: () => latLng(p.lat + d, p.lng + d),
        getSouthWest: () => latLng(p.lat - d, p.lng - d),
        toJSON: () => ({ north: p.lat + d, south: p.lat - d, east: p.lng + d, west: p.lng - d }),
      },
      addressComponents: [
        { longText: p.city, shortText: p.city, types: ['locality', 'political'] },
        { longText: p.country, shortText: p.countryCode, types: ['country', 'political'] },
        ...(p.postalCode ? [{ longText: p.postalCode, shortText: p.postalCode, types: ['postal_code'] }] : []),
      ],
      types: p.types,
    }
    for (const field of fields) if (field in values) this[field] = values[field]
    return { place: this }
  }
}

const AutocompleteSuggestion = {
  async fetchAutocompleteSuggestions({ input }) {
    await wait(120)
    const query = input.trim().toLowerCase()
    if (!query) return { suggestions: [] }
    const found = places
      .map((p) => ({ p, text: `${p.name}, ${p.area}`, match: matchIn(`${p.name}, ${p.area}`, query) }))
      .filter((f) => f.match)
      .sort((a, b) => a.match.startOffset - b.match.startOffset)
      .slice(0, 5)
    return {
      suggestions: found.map(({ p, text, match }) => ({
        placePrediction: {
          placeId: p.id,
          text: { text, matches: [match] },
          mainText: { text: p.name, matches: match.endOffset <= p.name.length ? [match] : [] },
          secondaryText: { text: p.area, matches: [] },
          types: p.types,
          distanceMeters: null,
          toPlace: () => new Place({ id: p.id }),
        },
      })),
    }
  },
}

class AutocompleteSessionToken {}

export function installDemoMaps() {
  window.google = {
    maps: {
      importLibrary: async (name) => {
        if (name === 'places') return { AutocompleteSuggestion, AutocompleteSessionToken, Place }
        throw new Error(`The demo has no "${name}" library`)
      },
    },
  }
}
