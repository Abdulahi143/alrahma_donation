import { Card, PageHead } from '@/components/admin/ui';
import { supabaseAdmin } from '@/lib/supabase/server';

const ACTION_SV: Record<string, string> = {
  'campaign.create': 'Skapade kampanj',
  'campaign.update': 'Ändrade kampanj',
  'campaign.delete': 'Tog bort kampanj',
  'transaction.register': 'Registrerade gåva',
  'transaction.approve': 'Godkände transaktion',
  'transaction.reject': 'Avvisade transaktion',
  'transaction.refund': 'Återbetalade transaktion',
  'transaction.import': 'Importerade transaktioner',
  'pledge.create': 'Skapade löfte',
  'pledge.update': 'Ändrade löfte',
  'pledge.cancel': 'Avbröt löfte'
};

export default async function Log() {
  const { data } = await supabaseAdmin().from('audit_log').select('*').order('at', { ascending: false }).limit(200);
  const rows = data ?? [];

  return (
    <div>
      <PageHead title="Logg" sub="Vem gjorde vad och när. Loggen kan inte ändras eller raderas." />
      {rows.length === 0 ? (
        <Card className="text-sm text-mosque-ink/60">Inget har loggats än. Ändringar i kampanjer dyker upp här.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-mosque-cream text-left text-xs text-mosque-ink/60">
              <tr><th className="p-3">Tid</th><th className="p-3">Användare</th><th className="p-3">Händelse</th><th className="p-3">Ändringar</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-mosque-ink/10 align-top">
                  <td className="whitespace-nowrap p-3 text-mosque-ink/60">{new Date(r.at).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="p-3">{r.user_name}</td>
                  <td className="p-3"><b>{ACTION_SV[r.action] ?? r.action}</b><div className="text-xs text-mosque-ink/50">{r.object_label}</div></td>
                  <td className="p-3">
                    {r.changes && Object.keys(r.changes).length ? (
                      <ul className="space-y-0.5 text-xs">
                        {Object.entries(r.changes as Record<string, { from: unknown; to: unknown }>).map(([k, c]) => (
                          <li key={k}><span className="font-mono text-mosque-ink/60">{k}</span>: <span className="text-red-700 line-through">{String(c.from ?? '–').slice(0, 60)}</span> → <span className="text-emerald-800">{String(c.to ?? '–').slice(0, 60)}</span></li>
                        ))}
                      </ul>
                    ) : <span className="text-mosque-ink/40">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
