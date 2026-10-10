import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Admin-only CSV export. ?type=donations | donors | plans
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const type = req.nextUrl.searchParams.get('type') || 'donations';
  const supabase = supabaseAdmin();

  const table = type === 'donors' ? 'donors' : type === 'plans' ? 'payment_plans' : 'donations';
  const { data, error } = await supabase.from(table).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const csv = toCsv(data || []);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}.csv"`
    }
  });
}
