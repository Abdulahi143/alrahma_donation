import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Gate every /api/admin/** route with a real Supabase Auth session, and
// check the caller is in the "admins" table. Wire up Supabase Auth
// (email/password or magic link) for staff login, then seed the admins
// table with their user ids.
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies }
  );

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  return null;
}
