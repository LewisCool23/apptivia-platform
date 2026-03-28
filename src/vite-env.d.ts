/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SOCKET_IO_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly REACT_APP_SUPABASE_URL?: string;
  readonly REACT_APP_SUPABASE_ANON_KEY?: string;
  readonly REACT_APP_SUPABASE_KEY?: string;
  readonly REACT_APP_SOCKET_IO_URL?: string;
  readonly REACT_APP_BACKEND_URL?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}