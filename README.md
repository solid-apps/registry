# solid-apps registry

A curated, community-submitted directory of Solid **apps** (rail-level UIs) and
**panes** (per-subject renderers). Hosts like
[hub](https://github.com/solid-apps/hub) and
[pilot](https://github.com/solid-apps/pilot) read this list to surface
installable entries to users.

The registry lives at <https://solid-apps.github.io/registry/index.json>.

## What's here

A single JSON-LD file (`index.json`) shaped as a `schema:ItemList`. Each
`itemListElement` is either:

- **`@type: urn:App`** — an ES module exporting `meta` + `render(container, ctx)`.
  Conforms to the [hub-pod app interface](https://github.com/solid-apps/hub).
- **`@type: urn:Pane`** — an ES module exporting `canHandle` + `render`,
  conforming to [SLIP-48](https://solid-lite.github.io/slips/blob/gh-pages/48.md).

## Submitting an entry

1. Fork this repo.
2. Add an object to the `schema:itemListElement` array in `index.json`.
3. Required fields:
   - `@type`: `urn:App` or `urn:Pane`
   - `@id`: the absolute URL to your ES module
   - `schema:name`: human-readable name (≤ 60 chars)
   - `schema:description`: one-sentence summary (≤ 280 chars)
   - `schema:icon`: an emoji or short glyph
   - `schema:author`: your name or handle
   - `schema:license`: SPDX identifier (e.g. `MIT`, `AGPL-3.0`, `Apache-2.0`)
   - `schema:codeRepository`: URL to the source repo
4. Optional:
   - `urn:forClass` (panes only): the RDF class IRI your pane handles
5. Open a PR. CI will validate the JSON; a maintainer reviews the entry.

## What gets accepted

- The module URL must be reachable (CI pings it).
- The license must be open-source (any OSI-approved SPDX identifier).
- The code repository must be public.
- We may decline entries that look like spam, reimplement existing entries
  without meaningful difference, or include obvious malware.

## What apps and panes can do

Apps and panes are loaded as ES modules with **full DOM and authenticated-fetch
access** in the host. There is no sandbox. Users see a confirmation dialog
before any non-allow-listed origin loads. This is by design — Solid hosts trust
their users to vet the URLs they install — but it means that:

- Submitted code should not require runtime tracking, ads, or remote logging.
- Submitted code should not exfiltrate user data to third parties.
- License must permit redistribution (the registry is replicable).

If you find an entry that violates these, open an issue.

## Local validation

```sh
node -e "JSON.parse(require('fs').readFileSync('index.json','utf8')); console.log('valid')"
```

## License

The registry data itself is CC0. Entry contributors retain copyright over
their own code; license per-entry as declared.
