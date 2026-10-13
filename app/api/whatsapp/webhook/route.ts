import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { deliveryEvents, validWhatsAppSignature } from '@/lib/whatsapp-webhook';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!token) return new NextResponse('Connection is not configured', { status: 503 });
  if (params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== token) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(params.get('hub.challenge') || '', { headers: { 'Content-Type': 'text/plain' } });
}
export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !phoneId) return new NextResponse('Connection is not configured', { status: 503 });
  if (Number(req.headers.get('content-length')) > 1048576) return new NextResponse('Too large', { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 1048576) return new NextResponse('Too large', { status: 413 });
  if (!validWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'), secret)) return new NextResponse('Forbidden', { status: 403 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new NextResponse('Invalid request', { status: 400 }); }
  const events = deliveryEvents(body, phoneId);
  if (events.length) {
    const { error } = await supabaseAdmin().from('whatsapp_delivery_events').upsert(events, { onConflict: 'provider_message_id,status,occurred_at', ignoreDuplicates: true });
    if (error) return new NextResponse('Please retry', { status: 503 });
  }
  return NextResponse.json({ received: true });
}
