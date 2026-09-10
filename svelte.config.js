import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // adapter-static is REQUIRED: GitHub Pages serves flat files, no Node runtime.
    // `fallback` puts us in SPA mode so /app/* routes resolve client-side.
    // GitHub Pages serves 404.html for unknown paths, which is our SPA entry.
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    serviceWorker: {
      // CNAME and dotfiles are deploy metadata, not part of the offline shell.
      // They also aren't always served (Vite's preview refuses dotfiles), and a
      // single 404 in the precache list used to abort the whole install.
      files: (filename) => !filename.startsWith('.') && filename !== 'CNAME'
    },
    alias: {
      $core: 'src/core',
      $extensions: 'src/extensions'
    },
    // Custom domain (pointbreaklab.com) => empty base path.
    // For a github.io/<repo> deploy instead, set: base: '/pointbreak-network'
    paths: {
      base: ''
    }
  }
};

export default config;
