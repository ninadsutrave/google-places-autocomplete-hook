# Contributing

Thanks for helping out. Bug reports, fixes, docs and ideas are all welcome.

## Before you start

- For a bug, open an issue with the steps to reproduce it, or go straight to a PR if the fix is small.
- For a new feature or an API change, open an issue first so we can agree on the shape before you spend time on it.

## Setup

You need Node 20 or later.

```sh
git clone https://github.com/ninadsutrave/google-places-autocomplete-hook.git
cd google-places-autocomplete-hook
npm install
```

| Command                |                                          |
| :--------------------- | :--------------------------------------- |
| `npm test`             | Run the tests (Vitest, jsdom)            |
| `npm run typecheck`    | Type-check the source and tests          |
| `npm run lint`         | Lint with ESLint                         |
| `npm run build`        | Build `dist` with tsup                   |
| `npm run format`       | Format with Prettier                     |
| `npm run lint:package` | Check the published package with publint |

The tests run against a fake of `google.maps.importLibrary` in `test/helpers.ts`, so you don't need an API key. CI runs them on React 17, 18 and 19.

To try a change in a browser, build the package and run the example. It needs a Google Maps key with Places API (New) enabled:

```sh
npm run build
cd example
npm install
npm run dev
```

## Pull requests

- Keep each PR to one change, and add a test for it.
- Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run format` before pushing.
- If the change affects users, add a changeset with `npx changeset` and describe it in a sentence or two. It ends up in the changelog.

## Releasing

Releases go through [Changesets](https://github.com/changesets/changesets). When changesets are merged into `main`, the release workflow opens a "Version Packages" PR. Merging that PR publishes to npm using npm trusted publishing, so no token is stored in the repo. See `.github/workflows/release.yml`.
