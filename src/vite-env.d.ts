/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key. Public by design; the secret key never goes to the browser. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** Set to "1" only to try a production build locally with the development key (npm run preview). */
  readonly VITE_CLERK_ALLOW_DEV_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
