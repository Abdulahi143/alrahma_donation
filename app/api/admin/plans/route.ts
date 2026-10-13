import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Admin-only: list payment plans, or create one on a donor's behalf.
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('payment_plans')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { displayName, totalAmountSek, months } = await req.json();
  if (typeof displayName !== 'string' || !displayName.trim() || !Number.isInteger(totalAmountSek) || totalAmountSek < 1 || totalAmountSek > 10000000 || ![2, 6, 12].includes(months) || totalAmountSek % months !== 0) {
    return NextResponse.json({ error: 'Ange ett namn och ett helt belopp som delas jämnt över valda månader.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('payment_plans')
    .insert({ display_name: displayName, total_amount_sek: totalAmountSek, months })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
