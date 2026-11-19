// @vitest-environment node
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { usePlaces } from '../src'
import usePlacesAutocomplete from '../src/compat'

describe('server rendering', () => {
  it('renders without window', () => {
    function Input() {
      const { ready, value } = usePlaces({ defaultValue: 'Pune' })
      const legacy = usePlacesAutocomplete()
      return createElement('input', { disabled: !ready || !legacy.ready, defaultValue: value })
    }
    expect(typeof window).toBe('undefined')
    // React 17 adds data-reactroot
    expect(renderToString(createElement(Input)).replace(' data-reactroot=""', '')).toBe('<input disabled="" value="Pune"/>')
  })
})
