import Link from 'next/link';
import { PageHead } from '@/components/admin/ui';
import { stockholmToday } from '@/lib/admin/dates';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth';
import NewTransactionForm from './NewTransactionForm';

export default async function NewTransaction() {
  const db = supabaseAdmin();
  const user = await getAdminUser();
  const [{ data: campaigns }, { data: donors }, { data: inst }] = await Promise.all([
    db.from('campaigns').select('id, title').in('status', ['published', 'paused', 'draft']).order('created_at', { ascending: false }),
    db.from('donor_profiles').select('id, full_name').is('anonymized_at', null).order('full_name'),
    db
      .from('installment_balances')
      .select('installment_id, campaign_id, seq, due_on, outstanding_sek, pledge:pledges(donor:donor_profiles(full_name))')
      .eq('pledge_status', 'active')
      .gt('outstanding_sek', 0)
      .order('due_on')
  ]);

  const installments = (inst ?? []).map((i) => {
    const donor = (i.pledge as unknown as { donor: { full_name: string } } | null)?.donor?.full_name ?? '';
    return { id: i.installment_id as string, campaign_id: i.campaign_id as string, label: `${donor}, delbetalning ${i.seq}, förfaller ${i.due_on}, ${i.outstanding_sek} kr kvar` };
  });

  return (
    <div>
      <PageHead title="Registrera gåva" sub="För kontanter och banköverföringar. Gåvan räknas inte med förrän en annan admin har godkänt den." action={<Link href="/admin/transaktioner" className="text-sm font-bold underline">Tillbaka</Link>} />
      <NewTransactionForm campaigns={campaigns ?? []} donors={donors ?? []} installments={installments} today={stockholmToday()} me={user?.name ?? ''} />
    </div>
  );
}
