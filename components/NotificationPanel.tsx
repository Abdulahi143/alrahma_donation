'use client';

import { useEffect, useState } from 'react';

type Template = { id: string; language: string; body: string; approval_status: string };
type Entry = {
  id: string; template_id: string; language: string; status: string;
  donors: { full_name: string } | null;
  donations: { amount_sek: number; reference: string } | null;
  payment_plans: { total_amount_sek: number; reference: string } | null;
};
type Log = { id: string; queue_id: string; event: string; created_at: string };
type Data = { queue: Entry[]; templates: Template[]; logs: Log[] };

export default function NotificationPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    const res = await fetch('/api/admin/notifications');
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    setData(result);
  }
  useEffect(() => { load().catch(() => setError('Kunde inte läsa aviseringskön.')); }, []);

  async function reminders() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/notifications', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setNotice(`${result.queued} påminnelser köade. Inga meddelanden skickades.`);
      await load();
    } catch { setError('Kunde inte köa påminnelser.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">WhatsApp-aviseringar</h1>
    <p className="rounded-xl bg-amber-100 p-4 text-sm">Utskick är pausade medan Meta-kontot granskas. Mallarna är utkast. Inga meddelanden skickas.</p>
    <p className="text-sm">Löften och verifierade betalningar köas för givare som valt WhatsApp. Påminnelser gäller engångslöften som väntat minst 7 dagar, högst en per löfte.</p>
    <button disabled={busy} onClick={reminders} className="rounded-lg bg-mosque-emerald px-4 py-2 text-white disabled:opacity-50">{busy ? 'Köar…' : 'Köa påminnelser'}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!data && !error && <p>Laddar…</p>}
    {data && <>
      <h2 className="font-bold">Kö och förhandsvisning</h2>
      {data.queue.length === 0 && <p className="text-sm">Kön är tom.</p>}
      {data.queue.map(entry => {
        const template = data.templates.find(t => t.id === entry.template_id && t.language === entry.language);
        const pledge = entry.donations || entry.payment_plans;
        const amount = entry.donations?.amount_sek ?? entry.payment_plans?.total_amount_sek;
        const preview = template?.body.replaceAll('{{amount}}', String(amount ?? '')).replaceAll('{{reference}}', pledge?.reference ?? '');
        return <article key={entry.id} className="rounded-xl border bg-white p-4 text-sm">
          <p className="font-bold">{entry.donors?.full_name ?? 'Raderad givare'} · {entry.language} · {entry.status}</p>
          <p className="mt-2" dir={entry.language === 'ar' ? 'rtl' : 'ltr'}>{preview}</p>
        </article>;
      })}
      <h2 className="font-bold">Mallar</h2>
      {data.templates.map(t => <details key={`${t.id}-${t.language}`} className="rounded-lg border bg-white p-3 text-sm">
        <summary>{t.id} · {t.language} · {t.approval_status}</summary>
        <p className="mt-2" dir={t.language === 'ar' ? 'rtl' : 'ltr'}>{t.body}</p>
      </details>)}
      <h2 className="font-bold">Händelselogg</h2>
      {data.logs.length === 0 && <p className="text-sm">Inga händelser ännu.</p>}
      {data.logs.map(log => <p key={log.id} className="break-all text-xs">{log.event} · {new Date(log.created_at).toLocaleString('sv-SE')} · {log.queue_id}</p>)}
    </>}
  </section>;
}
