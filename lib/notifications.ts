import { supabaseAdmin } from './supabase/server';
import { providerStatus, sendWhatsApp } from './broadcast';
import { recipientAddress } from './communication';

export const notificationSendingEnabled = () => process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true' && providerStatus().whatsapp;
export async function processNotifications() {
  if (!notificationSendingEnabled()) return { accepted: 0, failed: 0, cancelled: 0, disabled: true };
  const db = supabaseAdmin();
  const { data: settings, error: settingsError } = await db.from('campaign_settings').select('is_live').eq('id', 'main').single();
  if (settingsError) throw new Error('Cannot read campaign settings');
  if (!settings.is_live) return { accepted: 0, failed: 0, cancelled: 0, disabled: true };
  const { data: entries, error } = await db.from('notification_queue').select('*').eq('status', 'queued').in('template_id', ['payment_confirmed', 'pledge_reminder']).order('created_at').limit(30);
  if (error) throw new Error('Cannot read notification queue');
  const result = { accepted: 0, failed: 0, cancelled: 0, disabled: false };
  let processed = 0;
  for (const entry of entries || []) {
    if (processed >= 3) break;
    const { data: template, error: templateError } = await db.from('notification_templates').select('*').eq('id', entry.template_id).eq('language', entry.language).single();
    if (templateError) throw new Error('Cannot read message template');
    if (template.approval_status !== 'approved' || !template.provider_name || !template.provider_language) continue;
    // Claim before contacting Meta; simultaneous workers cannot send the same row.
    const { data: claimed, error: claimError } = await db.from('notification_queue').update({ status: 'sending' }).eq('id', entry.id).eq('status', 'queued').select('id').maybeSingle();
    if (claimError) throw new Error('Cannot claim notification');
    if (!claimed) continue;
    processed++;
    const [{ data: donor, error: donorError }, { data: donation, error: donationError }] = await Promise.all([
      db.from('donors').select('*').eq('id', entry.donor_id).maybeSingle(),
      db.from('donations').select('*').eq('id', entry.donation_id).maybeSingle()
    ]);
    // Keep uncertain failures in 'sending' for investigation, never automatic retry.
    if (donorError || donationError) throw new Error('Cannot verify recipient');
    const to = donor && !donor.deleted_at ? recipientAddress(donor, 'whatsapp') : null;
    const eligible = to && donation && donation.donor_id === entry.donor_id && donor.preferred_language === entry.language &&
      (entry.template_id === 'payment_confirmed' ? donation.status === 'confirmed' : donation.status === 'pending' && !donation.payment_plan_id && Date.parse(donation.created_at) <= Date.now() - 7 * 86400000);
    if (!eligible) {
      const { error } = await db.from('notification_queue').update({ status: 'cancelled' }).eq('id', entry.id).eq('status', 'sending');
      if (error) throw new Error('Cannot cancel stale message');
      result.cancelled++; continue;
    }
    const sent = await sendWhatsApp(to!, template.provider_name, template.provider_language, [String(donation.amount_sek), donation.reference]);
    const status = sent.ok && sent.messageId ? 'sent' : sent.ok || sent.error === 'Provider connection failed' ? 'sending' : 'failed';
    const { error: savedError } = await db.from('notification_queue').update({ status, provider_message_id: sent.messageId || null }).eq('id', entry.id).eq('status', 'sending');
    if (savedError) throw new Error('Cannot record provider result');
    if (status === 'sent') result.accepted++; else result.failed++;
  }
  return result;
}
