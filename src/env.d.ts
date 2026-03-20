/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_OPENAI_PROXY_URL?: string;
  readonly VITE_WEATHER_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_MAPTILER_KEY?: string;
  readonly VITE_OFFLINE_TILE_URL?: string;
  readonly VITE_OFFLINE_SOURCE_LAYER?: string;
  readonly VITE_DEV_AUTH_BYPASS?: 'true' | 'false';
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
