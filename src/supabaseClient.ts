import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

const SUPABASE_URL = getEnv(['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL', 'SUPABASE_URL']);
const SUPABASE_ANON_KEY = getEnv(['VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_KEY', 'SUPABASE_KEY']);

export const supabaseConfigMissing = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const missingError = {
  message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or legacy REACT_APP_ vars) in your .env file.'
};

const missingQueryBuilder: any = {
  select: () => missingQueryBuilder,
  insert: () => missingQueryBuilder,
  update: () => missingQueryBuilder,
  upsert: () => missingQueryBuilder,
  delete: () => missingQueryBuilder,
  eq: () => missingQueryBuilder,
  neq: () => missingQueryBuilder,
  in: () => missingQueryBuilder,
  lte: () => missingQueryBuilder,
  gte: () => missingQueryBuilder,
  order: () => missingQueryBuilder,
  limit: () => missingQueryBuilder,
  range: () => missingQueryBuilder,
  single: () => missingQueryBuilder,
  maybeSingle: () => missingQueryBuilder,
  on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
  subscribe: () => ({ unsubscribe: () => {} }),
  then: (resolve: any) => Promise.resolve(resolve({ data: null, error: missingError })),
  catch: (reject: any) => Promise.resolve(reject && reject(missingError))
};

const missingSupabase: any = {
  from: () => missingQueryBuilder,
  channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }), subscribe: () => ({ unsubscribe: () => {} }) }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: missingError }),
    getSession: async () => ({ data: { session: null }, error: missingError }),
    onAuthStateChange: (_event: any, _callback: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: missingError }),
  }
};

// ── Resilient in-memory lock ────────────────────────────────────────────────
// Replaces the default Navigator LockManager to avoid 10s timeout errors when
// many concurrent Supabase queries fire (the browser Lock API serialises all
// callers and times out at 10s). This promise-chain mutex has no browser API
// dependency and uses a 30s floor instead.
const lockChains = new Map<string, Promise<void>>();

async function inMemoryLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const previous = lockChains.get(name) ?? Promise.resolve();

  let releaseLock!: () => void;
  const current = new Promise<void>((resolve) => { releaseLock = resolve; });
  lockChains.set(name, current);

  // Wait for the previous holder — use at least 30s timeout
  const timeoutMs = Math.max(acquireTimeout, 30000);
  await Promise.race([
    previous,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`Lock "${name}" acquire timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);

  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

export const supabase = supabaseConfigMissing
  ? missingSupabase
  : createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: { lock: inMemoryLock },
    });
// src/supabaseClient.ts or src/api/user.ts

export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}
