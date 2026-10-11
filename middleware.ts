import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Protects /admin/** pages: redirects to /admin/login if there's no
// Supabase Auth session. API routes are protected separately in lib/auth.ts.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        values.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      }
    } }
  );
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !req.nextUrl.pathname.startsWith('/admin/login')) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    const redirect = NextResponse.redirect(url);
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*']
};
