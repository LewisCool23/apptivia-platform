import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_KEY || process.env.SUPABASE_KEY;

export const supabaseConfigMissing = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const missingError = {
  message: 'Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.'
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
    getUser: async () => ({ data: { user: null }, error: missingError })
  }
};

export const supabase = supabaseConfigMissing
  ? missingSupabase
  : createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
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
