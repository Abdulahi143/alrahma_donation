import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Admin-only: list donors, or register one manually (e.g. from a paper form).
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('donors')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ donors: data });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { fullName, email, phone } = await req.json();
  if (!fullName || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('donors')
    .insert({ full_name: fullName, email, phone: phone || null, gdpr_consent: true, gdpr_consent_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ donor: data });
}
