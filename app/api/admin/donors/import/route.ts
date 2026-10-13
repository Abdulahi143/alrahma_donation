import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Bulk import donors from a CSV parsed client-side into rows of
// { name, phone, email, total, plan }. `total`/`plan` are informational only
// here — real giving totals come from the donations table — so they're
// ignored on import; only name/phone/email are written. Invalid rows are
// skipped and reported back per-row instead of silently dropped.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }

  const skipped: { row: number; reason: string }[] = [];
  const payload: any[] = [];
  const seen = new Set<string>();

  rows.forEach((r, i) => {
    const line = i + 2;
    const name = String(r.name || '').trim();
    const email = String(r.email || '').trim().toLowerCase();
    if (!name) return skipped.push({ row: line, reason: 'Namn saknas' });
    if (!email || !EMAIL_RE.test(email)) return skipped.push({ row: line, reason: 'Ogiltig e-postadress' });
    if (seen.has(email)) return skipped.push({ row: line, reason: 'Dubblett i filen (samma e-post)' });
    seen.add(email);
    payload.push({
      full_name: name,
      email,
      phone: r.phone ? String(r.phone).trim() : null,
      gdpr_consent: true,
      gdpr_consent_at: new Date().toISOString()
    });
  });

  if (!payload.length) {
    return NextResponse.json({ error: 'Every row needs at least name + email', skipped }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('donors').insert(payload).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length || 0, skipped });
}
