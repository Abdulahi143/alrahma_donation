import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { notificationSendingEnabled, processNotifications } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(authorization) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) return new NextResponse('Forbidden', { status: 403 });
  if (!notificationSendingEnabled()) return NextResponse.json({ disabled: true });
  try {
    const { error } = await supabaseAdmin().rpc('queue_pledge_reminders');
    if (error) throw new Error('Cannot prepare reminders');
    const { error: monthlyError } = await supabaseAdmin().rpc('queue_monthly_reminders');
    if (monthlyError) throw new Error('Cannot prepare monthly reminders');
    return NextResponse.json(await processNotifications());
  } catch { return NextResponse.json({ error: 'Notification processing failed. Inspect pending messages before retrying.' }, { status: 503 }); }
}
