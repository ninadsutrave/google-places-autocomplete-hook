import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaces, isLoaded, loadPlaces, toSuggestion } from '../src'
import usePlacesAutocomplete, { getDetails, toAutocompleteRequest } from '../src/compat'
import { act, fake, importLibrary, installGoogle, prediction, removeGoogle, renderHook, resetFake, wait } from './helpers'

const errors = vi.spyOn(console, 'error')

beforeEach(() => {
  resetFake()
  installGoogle()
  errors.mockClear()
})

afterEach(() => {
  expect(errors).not.toHaveBeenCalled()
})

describe('loading', () => {
  it('a failed library load is retried by the next call', async () => {
    // first load in this file, so nothing is cached yet
    importLibrary.mockImplementationOnce(async () => {
      throw new Error('network down')
    })
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await wait(0)
    expect(result.current.ready).toBe(false)
    expect(result.current.status).toBe('error')
    expect((result.current.error as Error).message).toBe('network down')
    await act(() => result.current.init())
    expect(result.current.ready).toBe(true)
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(result.current.status).toBe('ok')
    await unmount()
  })

  it('reports clearly when the Maps script is missing', async () => {
    removeGoogle()
    expect(isLoaded()).toBe(false)
    await expect(loadPlaces()).rejects.toThrow('the Google Maps JavaScript API is not loaded')
  })

  it('picks up a Maps script that loads after mount, without init()', async () => {
    removeGoogle()
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await wait(150)
    expect(result.current.ready).toBe(false)
    installGoogle()
    await wait(150)
    expect(result.current.ready).toBe(true)
    await unmount()
  })

  it('stops checking for the Maps script after unmount', async () => {
    removeGoogle()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = await renderHook(() => usePlaces())
    const id = setIntervalSpy.mock.results[setIntervalSpy.mock.results.length - 1]?.value
    await unmount()
    expect(clearIntervalSpy).toHaveBeenCalledWith(id)
    installGoogle()
    await wait(150)
    setIntervalSpy.mockRestore()
    clearIntervalSpy.mockRestore()
  })

  it('initOnMount: false waits, then the first search loads the library and sets ready', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0, initOnMount: false }))
    expect(result.current.ready).toBe(false)
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(result.current.ready).toBe(true)
    expect(result.current.suggestions).toHaveLength(2)
    await unmount()
  })
})

describe('usePlaces edge cases', () => {
  it('defaultValue does not fetch on mount', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ defaultValue: 'Pune', debounce: 0 }))
    await wait(10)
    expect(result.current.value).toBe('Pune')
    expect(fake.requests).toHaveLength(0)
    await unmount()
  })

  it('uses the latest request options at fetch time', async () => {
    let request = { includedRegionCodes: ['in'] }
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0, request }))
    request = { includedRegionCodes: ['np'] }
    await act(() => result.current.setValue('k', false)) // a committed re-render with the new options
    await act(() => result.current.setValue('ka'))
    await wait(10)
    expect(fake.requests[0].includedRegionCodes).toEqual(['np'])
    await unmount()
  })

  it('whitespace-only input counts as empty', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('   '))
    await wait(10)
    expect(fake.requests).toHaveLength(0)
    expect(result.current.status).toBe('idle')
    await unmount()
  })

  it('skips suggestions without a place prediction', async () => {
    fake.results = () => [prediction('pune', 'Pune', 'India'), null as never]
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(result.current.suggestions.map((s) => s.placeId)).toEqual(['pune'])
    await unmount()
  })

  it('fills in missing main/secondary text and keeps distance', () => {
    const s = toSuggestion({
      placeId: 'x',
      text: { text: 'Somewhere', matches: [] },
      mainText: null,
      secondaryText: undefined,
      types: undefined as never,
      distanceMeters: 1200,
      toPlace: () => ({}) as never,
    })
    expect(s).toMatchObject({ mainText: 'Somewhere', secondaryText: '', mainTextMatches: [], types: [], distanceMeters: 1200 })
    expect(toSuggestion({ ...s.prediction, distanceMeters: null }).distanceMeters).toBeUndefined()
  })

  it('two hooks on a page keep separate sessions', async () => {
    const a = await renderHook(() => usePlaces({ debounce: 0 }))
    const b = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => a.result.current.setValue('pu'))
    await wait(10)
    await act(() => b.result.current.setValue('mu'))
    await wait(10)
    expect(fake.requests[0].sessionToken).not.toBe(fake.requests[1].sessionToken)
    // ending a's session leaves b's alone
    await act(async () => {
      await a.result.current.getPlace(a.result.current.suggestions[0])
    })
    await act(() => b.result.current.setValue('mum'))
    await wait(10)
    expect(fake.requests[2].sessionToken).toBe(fake.requests[1].sessionToken)
    await a.unmount()
    await b.unmount()
  })

  it('setValue after unmount does nothing and does not warn', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    const { setValue } = result.current
    await unmount()
    await act(() => setValue('pu'))
    await wait(10)
  })

  it('a pending debounce is cancelled on unmount', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 30 }))
    await act(() => result.current.setValue('pu'))
    await unmount()
    await wait(50)
    expect(fake.requests).toHaveLength(0)
  })

  it('loading is true while a request is in flight and keeps the previous list', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    fake.delay = () => 40
    await act(() => result.current.setValue('pun'))
    await wait(10)
    expect(result.current.loading).toBe(true)
    expect(result.current.suggestions).toHaveLength(2)
    await wait(50)
    expect(result.current.loading).toBe(false)
    await unmount()
  })
})

