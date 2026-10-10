import { createClient } from '@supabase/supabase-js';

// Browser client — uses the public anon key, subject to Row Level Security.
// Safe to import from client components.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
