---
'google-places-autocomplete-hook': patch
---

`/compat` no longer sends `requestOptions` keys that Places API (New) rejects, such as a stray `debounce`. The legacy API ignored them; the new one threw and showed no suggestions.
