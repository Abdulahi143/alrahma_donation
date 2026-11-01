import BroadcastPanel from '@/components/BroadcastPanel';
import { Card, PageHead } from '@/components/admin/ui';
import { getAdminUser } from '@/lib/auth';

export default async function Page() {
  if (!await getAdminUser('owner')) return <div>
    <PageHead title="Utskick" sub="Endast Owner får se mottagare och skicka meddelanden." />
    <Card className="text-sm">Be en Owner att kontakta dig om ett utskick behöver göras.</Card>
  </div>;
  return <BroadcastPanel />;
}
