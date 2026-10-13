import Link from 'next/link';
import { PageHead } from '@/components/admin/ui';
import { stockholmToday } from '@/lib/admin/dates';
import { supabaseAdmin } from '@/lib/supabase/server';
import PledgeForm from './PledgeForm';

export default async function NewPledge() {
  const db = supabaseAdmin();
  const [{ data: campaigns }, { data: donors }] = await Promise.all([
    db.from('campaigns').select('id, title').in('status', ['published', 'paused', 'draft']).order('created_at', { ascending: false }),
    db.from('donor_profiles').select('id, full_name').is('anonymized_at', null).order('full_name')
  ]);
  return (
    <div>
      <PageHead title="Nytt löfte" sub="Delbetalningarna räknas ut automatiskt. Du kan ändra datum och belopp innan du sparar." action={<Link href="/admin/loften" className="text-sm font-bold underline">Tillbaka</Link>} />
      <PledgeForm campaigns={campaigns ?? []} donors={donors ?? []} today={stockholmToday()} />
    </div>
  );
}
