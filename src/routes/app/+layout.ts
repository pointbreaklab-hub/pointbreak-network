// The authenticated app is client-only: it reads the user's GitHub token from
// localStorage, so there is nothing meaningful to render on the server.
export const ssr = false;
export const prerender = false;
