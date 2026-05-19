import { defineConfig } from 'vite';

// For recon.segunzubair.com or a user/organization GitHub Pages site, keep base as '/'.
// If publishing as https://szubair22.github.io/<repo-name>/, change this to '/<repo-name>/'.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022'
  }
});
