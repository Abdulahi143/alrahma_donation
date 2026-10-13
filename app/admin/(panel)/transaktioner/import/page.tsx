import Link from 'next/link';
import { PageHead } from '@/components/admin/ui';
import { supabaseAdmin } from '@/lib/supabase/server';
import ImportClient from './ImportClient';

export default async function ImportPage() {
  const { data: campaigns } = await supabaseAdmin().from('campaigns').select('id, title').order('created_at', { ascending: false });
  return (
    <div>
      <PageHead title="Importera CSV" sub="Ladda upp en fil, koppla kolumnerna och granska förhandsvisningen. Importerade rader väntar på godkännande av en annan admin." action={<Link href="/admin/transaktioner" className="text-sm font-bold underline">Tillbaka</Link>} />
      <ImportClient campaigns={campaigns ?? []} />
    </div>
  );
}
