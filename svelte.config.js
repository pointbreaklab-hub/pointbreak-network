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
    // Empty on the apex domain, '/pointbreak-network' on github.io, where
    // Pages serves from a subpath. Getting this wrong does not fail the build,
    // it ships a site whose every internal link 404s, so it is driven by an
    // explicit variable rather than a guess.
    paths: {
      base: (process.env.PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')
    }
  }
};

export default config;
