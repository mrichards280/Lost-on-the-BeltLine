import { createClient } from '@supabase/supabase-js';

// Anon client for the browser. Read-only in practice: RLS grants anon `select`
// on challenges and claims and nothing else, so this is only used for the
// challenge picker and the Realtime leaderboard subscription.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
