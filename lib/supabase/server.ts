import { createClient } from '@supabase/supabase-js';

// Server-only client — uses the service role key, bypasses RLS.
// NEVER import this from a client component or expose the key to the browser.
// Only use inside app/api/** route handlers, gated by admin auth.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}
