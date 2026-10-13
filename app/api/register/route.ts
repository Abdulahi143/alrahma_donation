import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateRegistration } from '@/lib/registration';
import { registrationIssues } from '@/lib/registration-errors';

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid' }, { status: 400 }); }
  const payload = validateRegistration(body);
  if (!payload) return NextResponse.json({ error: 'invalid', issues: registrationIssues(body) }, { status: 400 });
  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  try {
    const { data, error } = await supabaseAdmin().rpc('register_donation', { payload });
    if (error) {
      console.error('Registration failed:', error.code);
      return NextResponse.json({ error: 'unavailable' }, { status: error.code === 'P0002' ? 409 : 503 });
    }
    return NextResponse.json({ ok: true, reference: data.reference, status: data.status }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
