import { defineConfig } from 'vite';

// Relative base so the bundled assets resolve correctly under the GitHub
// Pages project URL (https://szubair22.github.io/ReconLite/). All asset
// URLs become relative to index.html. Do not change to '/' or the assets
// will 404 on the project page.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022'
  }
});
