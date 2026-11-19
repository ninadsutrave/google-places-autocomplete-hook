import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaces } from '../src'
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

describe('usePlaces', () => {
  it('loads the places library on mount, once across hooks', async () => {
    const a = await renderHook(() => usePlaces())
    const b = await renderHook(() => usePlaces())
    await wait(0)
    expect(a.result.current.ready).toBe(true)
    expect(b.result.current.ready).toBe(true)
    expect(importLibrary.mock.calls.filter(([name]) => name === 'places')).toHaveLength(1)
    await a.unmount()
    await b.unmount()
  })

  it('fetches and flattens suggestions after the debounce', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 20 }))
    await act(() => result.current.setValue('pu'))
    expect(result.current.value).toBe('pu')
    expect(fake.requests).toHaveLength(0)
    await wait(40)
    expect(result.current.status).toBe('ok')
    expect(result.current.loading).toBe(false)
    const [first] = result.current.suggestions
    expect(first).toMatchObject({
      placeId: 'pune',
      text: 'Pune, Maharashtra, India',
      mainText: 'Pune',
      secondaryText: 'Maharashtra, India',
      matches: [{ startOffset: 0, endOffset: 2 }],
      mainTextMatches: [{ startOffset: 0, endOffset: 2 }],
      types: ['locality', 'political', 'geocode'],
    })
    expect(first.prediction.placeId).toBe('pune')
    await unmount()
  })

  it('debounces fast typing into one request for the last value', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 30 }))
    await act(() => result.current.setValue('p'))
    await wait(5)
    await act(() => result.current.setValue('pu'))
    await wait(5)
    await act(() => result.current.setValue('pun'))
    await wait(60)
    expect(fake.requests.map((r) => r.input)).toEqual(['pun'])
    await unmount()
  })

  it('sends the request options with the input and a session token', async () => {
    const request = { includedRegionCodes: ['in'], language: 'en', includedPrimaryTypes: ['(cities)'] }
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0, request }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(fake.requests[0]).toMatchObject({ ...request, input: 'pu' })
    expect(fake.requests[0].sessionToken).toBeDefined()
    await unmount()
  })

  it('keeps one session token while typing, and starts a new one after getPlace', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('p'))
    await wait(10)
    await act(() => result.current.setValue('pu'))
    await wait(10)
    const [first, second] = fake.requests.map((r) => r.sessionToken)
    expect(first).toBe(second)

    let place: Awaited<ReturnType<typeof result.current.getPlace>> | undefined
    await act(async () => {
      place = await result.current.getPlace(result.current.suggestions[0], ['formattedAddress', 'location'])
    })
    expect(fake.fetchFieldsCalls).toEqual([{ id: 'pune', fields: ['formattedAddress', 'location'], fromPrediction: true }])
    expect(place?.formattedAddress).toBe('Address of pune')

    await act(() => result.current.setValue('mu'))
    await wait(10)
    expect(fake.requests[2].sessionToken).not.toBe(first)
    await unmount()
  })

  it('ends the session even when the details call fails', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    fake.failDetails = true
    await act(async () => {
      await expect(result.current.getPlace(result.current.suggestions[0])).rejects.toThrow('details failed')
    })
    await act(() => result.current.setValue('pun'))
    await wait(10)
    expect(fake.requests[1].sessionToken).not.toBe(fake.requests[0].sessionToken)
    await unmount()
  })

  it('uses default fields for getPlace', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(10)
    await act(async () => {
      await result.current.getPlace(result.current.suggestions[1])
    })
    expect(fake.fetchFieldsCalls[0].fields).toEqual(['id', 'displayName', 'formattedAddress', 'location'])
    await unmount()
  })

  it('drops a slow response that arrives after a newer one', async () => {
    fake.delay = (input) => (input === 'p' ? 60 : 5)
    fake.results = (input) => [prediction(input, input, 'India')]
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('p'))
    await wait(5)
    await act(() => result.current.setValue('pu'))
    await wait(100)
    expect(result.current.suggestions.map((s) => s.placeId)).toEqual(['pu'])
    await unmount()
  })

  it('does not fetch below minLength and clears straight away', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0, minLength: 3 }))
    await act(() => result.current.setValue('pun'))
    await wait(10)
    expect(result.current.suggestions).toHaveLength(2)
    await act(() => result.current.setValue('pu'))
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.status).toBe('idle')
    await wait(10)
    expect(fake.requests).toHaveLength(1)
    await unmount()
  })

  it('setValue(value, false) updates the value without fetching', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('Pune, Maharashtra, India', false))
    await wait(10)
    expect(result.current.value).toBe('Pune, Maharashtra, India')
    expect(fake.requests).toHaveLength(0)
    await unmount()
  })

  it('reports zero results and errors', async () => {
    fake.fail = (input) => input === 'boom'
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('nothing'))
    await wait(10)
    expect(result.current.status).toBe('zero-results')
    await act(() => result.current.setValue('boom'))
    await wait(10)
    expect(result.current.status).toBe('error')
    expect((result.current.error as Error).message).toBe('request failed')
    expect(result.current.suggestions).toEqual([])
    await unmount()
  })

  it('clearSuggestions empties the list and ignores a request still in flight', async () => {
    fake.delay = () => 30
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(5)
    await act(() => result.current.clearSuggestions())
    await wait(50)
    expect(result.current.suggestions).toEqual([])
    expect(result.current.status).toBe('idle')
    await unmount()
  })

  it('does not update after unmount', async () => {
    fake.delay = () => 30
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await act(() => result.current.setValue('pu'))
    await wait(5)
    await unmount()
    await wait(50)
    // afterEach checks there were no React warnings
  })

  it('works under StrictMode with one request per change', async () => {
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }), { strict: true })
    await wait(0)
    expect(result.current.ready).toBe(true)
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(fake.requests).toHaveLength(1)
    expect(result.current.suggestions).toHaveLength(2)
    await unmount()
  })

  it('waits for the Maps script, then works after init()', async () => {
    removeGoogle()
    const { result, unmount } = await renderHook(() => usePlaces({ debounce: 0 }))
    await wait(0)
    expect(result.current.ready).toBe(false)
    await act(() => result.current.setValue('pu'))
    await wait(10)
    expect(result.current.status).toBe('error')
    installGoogle()
    await act(() => result.current.init())
    await wait(0)
    expect(result.current.ready).toBe(true)
    await act(() => result.current.setValue('pun'))
    await wait(10)
    expect(result.current.status).toBe('ok')
    await unmount()
  })
})
