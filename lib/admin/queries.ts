import { supabaseAdmin } from '@/lib/supabase/server';
import { addDays, stockholmToday } from './dates';
import { Campaign, CampaignStats } from './types';

const ONE_HOUR_MS = 3600_000;

// Things waiting for a person. Shared by the sidebar badges and "Att göra".
export async function getTodoCounts() {
  const db = supabaseAdmin();
  const today = stockholmToday();
  const stuckBefore = new Date(Date.now() - ONE_HOUR_MS).toISOString();

  const [awaiting, stuck, overdue] = await Promise.all([
    db.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_approval'),
    db.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending_provider').lt('created_at', stuckBefore),
    db
      .from('installment_balances')
      .select('installment_id', { count: 'exact', head: true })
      .eq('pledge_status', 'active')
      .lt('due_on', today)
      .gt('outstanding_sek', 0)
  ]);

  return {
    awaitingApproval: awaiting.count ?? 0,
    stuckPayments: stuck.count ?? 0,
    overdueInstallments: overdue.count ?? 0
  };
}

export async function getCampaignsWithStats(statuses?: string[]) {
  const db = supabaseAdmin();
  let q = db.from('campaigns').select('*').order('created_at', { ascending: false });
  if (statuses) q = q.in('status', statuses);
  const [{ data: campaigns, error }, { data: stats }] = await Promise.all([q, db.from('campaign_stats').select('*')]);
  if (error) throw new Error(error.message);
  const byId = new Map((stats as CampaignStats[] | null)?.map((s) => [s.campaign_id, s]));
  return ((campaigns ?? []) as Campaign[]).map((c) => ({
    campaign: c,
    stats: byId.get(c.id) ?? { campaign_id: c.id, confirmed_sek: 0, gifts: 0, donors: 0, pledged_outstanding_sek: 0 }
  }));
}

export async function getOverview() {
  const db = supabaseAdmin();
  const today = stockholmToday();
  const since30 = addDays(today, -29);
  const since7 = addDays(today, -6);

  const [active, recent, last30, allStats, todo] = await Promise.all([
    getCampaignsWithStats(['published']),
    db
      .from('transactions')
      .select('id, amount_sek, method, status, display_name, received_on, campaign:campaigns(title)')
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('transactions').select('amount_sek, method, received_on').eq('status', 'confirmed').gte('received_on', since30),
    db.from('campaign_stats').select('confirmed_sek, gifts'),
    getTodoCounts()
  ]);

  const rows = last30.data ?? [];
  const sum = (from: string) => rows.filter((r) => r.received_on >= from).reduce((s, r) => s + r.amount_sek, 0);
  const byMethod: Record<string, number> = {};
  for (const r of rows) byMethod[r.method] = (byMethod[r.method] ?? 0) + r.amount_sek;

  const totalSek = (allStats.data ?? []).reduce((s, r) => s + r.confirmed_sek, 0);
  const totalGifts = (allStats.data ?? []).reduce((s, r) => s + r.gifts, 0);

  return {
    today,
    active,
    kpi: {
      today: sum(today),
      d7: sum(since7),
      d30: sum(since30),
      total: totalSek,
      gifts: totalGifts,
      average: totalGifts ? Math.round(totalSek / totalGifts) : 0,
      byMethod
    },
    todo,
    recent: (recent.data ?? []) as unknown as {
      id: string;
      amount_sek: number;
      method: string;
      status: string;
      display_name: string | null;
      received_on: string;
      campaign: { title: string } | null;
    }[]
  };
}

// admin user id -> display name, for "registered by" columns.
export async function getAdminNames(): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin().from('admins').select('user_id, full_name');
  return new Map((data ?? []).map((a) => [a.user_id as string, (a.full_name as string) || 'Admin']));
}
