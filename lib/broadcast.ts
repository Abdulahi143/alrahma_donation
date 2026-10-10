// Thin, swappable senders for the admin Broadcast tab. Each function returns
// { simulated: true } and does nothing real if its provider env vars are
// missing, so the feature works end-to-end in dev without any account setup.
// Wire a real provider by setting the env vars in .env.local — no other
// code needs to change.

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; simulated: boolean; error?: string }> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { ok: true, simulated: true };
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body })
  });

  if (!res.ok) return { ok: false, simulated: false, error: await res.text() };
  return { ok: true, simulated: false };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; simulated: boolean; error?: string }> {
  const { RESEND_API_KEY, BROADCAST_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY) {
    return { ok: true, simulated: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: BROADCAST_FROM_EMAIL || 'updates@alrahmamosque.se',
      to,
      subject,
      text: body
    })
  });

  if (!res.ok) return { ok: false, simulated: false, error: await res.text() };
  return { ok: true, simulated: false };
}
