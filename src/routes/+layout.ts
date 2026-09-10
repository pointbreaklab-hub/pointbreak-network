// Architectural rule 3: the app is 100% static, no SSR.
// Prerender still runs so every route emits an HTML shell. Without it the
// build has no index.html at all and GitHub Pages has nothing to serve at /.
export const ssr = false;
export const prerender = true;
