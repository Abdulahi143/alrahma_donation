import { redirect } from 'next/navigation';
import AdminNav, { NavGroup } from '@/components/admin/AdminNav';
import NotAdmin from '@/components/admin/NotAdmin';
import { getAdminUser, getSessionUser } from '@/lib/auth';
import { getTodoCounts } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect('/admin/login');
  const user = await getAdminUser();
  // Signed in but not on the allow-list: say so, instead of bouncing back to
  // the login page (which looked like "login does nothing").
  if (!user) return <NotAdmin id={session.id} email={session.email} />;

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
