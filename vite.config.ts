import { defineConfig } from 'vite';

// Relative base lets the same dist/ serve from both:
//   - https://szubair22.github.io/ReconLite/  (GitHub Pages project URL)
//   - https://recon.segunzubair.com/          (self-hosted nginx on metal1)
// All asset URLs become relative to index.html. Do not change to '/'.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022'
  }
});
