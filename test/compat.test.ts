import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import usePlacesAutocomplete, {
  getDetails,
  getGeocode,
  getLatLng,
  getZipCode,
  toAutocompleteRequest,
  type ClearCache,
  type GetDetailsArgs,
  type LatLon,
  type Status,
  type Suggestions,
} from '../src/compat'
import { act, fake, installGoogle, prediction, removeGoogle, renderHook, resetFake, wait } from './helpers'

const errors = vi.spyOn(console, 'error')

beforeEach(() => {
  resetFake()
  installGoogle()
  errors.mockClear()
})

afterEach(() => {
  expect(errors).not.toHaveBeenCalled()
})

describe('google-places-autocomplete-hook/compat', () => {
  it('returns the use-places-autocomplete shape with legacy predictions', async () => {
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await wait(0)
    expect(result.current.ready).toBe(true)
    expect(result.current.suggestions).toEqual({ loading: false, status: '', data: [] })
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(result.current.suggestions.status).toBe('OK')
    expect(result.current.suggestions.data[0]).toEqual({
      description: 'Pune, Maharashtra, India',
      place_id: 'pune',
      types: ['locality', 'political', 'geocode'],
      matched_substrings: [{ offset: 0, length: 2 }],
      structured_formatting: {
        main_text: 'Pune',
        main_text_matched_substrings: [{ offset: 0, length: 2 }],
        secondary_text: 'Maharashtra, India',
      },
      terms: [
        { offset: 0, value: 'Pune' },
        { offset: 6, value: 'Maharashtra' },
        { offset: 19, value: 'India' },
      ],
    })
    await act(() => result.current.setValue('nothing'))
    await wait(10)
    expect(result.current.suggestions.status).toBe('ZERO_RESULTS')
    expect(typeof result.current.clearCache).toBe('function')
    await unmount()
  })

  it('converts legacy requestOptions', () => {
    const location = { lat: 18.5, lng: 73.8 }
    expect(
      toAutocompleteRequest({
        componentRestrictions: { country: 'in' },
        types: ['(cities)'],
        language: 'en',
        location,
        radius: 5000,
        offset: 3,
        sessionToken: 'ignored',
      }),
    ).toEqual({
      includedRegionCodes: ['in'],
      includedPrimaryTypes: ['(cities)'],
      language: 'en',
      locationBias: { center: location, radius: 5000 },
      inputOffset: 3,
    })
    expect(toAutocompleteRequest({ componentRestrictions: { country: ['in', 'np'] }, bounds: 'b' })).toEqual({
      includedRegionCodes: ['in', 'np'],
      locationBias: 'b',
    })
    expect(toAutocompleteRequest({ locationBias: 'own', location, radius: 1 })).toEqual({ locationBias: 'own' })
  })

  it('sends converted requestOptions with each request', async () => {
    const { result, unmount } = await renderHook(() =>
      usePlacesAutocomplete({ debounce: 0, requestOptions: { componentRestrictions: { country: 'in' } } }),
    )
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(fake.requests[0]).toMatchObject({ input: 'pu', includedRegionCodes: ['in'] })
    await unmount()
  })

  it('getDetails on a shown suggestion ends its session, even after clearSuggestions', async () => {
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    const { place_id, description } = result.current.suggestions.data[0]
    await act(() => {
      result.current.setValue(description, false)
      result.current.clearSuggestions()
    })
    let details: Awaited<ReturnType<typeof getDetails>> | undefined
    await act(async () => {
      details = await getDetails({ placeId: place_id, fields: ['name', 'formatted_address', 'geometry', 'address_components'] })
    })
    expect(fake.fetchFieldsCalls).toEqual([
      { id: 'pune', fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'viewport'], fromPrediction: true },
    ])
    expect(details).toMatchObject({
      name: 'Name of pune',
      formatted_address: 'Address of pune',
      address_components: [
        { long_name: '411001', short_name: '411001', types: ['postal_code'] },
        { long_name: 'Pune', short_name: 'Pune', types: ['locality', 'political'] },
      ],
    })
    expect(getLatLng(details!)).toEqual({ lat: 18.5, lng: 73.8 })
    expect(getZipCode(details!)).toBe('411001')

    await act(() => result.current.setValue('mu'))
    await wait(10)
    expect(fake.requests[1].sessionToken).not.toBe(fake.requests[0].sessionToken)
    await unmount()
  })

  it('getDetails for a place that was not suggested looks it up directly', async () => {
    const details = await getDetails({ placeId: 'somewhere-else' })
    expect(fake.fetchFieldsCalls[0]).toMatchObject({ id: 'somewhere-else', fromPrediction: false })
    expect(details.place_id).toBe('somewhere-else')
  })

  it('getGeocode uses the geocoding library; getLatLng and getZipCode handle plain values', async () => {
    const results = await getGeocode({ address: 'Pune' })
    expect(fake.requests).toEqual([{ geocode: { address: 'Pune' } }])
    const point: LatLon = getLatLng(results[0])
    expect(point).toEqual({ lat: 1, lng: 2 })
    expect(getLatLng({ geometry: { location: { lat: 3, lng: 4 } } })).toEqual({ lat: 3, lng: 4 })
    expect(() => getLatLng({})).toThrow(/geometry/)
    expect(getZipCode({ address_components: [{ long_name: 'Long', short_name: 'S', types: ['postal_code'] }] }, true)).toBe('S')
    expect(getZipCode({})).toBeUndefined()
  })

  it('callbackName registers a global that initialises the hook', async () => {
    removeGoogle()
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ callbackName: 'initMap' }))
    await wait(0)
    expect(result.current.ready).toBe(false)
    installGoogle()
    const w = window as unknown as { initMap?: () => void }
    await act(() => w.initMap!())
    await wait(0)
    expect(result.current.ready).toBe(true)
    await unmount()
    expect(w.initMap).toBeUndefined()
  })
})

