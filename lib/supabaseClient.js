import { createClient } from '@supabase/supabase-js';

// Anon client for the browser. Read-only in practice: RLS grants anon `select`
// on challenges and claims and nothing else, so this is only used for the
// challenge picker and the Realtime leaderboard subscription.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Without this, a missing variable surfaces as "supabaseUrl is required" from
// deep inside a Next build trace, which says nothing about which variable or
// where to set it.
if (!supabaseUrl || !anonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set ' +
      '(Netlify environment variables, or .env.local for local development)'
  );
}

export const supabase = createClient(supabaseUrl, anonKey);
