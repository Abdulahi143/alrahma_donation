import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Edit or cancel a payment plan.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { displayName, totalAmountSek, months } = await req.json();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('payment_plans')
    .update({ display_name: displayName, total_amount_sek: totalAmountSek, months })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('payment_plans').update({ status: 'cancelled' }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
