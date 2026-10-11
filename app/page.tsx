import { supabaseAdmin } from '@/lib/supabase/server';
import { swishUrl, paypalUrl, qrSvg } from '@/lib/qr';
import TrackerClient from './TrackerClient';

export const revalidate = 0; // always fetch fresh totals

export default async function TrackerPage() {
  const supabase = supabaseAdmin();

  const [{ data: totals }, { data: donations }, { data: settings }] = await Promise.all([
    supabase.from('campaign_totals').select('*').eq('id', 'main').single(),
    supabase
      .from('donations')
      .select('*')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('campaign_settings').select('*').eq('id', 'main').single()
  ]);

  const swish = settings?.swish_number ? swishUrl(settings.swish_number) : null;
  const paypal = settings?.paypal_link ? paypalUrl(settings.paypal_link) : null;
  const qrCodes = {
    swish: swish ? { kind: 'swish' as const, svg: await qrSvg(swish), detail: settings!.swish_number } : undefined,
    paypal: paypal ? { kind: 'paypal' as const, svg: await qrSvg(paypal) } : undefined
  };

  return (
    <TrackerClient
      qrCodes={qrCodes}
      goal={totals?.goal_sek ?? 15000000}
      raised={totals?.raised_sek ?? 0}
      initialDonations={donations ?? []}
      subtitle={null}
      isLive={settings?.is_live ?? true}
      pausedMessage={settings?.paused_message ?? null}
    />
  );
}
