import { useEffect, useState, useSyncExternalStore } from 'react'
import { authFailed, onAuthFailure, readKey, saveKey } from './maps'
import { getEntries, subscribe } from './requestLog'
import { HookDemo } from './HookDemo'
import { CompatDemo } from './CompatDemo'

const repo = 'https://github.com/ninadsutrave/google-places-autocomplete-hook'
const install = 'npm install google-places-autocomplete-hook'

const usage = `import { usePlaces } from 'google-places-autocomplete-hook'

function PlaceSearch() {
  const { value, setValue, suggestions, clearSuggestions, getPlace } = usePlaces()

  const select = async (s) => {
    setValue(s.text, false)
    clearSuggestions()
    const place = await getPlace(s, ['formattedAddress', 'location'])
  }

  return (
    <>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <ul>
        {suggestions.map((s) => (
          <li key={s.placeId} onClick={() => select(s)}>{s.text}</li>
        ))}
      </ul>
    </>
  )
}`

const compatDiff = `- import usePlacesAutocomplete from 'use-places-autocomplete'
+ import usePlacesAutocomplete from 'google-places-autocomplete-hook/compat'`

function Copy({ text }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      // clipboard blocked; the text is still selectable
    }
  }
  return (
    <button type="button" className="copy" onClick={copy}>
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function KeyForm({ hasKey }) {
  const [key, setKey] = useState(readKey)
  const [shown, setShown] = useState(false)
  return (
    <form
      className="key"
      onSubmit={(e) => {
        e.preventDefault()
        saveKey(key.trim())
      }}
    >
      <label htmlFor="key">Your Google Maps API key</label>
      <div className="row">
        <input
          id="key"
          type={shown ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza…"
          autoComplete="off"
          spellCheck="false"
        />
        <button type="button" className="ghost" onClick={() => setShown((s) => !s)}>
          {shown ? 'Hide' : 'Show'}
        </button>
        <button type="submit">{hasKey ? 'Update' : 'Use key'}</button>
        {hasKey && (
          <button type="button" className="ghost" onClick={() => saveKey('')}>
            Forget
          </button>
        )}
      </div>
      <p className="privacy">
        <b>We never store or see your key.</b> It stays in this browser&apos;s local storage and goes only to Google, to load Maps. This
        page is static files on GitHub Pages, with no server, analytics or tracking.{' '}
        <a href={`${repo}/blob/main/demo/src/maps.js`}>Check the code</a>, and use <b>Forget</b> to remove the key.
      </p>
      <p className="hint">
        Using your own key instead? It needs <b>Maps JavaScript API</b> and <b>Places API (New)</b>, and its website restrictions must allow{' '}
        <code>https://ninadsutrave.github.io/*</code>. A separate key with low daily quotas is a good idea for trying things out.
      </p>
      <details className="guide" open={!hasKey}>
        <summary>No key? Get a free Demo Key from Google, with no billing needed</summary>
        <ol>
          <li>
            <p>
              Open <a href="https://developers.google.com/maps/demo-key">Google&apos;s Maps Demo Key page</a> and click{' '}
              <b>Get a Demo Key</b>. You need a personal Google account, such as Gmail; Workspace accounts aren&apos;t eligible.
            </p>
            <a href="https://developers.google.com/maps/demo-key" className="shot">
              <img
                src="./demo-key-step-1.jpg"
                alt="Google's Maps Demo Key page with the Get a Demo Key button. Opens the page."
                width="800"
                height="640"
                loading="lazy"
              />
            </a>
          </li>
          <li>
            <p>Accept the Maps Demo Key terms. Google shows the key straight away and also emails it to you. Copy it.</p>
          </li>
          <li>
            <p>
              Paste it into the field above and click <b>Use key</b>.
            </p>
          </li>
        </ol>
        <p className="hint">
          A Demo Key covers everything this page uses (checked on 21 Nov 2026). It&apos;s free, and when it reaches its daily limit it
          pauses until the next day instead of charging you. It&apos;s meant for trying things out, not for production.
        </p>
      </details>
    </form>
  )
}

function RequestLog() {
  const entries = useSyncExternalStore(subscribe, getEntries)
  const sessions = []
  for (const e of entries) {
    const key = e.session ?? 'none'
    let group = sessions.find((s) => s.key === key)
    if (!group) sessions.push((group = { key, entries: [] }))
    group.entries.push(e)
  }
  return (
    <aside className="log" aria-live="polite">
      <h3>Requests to Google</h3>
      {entries.length === 0 ? (
        <p className="hint">Type in the search box to see the requests the hook sends and the session each one belongs to.</p>
      ) : (
        [...sessions].reverse().map((s) => {
          const searches = s.entries.filter((e) => e.kind === 'autocomplete').length
          const ended = s.entries.some((e) => e.kind === 'details' && !e.error)
          return (
            <section key={s.key} className="session">
              <h4>
                {s.key === 'none' ? 'No session' : `Session ${s.key}`}
                <span>
                  {searches} autocomplete {searches === 1 ? 'request' : 'requests'}
                  {ended ? ', ended by a details request' : ', still open'}
                </span>
              </h4>
              <ol>
                {s.entries.map((e) => (
                  <li key={e.id} className={e.error ? 'error' : undefined}>
                    <span className="kind">{e.kind}</span>
                    <span className="text">{e.text}</span>
                    <span className="detail">{e.detail}</span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })
      )}
    </aside>
  )
}

export function App({ hasKey }) {
  const [tab, setTab] = useState('hook')
  const [rejected, setRejected] = useState(authFailed)
  useEffect(() => onAuthFailure(() => setRejected(true)), [])

  return (
    <main className="page">
      <header>
        <p className="eyebrow">React hook · Places API (New)</p>
        <h1>google-places-autocomplete-hook</h1>
        <p className="byline">
          by <a href="https://ninadsutrave.com">Ninad Sutrave</a>
        </p>
        <p className="lede">
          Places Autocomplete for React on Google&apos;s new API. Headless, with one session token per search handled for you, and a drop-in
          mode for use-places-autocomplete.
        </p>
        <div className="install">
          <code>{install}</code>
          <Copy text={install} />
        </div>
        <nav>
          <a href={repo}>GitHub</a>
          <a href="https://www.npmjs.com/package/google-places-autocomplete-hook">npm</a>
          <a href={`${repo}#readme`}>Docs</a>
        </nav>
      </header>

      <section>
        <h2>Try it</h2>
        <KeyForm hasKey={hasKey} />
        {rejected && (
          <p className="alert">
            Google rejected this key. Check that Maps JavaScript API is enabled for it and that its website restrictions allow this page.
            The browser console has the exact error.
          </p>
        )}
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'hook'} onClick={() => setTab('hook')}>
            usePlaces
          </button>
          <button type="button" role="tab" aria-selected={tab === 'compat'} onClick={() => setTab('compat')}>
            /compat
          </button>
        </div>
        <div className="demo">
          <div>
            {tab === 'hook' ? <HookDemo disabled={!hasKey || rejected} /> : <CompatDemo disabled={!hasKey || rejected} />}
            <p className="hint">
              {tab === 'hook'
                ? 'Built with usePlaces. Picking a place fetches its details through the suggestion, which ends that search’s session.'
                : 'The same search written against use-places-autocomplete’s API, imported from google-places-autocomplete-hook/compat.'}
            </p>
          </div>
          <RequestLog />
        </div>
      </section>

      <section>
        <h2>Usage</h2>
        <pre>
          <code>{usage}</code>
        </pre>
        <p>Coming from use-places-autocomplete? Change the import:</p>
        <pre className="diff">
          <code>{compatDiff}</code>
        </pre>
      </section>

      <footer>
        Made by <a href="https://ninadsutrave.com">Ninad Sutrave</a>. MIT licensed. Not affiliated with Google. <a href={repo}>Source</a>
      </footer>
    </main>
  )
}
