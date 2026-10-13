import Link from 'next/link';
import { Card, GoalBars, PageHead, Pill } from '@/components/admin/ui';
import { daysBetween, fmtDate } from '@/lib/admin/dates';
import { METHOD_SV, TX_STATUS_SV } from '@/lib/admin/labels';
import { getOverview } from '@/lib/admin/queries';
import { fmtSEK } from '@/lib/format';

export default async function Overview() {
  const o = await getOverview();
  const { kpi, todo } = o;

  const tasks = [
    todo.awaitingApproval && { n: todo.awaitingApproval, text: 'manuella transaktioner väntar på godkännande', href: '/admin/transaktioner?status=awaiting_approval' },
    todo.overdueInstallments && { n: todo.overdueInstallments, text: 'förfallna delbetalningar på löften', href: '/admin/loften?status=overdue' },
    todo.stuckPayments && { n: todo.stuckPayments, text: 'onlinebetalningar har väntat i över 1 timme', href: '/admin/transaktioner?status=pending_provider' }
  ].filter(Boolean) as { n: number; text: string; href: string }[];

  const tiles = [
    { label: 'Idag', value: fmtSEK(kpi.today), href: '/admin/transaktioner?period=today' },
    { label: 'Senaste 7 dagarna', value: fmtSEK(kpi.d7), href: '/admin/transaktioner?period=7' },
    { label: 'Senaste 30 dagarna', value: fmtSEK(kpi.d30), href: '/admin/transaktioner?period=30' },
    { label: 'Totalt insamlat', value: fmtSEK(kpi.total), href: '/admin/transaktioner?status=confirmed' },
    { label: 'Antal gåvor', value: String(kpi.gifts), href: '/admin/transaktioner?status=confirmed' },
    { label: 'Snittgåva', value: fmtSEK(kpi.average), href: '/admin/transaktioner?status=confirmed' }
  ];
  const methods = Object.entries(kpi.byMethod).sort((a, b) => b[1] - a[1]);
  const methodTotal = methods.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      <PageHead title="Översikt" sub="Hur det går just nu, och vad som behöver göras." />

      {tasks.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <h2 className="mb-2 text-base font-extrabold text-amber-900">Att göra</h2>
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="flex items-center gap-3 rounded-lg px-1 py-1 text-sm font-semibold text-amber-900 hover:underline">
                  <span className="grid h-7 min-w-7 place-items-center rounded-full bg-amber-400 px-2 text-xs font-bold text-amber-950">{t.n}</span>
                  {t.text}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-extrabold">Aktiva kampanjer</h2>
      {o.active.length === 0 ? (
        <Card className="mb-6 text-sm text-mosque-ink/60">
          Ingen kampanj är publicerad. <Link href="/admin/kampanjer" className="font-bold text-mosque-emerald underline">Gå till Kampanjer</Link> för att skapa eller publicera en.
        </Card>
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {o.active.map(({ campaign: c, stats }) => {
            const left = c.ends_on ? daysBetween(o.today, c.ends_on) : null;
            return (
              <Card key={c.id}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/admin/kampanjer/${c.id}`} className="text-lg font-extrabold hover:underline">{c.title}</Link>
                  <span className="text-sm text-mosque-ink/60 tabular-nums">Mål {fmtSEK(c.goal_sek)}</span>
                </div>
                <GoalBars confirmed={stats.confirmed_sek} pledged={stats.pledged_outstanding_sek} goal={c.goal_sek} />
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-mosque-ink/70">
                  <span><b className="text-mosque-ink">{stats.donors}</b> givare</span>
                  <span>{left === null ? 'Inget slutdatum' : left >= 0 ? <><b className="text-mosque-ink">{left}</b> dagar kvar</> : 'Slutdatum passerat'}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="min-w-0 rounded-2xl border border-mosque-ink/10 bg-white p-4 hover:border-mosque-emerald">
            <div className="text-xs font-bold uppercase tracking-wide text-mosque-ink/50">{t.label}</div>
            <div className="mt-2 break-words text-xl font-extrabold tabular-nums text-mosque-emerald">{t.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="mb-1 text-base font-extrabold">Betalsätt</h2>
          <p className="mb-3 text-xs text-mosque-ink/50">Senaste 30 dagarna</p>
          {methods.length === 0 ? (
            <p className="text-sm text-mosque-ink/50">Inga bekräftade gåvor än.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {methods.map(([m, v]) => (
                <li key={m}>
                  <Link href={`/admin/transaktioner?method=${m}&period=30`} className="block">
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="font-semibold">{METHOD_SV[m] ?? m}</span>
                      <span className="tabular-nums">{fmtSEK(v)} · {Math.round((v / methodTotal) * 100)} %</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-mosque-ink/10"><div className="h-full bg-mosque-emerald" style={{ width: `${(v / methodTotal) * 100}%` }} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-extrabold">Senaste 10 transaktionerna</h2>
          {o.recent.length === 0 ? (
            <p className="text-sm text-mosque-ink/50">Inga transaktioner än. De dyker upp här när den första gåvan kommer in.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <tbody>
                  {o.recent.map((t) => (
                    <tr key={t.id} className="border-t border-mosque-ink/10 first:border-0">
                      <td className="py-2 pr-3 text-mosque-ink/60">{fmtDate(t.received_on)}</td>
                      <td className="py-2 pr-3 font-bold tabular-nums">{fmtSEK(t.amount_sek)}</td>
                      <td className="py-2 pr-3">{t.display_name ?? 'Anonym'}<div className="text-xs text-mosque-ink/50">{t.campaign?.title}</div></td>
                      <td className="py-2 pr-3">{METHOD_SV[t.method]}</td>
                      <td className="py-2">
                        <Pill tone={t.status === 'confirmed' ? 'green' : t.status === 'rejected' || t.status === 'refunded' ? 'grey' : 'amber'}>{TX_STATUS_SV[t.status]}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
