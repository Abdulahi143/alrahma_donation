import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kontrollera ditt val.' }, { status: 400 }); }
  if (typeof body?.paused !== 'boolean') return NextResponse.json({ error: 'Kontrollera ditt val.' }, { status: 400 });
  const { error } = await supabaseAdmin().rpc('set_notification_pause', { paused: body.paused });
  if (error) return NextResponse.json({ error: 'Pausen kunde inte ändras. Kontrollera databasuppdateringen.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
