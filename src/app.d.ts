/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }

  interface ImportMetaEnv {
    readonly PUBLIC_GITHUB_CLIENT_ID?: string;
    readonly PUBLIC_DATA_REPO?: string;
    readonly PUBLIC_RECEIPT_PUBKEY?: string;
    readonly PUBLIC_WORKER_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module '*.yaml' {
  const value: unknown;
  export default value;
}

export {};
