import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Bulk import donations from a CSV parsed client-side into rows of
// { name, amount, method, status, date }. Imported rows land as 'confirmed'
// by default (treat a CSV as already-reconciled records) unless the row's
// status says otherwise. Rows that fail validation are skipped and reported
// back per-row (line number + reason) instead of silently dropped.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }

  const methods = ['cash', 'swish', 'card', 'bank_transfer'];
  const skipped: { row: number; reason: string }[] = [];
  const payload: any[] = [];

  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const name = String(r.name || '').trim();
    const amount = Number(r.amount);
    if (!name) return skipped.push({ row: line, reason: 'Namn saknas' });
    if (!Number.isFinite(amount) || amount <= 0) return skipped.push({ row: line, reason: 'Ogiltigt belopp' });
    if (amount > 10000000) return skipped.push({ row: line, reason: 'Beloppet verkar orimligt högt' });

    const method = String(r.method || 'cash').toLowerCase().replace(' ', '_');
    const status = String(r.status || 'confirmed').toLowerCase();
    payload.push({
      display_name: name,
      amount_sek: amount,
      method: methods.includes(method) ? method : 'cash',
      status: ['pending', 'confirmed', 'rejected'].includes(status) ? status : 'confirmed',
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null
    });
  });

  if (!payload.length) {
    return NextResponse.json({ error: 'Every row needs at least name + a positive amount', skipped }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('donations').insert(payload).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length || 0, skipped });
}
