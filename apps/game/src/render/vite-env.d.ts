/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Navigator {
  readonly deviceMemory?: number;
}

// Injected at build time by the SW versioning step
declare const __CACHE_VERSION: string | undefined;