describe('compat edge cases', () => {
  it('maps errors to UNKNOWN_ERROR and passes distance through', async () => {
    fake.fail = (input) => input === 'boom'
    fake.results = () => [{ ...prediction('pune', 'Pune', 'India'), distanceMeters: 900 } as never]
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(result.current.suggestions.data[0].distance_meters).toBe(900)
    await act(() => result.current.setValue('boom'))
    await wait(10)
    expect(result.current.suggestions.status).toBe('UNKNOWN_ERROR')
    await unmount()
  })

  it('getDetails passes language for direct lookups, and unknown fields by name', async () => {
    const details = await getDetails({ placeId: 'elsewhere', fields: ['formatted_address', 'editorialSummary'], language: 'hi' })
    expect(fake.fetchFieldsCalls[0]).toMatchObject({
      id: 'elsewhere',
      fields: ['formattedAddress', 'editorialSummary'],
      fromPrediction: false,
    })
    expect(details).toEqual({ formatted_address: 'Address of elsewhere' })
  })

  it('only remembers the last 50 suggested places', async () => {
    let n = 0
    fake.results = () => Array.from({ length: 30 }, () => prediction(`p${++n}`, `Place ${n}`, 'India'))
    const { result, unmount } = await renderHook(() => usePlacesAutocomplete({ debounce: 0 }))
    await act(() => result.current.setValue('a'))
    await wait(10)
    await act(() => result.current.setValue('ab'))
    await wait(10)
    await getDetails({ placeId: 'p1' }) // evicted: looked up directly
    await getDetails({ placeId: 'p60' }) // still remembered: via its prediction
    expect(fake.fetchFieldsCalls.map((c) => [c.id, c.fromPrediction])).toEqual([
      ['p1', false],
      ['p60', true],
    ])
    await unmount()
  })

  it('callbackName does not remove a global that something else replaced', async () => {
    const w = window as unknown as Record<string, unknown>
    const { unmount } = await renderHook(() => usePlacesAutocomplete({ callbackName: 'initPlaces' }))
    const other = () => {}
    w.initPlaces = other
    await unmount()
    expect(w.initPlaces).toBe(other)
    delete w.initPlaces
  })

  it('toAutocompleteRequest handles empty options and a radius of 0', () => {
    expect(toAutocompleteRequest()).toEqual({})
    expect(toAutocompleteRequest({ location: { lat: 1, lng: 2 }, radius: 0 })).toEqual({
      locationBias: { center: { lat: 1, lng: 2 }, radius: 0 },
    })
  })
})
