/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the ALS-NET inference API. Defaults to http://localhost:8000 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
