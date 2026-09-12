import { createClient } from '@supabase/supabase-js';

// Service-role client. Server-side only — it bypasses RLS, so it must never be
// imported into anything that ships to the browser. Every write in the app
// (teams, claims, merch) goes through this client from an API route.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
