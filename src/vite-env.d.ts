/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
  }
}

export {};
