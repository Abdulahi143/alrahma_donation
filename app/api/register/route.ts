import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Public endpoint: donor self-registration + GDPR consent capture.
// Writes: donors (upsert by email), a pending donation OR payment_plan,
// and an immutable consent_log row.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    fullName,
    email,
    phone,
    amountSek,
    preferredLanguage,
    frequency, // 'onetime' | 'monthly'
    months, // 2 | 6 | 12 | null
    comms, // { email, sms, whatsapp, none }
    gdprConsent
  } = body;

  if (!fullName || !email || !amountSek || !gdprConsent) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  const amount = Number(amountSek);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    return NextResponse.json({ error: 'Invalid donation amount' }, { status: 400 });
  }
  if (frequency === 'monthly' && ![2, 6, 12].includes(Number(months))) {
    return NextResponse.json({ error: 'Invalid plan length' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: donor, error: donorError } = await supabase
    .from('donors')
    .upsert(
      {
        full_name: String(fullName).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone || null,
        preferred_language: preferredLanguage || 'en',
        comm_email: !!comms?.email,
        comm_sms: !!comms?.sms,
        comm_whatsapp: !!comms?.whatsapp,
        comm_opt_out: !!comms?.none,
        gdpr_consent: true,
        gdpr_consent_at: now
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (donorError) {
    return NextResponse.json({ error: donorError.message }, { status: 500 });
  }

  // Consent log is append-only and never updated/deleted alongside the donor
  // record — required to demonstrate consent (GDPR Art. 7).
  await supabase.from('consent_log').insert({
    donor_email: String(email).trim().toLowerCase(),
    consent_text_shown: 'I agree that Al-Rahma Mosque may store my details to process this donation, in line with GDPR.',
    consent_given: true,
    user_agent: req.headers.get('user-agent') || null,
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || null
  });

  if (frequency === 'monthly' && months) {
    const { error: planError } = await supabase.from('payment_plans').insert({
      donor_id: donor.id,
      display_name: String(fullName).trim(),
      total_amount_sek: amount,
      months
    });
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
  } else {
    const { error: donationError } = await supabase.from('donations').insert({
      donor_id: donor.id,
      display_name: String(fullName).trim(),
      amount_sek: amount,
      method: 'card',
      status: 'pending'
    });
    if (donationError) return NextResponse.json({ error: donationError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, donorId: donor.id });
}
