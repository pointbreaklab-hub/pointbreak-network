import { sveltekit } from '@sveltejs/vite-plugin-svelte';
import yaml from '@rollup/plugin-yaml';
import { defineConfig } from 'vite';

export default defineConfig({
  // yaml() lets extensions import their own manifest.yaml directly,
  // which is what makes auto-discovery work at build time.
  plugins: [yaml(), sveltekit()],
  envPrefix: ['PUBLIC_', 'VITE_'],
  server: {
    port: 5173
  }
});