describe('sessions through getDetails', () => {
  it('fetches a shown place through its prediction once, then by ID, without touching the current search', async () => {
    const pune = prediction('pune', 'Pune', 'Maharashtra, India')
    fake.results = (input) => (input.startsWith('ba') ? [prediction('bali', 'Bali', 'Indonesia')] : [pune])
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    await act(() => result.current.setValue('Pune, Maharashtra, India', false))
    await act(() => result.current.clearSuggestions())
    await act(async () => {
      await getDetails({ placeId: 'pune' })
    })
    await act(() => result.current.setValue('ba'))
    await wait(10)
    const current = fake.requests[1].sessionToken
    await act(async () => {
      await getDetails({ placeId: 'pune' })
    })
    await act(() => result.current.setValue('bal'))
    await wait(10)
    expect(fake.fetchFieldsCalls.map((c) => c.fromPrediction)).toEqual([true, false])
    expect(fake.requests[2].sessionToken).toBe(current)
    await unmount()
  })

  it('maps the legacy "address" type and drops "geocode"', () => {
    expect(toAutocompleteRequest({ types: ['address'] }).includedPrimaryTypes).toEqual(['street_address', 'premise', 'subpremise', 'route'])
    expect(toAutocompleteRequest({ types: ['geocode'] }).includedPrimaryTypes).toBeUndefined()
    expect(toAutocompleteRequest({ types: ['(cities)'] }).includedPrimaryTypes).toEqual(['(cities)'])
  })

  it('drops requestOptions keys the new API would reject, as the legacy API ignored them', async () => {
    const request = toAutocompleteRequest({
      types: ['(cities)'],
      debounce: 300,
      sessionToken: 'old',
      language: 'de',
      includedRegionCodes: ['ch'],
    })
    expect(request).toEqual({ includedPrimaryTypes: ['(cities)'], language: 'de', includedRegionCodes: ['ch'] })

    const { result, unmount } = await renderHook(() =>
      usePlacesAutocomplete({ debounce: 0, requestOptions: { types: ['(cities)'], debounce: 300 } }),
    )
    await act(() => result.current.setValue('be'))
    await wait(10)
    expect(fake.requests[0]).not.toHaveProperty('debounce')
    expect(fake.requests[0]).toMatchObject({ input: 'be', includedPrimaryTypes: ['(cities)'] })
    await unmount()
  })

  it('keeps the same data array between renders that do not change the suggestions', async () => {
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    const { data } = result.current.suggestions
    await act(() => result.current.setValue('pu', false))
    expect(result.current.suggestions.data).toBe(data)
    await unmount()
  })

  it('types line up with use-places-autocomplete', () => {
    const status: Status = 'REQUEST_DENIED'
    const list: Suggestions = { loading: false, status, data: [] }
    const clear: ClearCache = () => {}
    clear('upa')
    const args: GetDetailsArgs = { placeId: 'x', fields: ['name'] }
    expect(list.data).toEqual([])
    expect(args.placeId).toBe('x')
  })
})

describe('what getDetails remembers', () => {
  it('a new search replaces what the hook remembered, and unmounting drops it', async () => {
    fake.results = (input) => (input.startsWith('ba') ? [prediction('bali', 'Bali', 'Indonesia')] : [prediction('pune', 'Pune', 'India')])
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    await act(() => result.current.setValue('ba'))
    await wait(10)
    await act(async () => {
      await getDetails({ placeId: 'pune' })
    })
    await unmount()
    await act(async () => {
      await getDetails({ placeId: 'bali' })
    })
    expect(fake.fetchFieldsCalls.map((c) => [c.id, c.fromPrediction])).toEqual([
      ['pune', false],
      ['bali', false],
    ])
  })
})
