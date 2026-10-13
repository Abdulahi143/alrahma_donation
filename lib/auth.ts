import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Gate every /api/admin/** route with a real Supabase Auth session, and
// check the caller is in the "admins" table. Wire up Supabase Auth
// (email/password or magic link) for staff login, then seed the admins
// table with their user ids.
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      }
    } }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  return null;
}

// For server components and server actions (no NextRequest available).
// Returns the signed-in admin, or null if not signed in / not on the allow-list.
export async function getAdminUser(): Promise<{ id: string; name: string } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookies().getAll(), setAll: () => {} } }
  );
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: admin } = await supabase.from('admins').select('user_id, full_name').eq('user_id', user.id).maybeSingle();
  if (!admin) return null;
  return { id: user.id, name: admin.full_name || user.email || 'Admin' };
}

// Signed in at all (admin or not). Used to tell "not logged in" apart from
// "logged in but not on the admins allow-list".
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookies().getAll(), setAll: () => {} } }
  );
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? '' } : null;
}
