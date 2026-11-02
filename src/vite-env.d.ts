/// <reference types="vite/client" />

interface Window {
  __ENV__?: {
    VITE_APP_PASSWORD?: string;
  };
}

interface ImportMetaEnv {
  readonly VITE_APP_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
