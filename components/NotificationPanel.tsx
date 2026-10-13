'use client';

import { useEffect, useState } from 'react';

type Template = { id: string; language: string; body: string; approval_status: string };
type Entry = {
  id: string; template_id: string; language: string; status: string; delivery_status?: string;
  donors: { full_name: string } | null;
  donations: { amount_sek: number; reference: string } | null;
  payment_plans: { total_amount_sek: number; reference: string } | null;
};
type Data = { queue: Entry[]; templates: Template[]; sendingEnabled: boolean; webhookConfigured: boolean; deliveryReady: boolean; deliveries: { status: string; occurred_at: string; error_code: number | null }[] };
const labels: Record<string, string> = { queued: 'Väntar på utskick', sending: 'Behandlas – kontrollera resultat innan nytt försök', cancelled: 'Avbruten', sent: 'Accepterat av WhatsApp', delivered: 'Levererat', read: 'Läst', failed: 'Misslyckat', draft: 'Väntar på godkännande', approved: 'Godkänd', rejected: 'Avvisad', payment_confirmed: 'Tack för betalningen', pledge_reminder: 'Betalningspåminnelse' };

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
      setNotice(`${result.queued} påminnelser förberedda. De skickas när WhatsApp är klart för utskick.`);
      await load();
    } catch { setError('Kunde inte köa påminnelser.'); }
    finally { setBusy(false); }
  }
  async function send() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/notifications/send', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setNotice(result.disabled ? 'Utskick är inte aktiverade ännu.' : `${result.accepted} accepterade av WhatsApp, ${result.failed} misslyckade eller behöver kontrolleras, ${result.cancelled} avbrutna. Leveransstatus uppdateras när WhatsApp svarar.`);
      await load();
    } catch { setError('Utskicket kunde inte slutföras. Kontrollera meddelandenas status innan du försöker igen.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">WhatsApp-aviseringar</h1>
    <p className="rounded-xl bg-mosque-cream p-4 text-sm">{data?.sendingEnabled ? 'WhatsApp-utskick är aktiverade. Endast godkända meddelanden skickas. Automatiska utskick kräver att driftansvarig aktiverat schemat.' : 'WhatsApp är under uppsättning. Inga automatiska meddelanden skickas ännu.'}</p>
    <p className="text-sm">Ett tack förbereds när betalningen bekräftas. Påminnelser gäller obetalda engångslöften som väntat minst 7 dagar, högst en per löfte. Bara givare som valt WhatsApp får meddelanden.</p>
    <button disabled={busy} onClick={reminders} className="rounded-lg bg-mosque-emerald px-4 py-2 text-white disabled:opacity-50">{busy ? 'Förbereder…' : 'Förbered betalningspåminnelser'}</button>
    {data?.sendingEnabled && <button disabled={busy} onClick={send} className="ml-3 rounded-lg bg-mosque-deep px-4 py-2 text-white disabled:opacity-50">Skicka nästa 3 meddelanden</button>}
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
          <p className="font-bold">{entry.donors?.full_name ?? 'Raderad givare'} · {labels[entry.template_id] || entry.template_id} · {labels[entry.delivery_status || entry.status] || entry.status}</p>
          <p className="mt-2" dir={entry.language === 'ar' ? 'rtl' : 'ltr'}>{preview}</p>
        </article>;
      })}
      <h2 className="font-bold">Mallar</h2>
      {data.templates.map(t => <details key={`${t.id}-${t.language}`} className="rounded-lg border bg-white p-3 text-sm">
        <summary>{labels[t.id] || t.id} · {t.language} · {labels[t.approval_status] || t.approval_status}</summary>
        <p className="mt-2" dir={t.language === 'ar' ? 'rtl' : 'ltr'}>{t.body}</p>
      </details>)}
      <h2 className="font-bold">Leveransstatus</h2>
      <p className="text-sm">{data.webhookConfigured && data.deliveryReady ? 'Anslutningen är förberedd. Leveransbekräftelser visas när Meta är anslutet.' : 'Leveransbekräftelser ansluts under uppsättningen. Administratören behöver inte ändra tekniska inställningar.'}</p>
      {data.deliveries.length === 0 && <p className="text-sm text-mosque-ink/60">Inga leveransbekräftelser ännu.</p>}
      {data.deliveries.map((event, index) => <p key={index} className="text-sm">{labels[event.status]} · {new Date(event.occurred_at).toLocaleString('sv-SE')}{event.status === 'failed' ? ' · Meddelandet kunde inte levereras.' : ''}</p>)}
    </>}
  </section>;
}
