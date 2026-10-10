import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { sendSms, sendEmail } from '@/lib/broadcast';

// Admin-only: send an SMS or email to a chosen set of donors, respecting
// their communication preference and opt-out flag (GDPR purpose limitation —
// see README). Records a count-only entry in broadcast_log; never stores
// the recipient list itself.
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('broadcast_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const { channel, message, donorIds } = await req.json();
  if (!['sms', 'email'].includes(channel) || !message?.trim() || !Array.isArray(donorIds) || !donorIds.length) {
    return NextResponse.json({ error: 'Invalid fields' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: donors, error: donorErr } = await supabase
    .from('donors')
    .select('id, phone, email, comm_sms, comm_email, comm_opt_out')
    .in('id', donorIds)
    .is('deleted_at', null);

  if (donorErr) return NextResponse.json({ error: donorErr.message }, { status: 500 });

  const recipients = (donors || []).filter((d) =>
    channel === 'sms' ? d.phone && d.comm_sms && !d.comm_opt_out : d.email && d.comm_email && !d.comm_opt_out
  );

  const results = await Promise.all(
    recipients.map((d) => (channel === 'sms' ? sendSms(d.phone!, message) : sendEmail(d.email, 'Al-Rahma Mosque update', message)))
  );

  const simulated = results.length === 0 || results.every((r) => r.simulated);

  const { data: logEntry, error: logErr } = await supabase
    .from('broadcast_log')
    .insert({ channel, recipient_count: recipients.length, message, simulated })
    .select()
    .single();

  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });
  return NextResponse.json({ log: logEntry, recipients: recipients.length, simulated });
}
