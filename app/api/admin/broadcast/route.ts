import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { providerStatus, sendSms, sendEmail, sendWhatsApp } from '@/lib/broadcast';
import { Channel, recipientAddress } from '@/lib/communication';
import { loadBroadcastRecipients } from '@/lib/broadcast-server';

export const maxDuration = 60;
const recipientId = /^(legacy|profile):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const batchIdFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const db = supabaseAdmin();
  const [history, templates, recipients] = await Promise.all([
    db.from('broadcast_log').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('notification_templates').select('id, language, body, provider_name, provider_language').eq('approval_status', 'approved').not('provider_name', 'is', null).not('provider_language', 'is', null),
    loadBroadcastRecipients()
  ]);
  if (history.error || templates.error) return NextResponse.json({ error: 'Utskick är inte redo. Kontrollera databasen.' }, { status: 503 });
  // Templates needing pledge variables belong to the donation notification queue.
  return NextResponse.json({ log: history.data, providers: providerStatus(), recipients, templates: templates.data.filter(t => !t.body.includes('{{')) });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  let input;
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Ogiltigt meddelande.' }, { status: 400 }); }
  const { channel, message, donorIds, templateId, language, batchId } = input || {};
  if (!['sms','email','whatsapp'].includes(channel) || !Array.isArray(donorIds) || !donorIds.length || donorIds.length > 50 || donorIds.some(id => typeof id !== 'string' || !recipientId.test(id)) ||
    typeof batchId !== 'string' || !batchIdFormat.test(batchId) ||
    (channel !== 'whatsapp' && (typeof message !== 'string' || !message.trim() || message.length > (channel === 'sms' ? 480 : 4000)))) {
    return NextResponse.json({ error: 'Välj upp till 50 givare och ange ett giltigt meddelande.' }, { status: 400 });
  }
  const kind = channel as Channel;
  if (!providerStatus()[kind]) return NextResponse.json({ error: `${channel === 'whatsapp' ? 'WhatsApp väntar på Meta och API-inställningar' : 'Leverantören är inte konfigurerad'}. Inget skickades.` }, { status: 503 });
  const db = supabaseAdmin();
  let template = null;
  if (kind === 'whatsapp') {
    const { data, error } = await db.from('notification_templates').select('*').eq('id', templateId || '').eq('language', language || '').eq('approval_status', 'approved').single();
    if (error || !data?.provider_name || !data.provider_language || data.body.includes('{{')) return NextResponse.json({ error: 'Välj en godkänd WhatsApp-mall utan variabler.' }, { status: 400 });
    template = data;
  }
  let donors;
  try { donors = await loadBroadcastRecipients(donorIds); }
  catch { return NextResponse.json({ error: 'Kunde inte läsa givarnas val.' }, { status: 500 }); }
  const addresses = [...new Set(donors.filter(d => kind !== 'whatsapp' || d.preferred_language === language).map(d => recipientAddress(d, kind)).filter((address): address is string => !!address))];
  if (!addresses.length) return NextResponse.json({ error: 'Inga mottagare har valt denna kanal med giltiga kontaktuppgifter.' }, { status: 400 });
  const { data: log, error: logError } = await db.from('broadcast_log').insert({ id: batchId, channel, message: template?.body || message.trim(), recipient_count: addresses.length, simulated: false, status: 'sending' }).select().single();
  if (logError?.code === '23505') return NextResponse.json({ error: 'Utskicket har redan startats. Kontrollera historiken och 46elks innan du försöker igen.' }, { status: 409 });
  if (logError) return NextResponse.json({ error: 'Kunde inte skapa utskicksloggen. Inget skickades.' }, { status: 500 });
  let accepted = 0;
  for (let i = 0; i < addresses.length; i += 10) {
    const results = await Promise.all(addresses.slice(i, i + 10).map(address =>
      kind === 'sms' ? sendSms(address, message.trim()) : kind === 'email' ? sendEmail(address, 'Al-Rahma — donationsuppdatering', message.trim()) : sendWhatsApp(address, template.provider_name, template.provider_language)
    ));
    accepted += results.filter(result => result.ok).length;
  }
  const failed = addresses.length - accepted;
  const { error: auditError } = await db.from('broadcast_log').update({ accepted_count: accepted, failed_count: failed, status: accepted === 0 ? 'failed' : failed ? 'partial' : 'accepted' }).eq('id', log.id);
  return NextResponse.json({ accepted, failed, auditWarning: !!auditError });
}
