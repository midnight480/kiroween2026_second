/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key. Public by design; the secret key never goes to the browser. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
