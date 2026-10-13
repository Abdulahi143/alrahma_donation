import { createHmac, timingSafeEqual } from 'node:crypto';

export function validWhatsAppSignature(body: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export function deliveryEvents(body: unknown, phoneId: string) {
  const payload = body as { object?: string; entry?: any[] } | null;
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];
  const events = [];
  for (const entry of payload.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== phoneId) continue;
      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        if (typeof status?.id !== 'string' || status.id.length > 300 || !['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
        const timestamp = Number(status.timestamp);
        if (!Number.isInteger(timestamp) || timestamp <= 0 || timestamp > 8640000000000) continue;
        events.push({ provider_message_id: status.id, status: status.status as string, occurred_at: new Date(timestamp * 1000).toISOString(), error_code: status.status === 'failed' && Number.isInteger(status.errors?.[0]?.code) ? status.errors[0].code as number : null });
      }
    }
  }
  return events;
}
