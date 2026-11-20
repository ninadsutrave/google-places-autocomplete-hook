# google-places-autocomplete-hook example

Two pages built on google-places-autocomplete-hook:

- `index.html`: an accessible place search box with keyboard navigation, using `usePlaces`
- `compat.html`: the same search written against use-places-autocomplete's API, imported from `google-places-autocomplete-hook/compat`

To run them:

1. Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_MAPS_KEY` to a key with **Maps JavaScript API** and **Places API (New)** enabled. If the key is restricted to websites, allow `http://localhost:5173/*`.
2. Build the package from the repo root with `npm run build`.
3. Install and start the example:

```sh
npm install
npm run dev
```

Open http://localhost:5173 and http://localhost:5173/compat.html.
