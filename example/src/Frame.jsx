import './styles.css'
import { isDemo } from './loadMaps'

const repo = 'https://github.com/ninadsutrave/google-places-autocomplete-hook'

// The page around each example: title, links between the two pages, and a note when it runs on demo data.
export function Frame({ page, children }) {
  return (
    <main className="page">
      <header>
        <p className="eyebrow">React hook · Places API (New)</p>
        <h1>google-places-autocomplete-hook</h1>
        <nav>
          <a href="./" aria-current={page === 'hook' ? 'page' : undefined}>
            usePlaces
          </a>
          <a href="./compat.html" aria-current={page === 'compat' ? 'page' : undefined}>
            /compat
          </a>
          <span className="spacer" />
          <a href={repo}>GitHub</a>
          <a href="https://www.npmjs.com/package/google-places-autocomplete-hook">npm</a>
        </nav>
      </header>
      {isDemo && (
        <p className="note">
          Demo data: suggestions come from a built-in list of about 30 places, not from Google, so this page makes no Maps requests. Try
          Amsterdam, Pune, Eiffel or Golden Gate.
        </p>
      )}
      {children}
      <footer>
        {page === 'hook' ? (
          <a href={`${repo}/blob/main/example/src/PlaceSearch.jsx`}>Source of this page</a>
        ) : (
          <a href={`${repo}/blob/main/example/src/compat.jsx`}>Source of this page</a>
        )}
      </footer>
    </main>
  )
}
