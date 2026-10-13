import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { providerStatus, sendSms, sendEmail, sendWhatsApp } from '@/lib/broadcast';
import { Channel, recipientAddress } from '@/lib/communication';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const db = supabaseAdmin();
  const [history, templates] = await Promise.all([
    db.from('broadcast_log').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('notification_templates').select('id, language, body, provider_name, provider_language').eq('approval_status', 'approved').not('provider_name', 'is', null).not('provider_language', 'is', null)
  ]);
  if (history.error || templates.error) return NextResponse.json({ error: 'Utskick är inte redo. Kontrollera databasen.' }, { status: 503 });
  // Templates needing pledge variables belong to the donation notification queue.
  return NextResponse.json({ log: history.data, providers: providerStatus(), templates: templates.data.filter(t => !t.body.includes('{{')) });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  let input;
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Ogiltigt meddelande.' }, { status: 400 }); }
  const { channel, message, donorIds, templateId, language } = input || {};
  if (!['sms','email','whatsapp'].includes(channel) || !Array.isArray(donorIds) || !donorIds.length || donorIds.length > 50 || donorIds.some(id => typeof id !== 'string') ||
    (channel !== 'whatsapp' && (typeof message !== 'string' || !message.trim() || message.length > 4000))) {
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
  const { data: donors, error } = await db.from('donors').select('*').in('id', donorIds).is('deleted_at', null);
  if (error) return NextResponse.json({ error: 'Kunde inte läsa givarnas val.' }, { status: 500 });
  const addresses = [...new Set((donors || []).filter(d => kind !== 'whatsapp' || d.preferred_language === language).map(d => recipientAddress(d, kind)).filter((address): address is string => !!address))];
  if (!addresses.length) return NextResponse.json({ error: 'Inga mottagare har valt denna kanal med giltiga kontaktuppgifter.' }, { status: 400 });
  const { data: log, error: logError } = await db.from('broadcast_log').insert({ channel, message: template?.body || message.trim(), recipient_count: addresses.length, simulated: false, status: 'sending' }).select().single();
  if (logError) return NextResponse.json({ error: 'Kunde inte skapa utskicksloggen. Inget skickades.' }, { status: 500 });
  let accepted = 0;
  // Small batches avoid a burst of simultaneous provider calls.
  for (const address of addresses) {
    const result = kind === 'sms' ? await sendSms(address, message.trim()) : kind === 'email' ? await sendEmail(address, 'Al-Rahma — donationsuppdatering', message.trim()) : await sendWhatsApp(address, template.provider_name, template.provider_language);
    if (result.ok) accepted++;
  }
  const failed = addresses.length - accepted;
  const { error: auditError } = await db.from('broadcast_log').update({ accepted_count: accepted, failed_count: failed, status: accepted === 0 ? 'failed' : failed ? 'partial' : 'accepted' }).eq('id', log.id);
  return NextResponse.json({ accepted, failed, auditWarning: !!auditError });
}
