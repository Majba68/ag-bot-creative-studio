# TRAPO seed catalog generator

`generate-products.mjs` is a dependency-free Node.js 18+ ESM script. It builds the
demonstration product catalog and the local placeholder artwork deterministically
(a seeded PRNG is used throughout; `Math.random` is never called).

## Regenerate

From the repository root:

```bash
node scripts/generate-products.mjs
```

This writes:

- `client/src/data/seedProducts.json` and `server/src/data/seedProducts.json`
- `client/src/data/seedCollections.json` and `server/src/data/seedCollections.json`
- `client/public/products/TRP-*-{main,detail,lifestyle}.svg`
- `client/public/brand/trapo-mascot.jpeg`
- `server/data/trapo/uploads/trapo-mascot.jpeg`

The client and server JSON files are byte-identical copies. Re-running the script
overwrites generated files and removes stale generated SVGs only.

## Verify only

```bash
node scripts/generate-products.mjs --verify
```

Verification parses every JSON file, confirms the copies are byte-identical,
checks exact field sets, unique IDs/names/image paths, and confirms every
referenced SVG exists and is under 12 KB.

## Mascot source

The mascot is copied from `C:\Users\majba\Downloads\IMG_9810.jpeg` by default.
Override the source path if needed:

```bash
TRAPO_MASCOT_SOURCE=/path/to/mascot.jpeg node scripts/generate-products.mjs
```
