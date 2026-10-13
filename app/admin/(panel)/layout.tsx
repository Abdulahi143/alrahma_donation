import { redirect } from 'next/navigation';
import AdminNav, { NavGroup } from '@/components/admin/AdminNav';
import { getAdminUser } from '@/lib/auth';
import { getTodoCounts } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect('/admin/login');

  const todo = await getTodoCounts();
  const groups: NavGroup[] = [
    { items: [{ href: '/admin', label: 'Översikt', icon: 'overview' }] },
    {
      title: 'Insamling',
      items: [
        { href: '/admin/kampanjer', label: 'Kampanjer', icon: 'campaigns' },
        { href: '/admin/transaktioner', label: 'Transaktioner', icon: 'transactions', badge: todo.awaitingApproval + todo.stuckPayments },
        { href: '/admin/loften', label: 'Löften', icon: 'pledges', badge: todo.overdueInstallments }
      ]
    },
    {
      title: 'Givare',
      items: [
        { href: '/admin/givare', label: 'Givare', icon: 'donors' },
        { href: '/admin/utskick', label: 'Utskick', icon: 'messages' }
      ]
    },
    { title: 'Ekonomi', items: [{ href: '/admin/rapporter', label: 'Rapporter & avstämning', icon: 'reports' }] },
    {
      title: 'Inställningar',
      items: [
        { href: '/admin/betalsatt', label: 'Betalsätt', icon: 'payments' },
        { href: '/admin/anvandare', label: 'Användare & roller', icon: 'users' },
        { href: '/admin/logg', label: 'Logg', icon: 'log' }
      ]
    }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-mosque-cream text-mosque-ink lg:flex-row">
      <AdminNav groups={groups} userName={user.name} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  );
}
