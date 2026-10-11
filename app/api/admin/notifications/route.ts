import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const db = supabaseAdmin();
  const results = await Promise.all([
    db.from('notification_queue').select('*, donors(full_name), donations(amount_sek, reference), payment_plans(total_amount_sek, reference)').order('created_at', { ascending: false }).limit(50),
    db.from('notification_templates').select('*').order('id'),
    db.from('notification_logs').select('*').order('created_at', { ascending: false }).limit(50)
  ]);
  if (results.some(r => r.error)) return NextResponse.json({ error: 'Notification database is not ready.' }, { status: 503 });
  return NextResponse.json({ sendingEnabled: false, queue: results[0].data, templates: results[1].data, logs: results[2].data });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const { data, error } = await supabaseAdmin().rpc('queue_pledge_reminders');
  if (error) return NextResponse.json({ error: 'Could not queue reminders.' }, { status: 503 });
  return NextResponse.json({ queued: data, sendingEnabled: false });
}
