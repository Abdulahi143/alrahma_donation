import { Channel } from './communication';

type Result = { ok: boolean; simulated: false; error?: string; messageId?: string };
export function providerStatus(): Record<Channel, boolean> {
  const e = process.env;
  return {
    sms: !!(e.ELKS_API_USERNAME && e.ELKS_API_PASSWORD && e.ELKS_FROM),
    email: !!(e.RESEND_API_KEY && e.BROADCAST_FROM_EMAIL),
    whatsapp: e.WHATSAPP_ENABLED === 'true' && !!(e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_API_VERSION)
  };
}
async function deliver(url: string, init: RequestInit): Promise<Result> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    let messageId: string | undefined;
    if (response.ok && (url.includes('graph.facebook.com') || url.includes('api.46elks.com'))) {
      try { const data = await response.json(); messageId = url.includes('graph.facebook.com') ? data.messages?.[0]?.id : data.id; } catch {}
    }
    return { ok: response.ok, simulated: false, ...(messageId ? { messageId } : {}), ...(response.ok ? {} : { error: `Provider HTTP ${response.status}` }) };
  } catch { return { ok: false, simulated: false, error: 'Provider connection failed' }; }
}
export async function sendSms(to: string, body: string): Promise<Result> {
  if (!providerStatus().sms) return { ok: false, simulated: false, error: 'SMS provider is not configured' };
  const e = process.env;
  return deliver('https://api.46elks.com/a1/sms', {
    method: 'POST', headers: {
      Authorization: `Basic ${Buffer.from(`${e.ELKS_API_USERNAME}:${e.ELKS_API_PASSWORD}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, body: new URLSearchParams({ to, from: e.ELKS_FROM!, message: body })
  });
}
export async function sendEmail(to: string, subject: string, body: string): Promise<Result> {
  if (!providerStatus().email) return { ok: false, simulated: false, error: 'Email provider is not configured' };
  return deliver('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.BROADCAST_FROM_EMAIL, to, subject, text: body })
  });
}
export async function sendWhatsApp(to: string, template: string, language: string, parameters: string[] = []): Promise<Result> {
  if (!providerStatus().whatsapp) return { ok: false, simulated: false, error: 'WhatsApp is not enabled' };
  const e = process.env;
  return deliver(`https://graph.facebook.com/${e.WHATSAPP_API_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/^\+/, ''), type: 'template', template: { name: template, language: { code: language }, ...(parameters.length ? { components: [{ type: 'body', parameters: parameters.map(text => ({ type: 'text', text })) }] } : {}) } })
  });
}
