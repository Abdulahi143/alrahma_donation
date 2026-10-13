import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notificationSendingEnabled } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const db = supabaseAdmin();
  const results = await Promise.all([
    db.from('notification_queue').select('*, donors(full_name), donations(amount_sek, reference), payment_plans(total_amount_sek, reference)').in('template_id', ['payment_confirmed', 'pledge_reminder']).order('created_at', { ascending: false }).limit(50),
    db.from('notification_templates').select('*').in('id', ['payment_confirmed', 'pledge_reminder']).order('id'),
    db.from('notification_logs').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('whatsapp_delivery_events').select('provider_message_id,status,occurred_at,error_code').order('occurred_at', { ascending: false }).limit(50)
  ]);
  if (results.slice(0, 3).some(r => r.error)) return NextResponse.json({ error: 'Notification database is not ready.' }, { status: 503 });
  const deliveries = results[3].data || [];
  const queue = (results[0].data || []).map(entry => ({ ...entry, delivery_status: deliveries.find(event => event.provider_message_id === entry.provider_message_id)?.status }));
  return NextResponse.json({ sendingEnabled: notificationSendingEnabled(), deliveryReady: !results[3].error, webhookConfigured: !!(process.env.META_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), queue, templates: results[1].data, deliveries });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const { data, error } = await supabaseAdmin().rpc('queue_pledge_reminders');
  if (error) return NextResponse.json({ error: 'Could not queue reminders.' }, { status: 503 });
  return NextResponse.json({ queued: data, sendingEnabled: notificationSendingEnabled() });
}
