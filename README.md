# ReconLite

ReconLite is a browser-only reconciliation tool for accountants. Drop in a general ledger CSV and a subledger CSV, pick the account and amount columns, and ReconLite groups the two files by account, compares the balances, and tells you which accounts match within your tolerance and which are out of balance. Everything runs locally in your browser using DuckDB-WASM. No file ever leaves your machine.

## Try it

Hosted on GitHub Pages: https://szubair22.github.io/ReconLite/

Allow a few minutes after a push for the GitHub Pages deploy to propagate.

Don't have files handy? Click "Try with sample data" on the upload card and ReconLite will fetch two small CSVs from `public/sample-data/` and run a complete reconciliation end to end.

## Privacy

ReconLite has no backend. There is no upload, no analytics call, no localStorage, no IndexedDB, and no OPFS. CSV files are read with the browser File API and parsed in memory by DuckDB-WASM. Closing the tab clears everything.

## Supported amount formats

ReconLite tolerates the most common US-style accounting amount formats:

- Plain numbers with thousand separators: `1,250.00`
- Currency symbols: `$1,250.00`, `£1,250.00`, `€1,250.00`
- Parentheses for negative: `(1,250.00)` becomes `-1250.00`
- Trailing minus: `1,250.00-` becomes `-1250.00`
- Trailing `CR` (credit): `1,250.00 CR` becomes `-1250.00`
- Trailing `DR` (debit): `1,250.00 DR` becomes `1250.00`

European comma-decimal notation (for example `1.250,00`) is NOT yet supported. If your file uses comma decimals, convert to a period decimal before running. Any row whose amount cannot be parsed is excluded from the balance and counted in the "unparsed rows" warning above the comparison table.

## Sample data

Two small CSVs ship in `public/sample-data/`. The "Try with sample data" button in the app fetches them with relative URLs so they work from the GitHub Pages URL.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

The build emits a static `dist/` folder. `vite.config.ts` sets `base: './'` so all bundled asset URLs resolve correctly under the GitHub Pages project URL.

## License

MIT. See `LICENSE`.
