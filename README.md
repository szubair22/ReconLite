# ReconLite Phase 1

Browser-only GL to subledger reconciliation prototype using DuckDB-WASM and Vite.

## Phase 1 scope

- Upload GL detail CSV
- Upload subledger CSV
- Load both files into DuckDB-WASM in the browser
- Preview the first five rows of each file
- Select account and amount columns
- Run balance summaries by account
- Compare GL balance to subledger balance by account

## Privacy model

No backend, no database server, no file uploads, no analytics, no localStorage, no IndexedDB, and no OPFS in this first draft. Files are held in memory only during the browser session.

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

## GitHub Pages

For a custom subdomain such as `recon.segunzubair.com`, keep `base: '/'` in `vite.config.ts`.

For a GitHub project page such as `https://szubair22.github.io/recon-lite/`, set:

```ts
export default defineConfig({
  base: '/recon-lite/'
});
```

Then set GitHub Pages to deploy from GitHub Actions.
