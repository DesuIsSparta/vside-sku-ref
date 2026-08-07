# vSide Sku Ref

A fast, filterable reference browser for every vSide SKU — meshes, furnishings,
badges, swatches, tokens, floorplans, and services. Built with Vite and
TypeScript, no framework, virtualized for 10,000+ items.

Live site: https://desuissparta.github.io/vside-sku-ref/

## Development

```bash
npm install
npm run dev
```

## Building for GitHub Pages

The site builds straight into `docs/`, which GitHub Pages serves from on the
`master` branch.

```bash
npm run build
```

`docs/` is committed to the repo — it is the deployed output, not a build
cache.

## Regenerating the dataset

The shipped dataset (`public/data/skus.json`) and thumbnails
(`public/img/skus/`) are generated from two sibling projects, not part of this
repo:

- [`vside-sku-parser-rs`](../vside-sku-parser-rs) exports `skus.json`, the raw
  SKU data.
- [`vside-discord-bot-rs`](../vside-discord-bot-rs) has generated furnishing
  thumbnails under `assets/furnishings/` (resized to 128x128 and copied into
  `public/img/skus/` — see git history for the resize step).

To rebuild `public/data/skus.json` after `skus.json` changes:

```bash
npm run data
```

This reads `../vside-sku-parser-rs/skus.json`, cross-references
`public/img/skus/` to mark which SKUs have a real thumbnail, and writes the
compact dataset the app fetches at runtime. SKUs without a thumbnail file
(mostly tokens, badges, swatches, floorplans, and a handful of meshes/
furnishings) fall back to an inline SVG placeholder icon per SKU type — no
extra image requests.

## Architecture

- `src/data.ts` — fetches and types the dataset, derives filter facets once.
- `src/state.ts` — small pub/sub store for filters, search, and sort.
- `src/filters.ts` — pure filter/sort functions over the in-memory dataset.
- `src/virtualGrid.ts` — hand-rolled windowed grid renderer (only visible rows
  are in the DOM at any time, so scrolling stays smooth over 10k+ cards).
- `src/card.ts` / `src/placeholder.ts` — SKU card rendering and the inline SVG
  placeholder icons.
- `src/filterPanel.ts` — the filter sidebar UI.
- `src/modal.ts` — the SKU detail modal.
