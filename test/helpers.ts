import * as React from 'react'
import { vi } from 'vitest'

// a fake of the parts of google.maps.importLibrary('places') the package uses
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

export const major = Number(React.version.split('.')[0])
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reactAct = (React as any).act
const baseAct: (fn: () => Promise<void>) => Promise<void> = reactAct ?? (await import('react-dom/test-utils')).act

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// always async, and lets pending promises (like the library load) settle before act ends
export const act = (fn: () => unknown) =>
  baseAct(async () => {
    await fn()
    await sleep(0)
  })
export const wait = (ms: number) => act(() => sleep(ms))

interface FakePrediction {
  placeId: string
  text: { text: string; matches: { startOffset: number; endOffset: number }[] }
  mainText: { text: string; matches: { startOffset: number; endOffset: number }[] }
  secondaryText: { text: string; matches: never[] }
  types: string[]
  toPlace(): FakePlace
}

export class FakePlace {
  [field: string]: unknown
  id: string
  fromPrediction = false
  fetched: string[] = []
  constructor({ id }: { id: string }) {
    this.id = id
  }
  async fetchFields({ fields }: { fields: string[] }) {
    fake.fetchFieldsCalls.push({ id: this.id, fields, fromPrediction: this.fromPrediction })
    await sleep(fake.detailsDelay)
    if (fake.failDetails) throw new Error('details failed')
    this.fetched = fields
    this.displayName = `Name of ${this.id}`
    this.formattedAddress = `Address of ${this.id}`
    this.location = { lat: () => 18.5, lng: () => 73.8 }
    this.viewport = { south: 1 }
    this.addressComponents = [
      { longText: '411001', shortText: '411001', types: ['postal_code'] },
      { longText: 'Pune', shortText: 'Pune', types: ['locality', 'political'] },
    ]
    return { place: this }
  }
}

export const prediction = (placeId: string, main: string, secondary: string): FakePrediction => ({
  placeId,
  text: { text: `${main}, ${secondary}`, matches: [{ startOffset: 0, endOffset: 2 }] },
  mainText: { text: main, matches: [{ startOffset: 0, endOffset: 2 }] },
  secondaryText: { text: secondary, matches: [] },
  types: ['locality', 'political', 'geocode'],
  toPlace() {
    const place = new FakePlace({ id: placeId })
    place.fromPrediction = true
    return place
  },
})

export const fake = {
  requests: [] as Record<string, unknown>[],
  fetchFieldsCalls: [] as { id: string; fields: string[]; fromPrediction: boolean }[],
  tokens: 0,
  failDetails: false,
  detailsDelay: 0,
  // per-input delay and results
  delay: (_input: string) => 0,
  results: (input: string): FakePrediction[] =>
    input === 'nothing' ? [] : [prediction('pune', 'Pune', 'Maharashtra, India'), prediction('puri', 'Puri', 'Odisha, India')],
  fail: (_input: string) => false,
}

export class Token {
  n = ++fake.tokens
}

export const importLibrary = vi.fn(async (name: string) => {
  if (name === 'places')
    return {
      AutocompleteSuggestion: {
        async fetchAutocompleteSuggestions(request: Record<string, unknown>) {
          fake.requests.push(request)
          const input = request.input as string
          await sleep(fake.delay(input))
          if (fake.fail(input)) throw new Error('request failed')
          return { suggestions: fake.results(input).map((placePrediction) => ({ placePrediction })) }
        },
      },
      AutocompleteSessionToken: Token,
      Place: FakePlace,
    }
  if (name === 'geocoding')
    return {
      Geocoder: class {
        async geocode(request: unknown) {
          fake.requests.push({ geocode: request })
          return { results: [{ geometry: { location: { lat: () => 1, lng: () => 2 } }, address_components: [] }] }
        }
      },
    }
  throw new Error(`unknown library ${name}`)
})

export const installGoogle = () => {
  ;(window as unknown as Record<string, unknown>).google = { maps: { importLibrary } }
}

export const removeGoogle = () => {
  delete (window as unknown as Record<string, unknown>).google
}

export const resetFake = () => {
  fake.requests = []
  fake.fetchFieldsCalls = []
  fake.failDetails = false
  fake.detailsDelay = 0
  fake.delay = () => 0
  fake.fail = () => false
  fake.results = (input) =>
    input === 'nothing' ? [] : [prediction('pune', 'Pune', 'Maharashtra, India'), prediction('puri', 'Puri', 'Odisha, India')]
}

export async function renderHook<T>(hook: () => T, { strict = false } = {}) {
  const result = { current: undefined as unknown as T }
  function Probe() {
    result.current = hook()
    return null
  }
  const element = strict ? React.createElement(React.StrictMode, null, React.createElement(Probe)) : React.createElement(Probe)
  const container = document.createElement('div')
  let unmount: () => void
  if (major >= 18) {
    // a variable path, so Vite doesn't try to resolve react-dom/client on React 17
    const client = 'react-dom/client'
    const { createRoot } = await import(/* @vite-ignore */ client)
    const root = createRoot(container)
    await act(() => root.render(element))
    unmount = () => root.unmount()
  } else {
    const ReactDOM = await import('react-dom')
    await act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(ReactDOM as any).render(element, container)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unmount = () => (ReactDOM as any).unmountComponentAtNode(container)
  }
  return { result, unmount: () => act(unmount) }
}
