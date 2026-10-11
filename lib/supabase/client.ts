import { createBrowserClient } from '@supabase/ssr';

// Browser client — uses the public anon key, subject to Row Level Security.
// Safe to import from client components.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
