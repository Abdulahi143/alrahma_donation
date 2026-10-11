import { createBrowserClient } from '@supabase/ssr';

// Browser client — uses the public publishable key, subject to Row Level Security.
// Stores the auth session in cookies so middleware and API routes can read it.
// Safe to import from client components.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
