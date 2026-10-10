import { supabaseAdmin } from '@/lib/supabase/server';
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
    supabase.from('campaign_settings').select('is_live, paused_message, transparency_files').eq('id', 'main').single()
  ]);

  return (
    <TrackerClient
      goal={totals?.goal_sek ?? 15000000}
      raised={totals?.raised_sek ?? 0}
      initialDonations={donations ?? []}
      subtitle={null}
      isLive={settings?.is_live ?? true}
      pausedMessage={settings?.paused_message ?? null}
      transparencyFiles={settings?.transparency_files ?? []}
    />
  );
}
