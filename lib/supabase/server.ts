import { createClient } from '@supabase/supabase-js';

// Server-only client — uses the service role key, bypasses RLS.
// NEVER import this from a client component or expose the key to the browser.
// Only use inside app/api/** route handlers, gated by admin auth.
export function supabaseAdmin() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Set SUPABASE_SECRET_KEY in .env.local to enable server-side database operations.');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}
