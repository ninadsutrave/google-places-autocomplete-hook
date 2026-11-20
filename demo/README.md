# Demo page

The page at https://ninadsutrave.github.io/google-places-autocomplete-hook/. Visitors paste their own Google Maps API key, which stays in their browser, and search with the real API. A log shows how the hook groups requests into sessions.

```sh
npm run build # in the repo root first
cd demo
npm install
npm run dev
```

For local use, the key must allow `http://localhost:5173/*`. Instead of pasting it into the page each time, you can put it in `demo/.env.local` as `VITE_GOOGLE_MAPS_KEY` (development only; builds ignore it).
