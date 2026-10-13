import { supabaseAdmin } from './supabase/server';
import { providerStatus, sendWhatsApp } from './broadcast';
import { recipientAddress } from './communication';

export const notificationSendingEnabled = () => process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true' && providerStatus().whatsapp;
export async function processNotifications() {
  if (!notificationSendingEnabled()) return { accepted: 0, failed: 0, cancelled: 0, disabled: true };
  const db = supabaseAdmin();
  const { data: settings, error: settingsError } = await db.from('campaign_settings').select('is_live,notifications_paused').eq('id', 'main').single();
  if (settingsError) throw new Error('Cannot read campaign settings');
  if (!settings.is_live || settings.notifications_paused) return { accepted: 0, failed: 0, cancelled: 0, disabled: true };
  const { data: entries, error } = await db.rpc('pending_whatsapp_notifications');
  if (error) throw new Error('Cannot read notification queue');
  const result = { accepted: 0, failed: 0, cancelled: 0, disabled: false };
  let processed = 0;
  for (const entry of entries || []) {
    if (processed >= 3) break;
    const { data: template, error: templateError } = await db.from('notification_templates').select('*').eq('id', entry.template_id).eq('language', entry.language).single();
    if (templateError) throw new Error('Cannot read message template');
    if (template.approval_status !== 'approved' || !template.provider_name || !template.provider_language) continue;
    const { data: preflightDonor, error: preflightError } = await db.from('donors').select('reminders_paused').eq('id', entry.donor_id).maybeSingle();
    if (preflightError) throw new Error('Cannot check reminder preferences');
    if (entry.template_id !== 'payment_confirmed' && preflightDonor?.reminders_paused) continue;
    // Claim before contacting Meta; simultaneous workers cannot send the same row.
    const { data: claimed, error: claimError } = await db.from('notification_queue').update({ status: 'sending' }).eq('id', entry.id).eq('status', 'queued').select('id').maybeSingle();
    if (claimError) throw new Error('Cannot claim notification');
    if (!claimed) continue;
    processed++;
    const [{ data: donor, error: donorError }, { data: donation, error: donationError }] = await Promise.all([
      db.from('donors').select('*').eq('id', entry.donor_id).maybeSingle(),
      entry.donation_id ? db.from('donations').select('*').eq('id', entry.donation_id).maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);
    // Keep uncertain failures in 'sending' for investigation, never automatic retry.
    if (donorError || donationError) throw new Error('Cannot verify recipient');
    const to = donor && !donor.deleted_at ? recipientAddress(donor, 'whatsapp') : null;
    const { data: currentSettings, error: currentSettingsError } = await db.from('campaign_settings').select('is_live,notifications_paused').eq('id', 'main').single();
    if (currentSettingsError) throw new Error('Cannot check notification pause');
    if (!currentSettings.is_live || currentSettings.notifications_paused || (entry.template_id !== 'payment_confirmed' && donor?.reminders_paused)) {
      const { error } = await db.from('notification_queue').update({ status: 'queued' }).eq('id', entry.id).eq('status', 'sending');
      if (error) throw new Error('Cannot pause notification');
      continue;
    }
    let amount = donation?.amount_sek;
    let reference = donation?.reference;
    let paymentEligible = donation && donation.donor_id === entry.donor_id && (entry.template_id === 'payment_confirmed' ? donation.status === 'confirmed' : donation.status === 'pending' && !donation.payment_plan_id && Date.parse(donation.created_at) <= Date.now() - 7 * 86400000);
    if (entry.template_id === 'plan_reminder') {
      const { data: plan, error: planError } = await db.from('payment_plans').select('donor_id').eq('id', entry.plan_id).maybeSingle();
      const { data: details, error: dueError } = await db.rpc('plan_reminder_details', { target_plan: entry.plan_id, target_installment: entry.installment_number });
      if (planError || dueError) throw new Error('Cannot check installment balance');
      if (details?.waiting && plan?.donor_id === entry.donor_id && to && donor.preferred_language === entry.language) {
        const { error } = await db.from('notification_queue').update({ status: 'queued' }).eq('id', entry.id).eq('status', 'sending');
        if (error) throw new Error('Cannot postpone reminder');
        continue;
      }
      paymentEligible = !!details && plan?.donor_id === entry.donor_id;
      amount = details?.amount; reference = details?.reference;
    }
    const eligible = to && donor.preferred_language === entry.language && paymentEligible && Number.isInteger(amount) && amount > 0 && reference;
    if (!eligible) {
      const { error } = await db.from('notification_queue').update({ status: 'cancelled' }).eq('id', entry.id).eq('status', 'sending');
      if (error) throw new Error('Cannot cancel stale message');
      result.cancelled++; continue;
    }
    if (entry.template_id === 'plan_reminder') {
      const { error } = await db.from('notification_queue').update({ amount_due: amount }).eq('id', entry.id).eq('status', 'sending');
      if (error) throw new Error('Cannot update reminder amount');
    }
    const sent = await sendWhatsApp(to!, template.provider_name, template.provider_language, [String(amount), reference]);
    const status = sent.ok && sent.messageId ? 'sent' : sent.ok || sent.error === 'Provider connection failed' ? 'sending' : 'failed';
    const { error: savedError } = await db.from('notification_queue').update({ status, provider_message_id: sent.messageId || null }).eq('id', entry.id).eq('status', 'sending');
    if (savedError) throw new Error('Cannot record provider result');
    if (status === 'sent') result.accepted++; else result.failed++;
  }
  return result;
}
