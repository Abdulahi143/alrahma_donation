'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { addMonths } from '@/lib/admin/dates';
import { createPledge } from '../actions';

const input = 'w-full rounded-lg border border-mosque-ink/15 bg-white px-3 py-2.5 text-sm';
const label = 'mb-1.5 block text-xs font-bold text-mosque-ink/60';

type Inst = { due_on: string; amount_sek: number };

function schedule(total: number, n: number, start: string): Inst[] {
  if (!(total > 0) || !(n > 0) || !start) return [];
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    due_on: addMonths(start, i),
    // any remainder goes on the last instalment
    amount_sek: i === n - 1 ? total - base * (n - 1) : base
  }));
}

export default function PledgeForm({ campaigns, donors, today }: { campaigns: { id: string; title: string }[]; donors: { id: string; full_name: string }[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? '');
  const [donorId, setDonorId] = useState('');
  const [nd, setNd] = useState({ full_name: '', phone: '', email: '', consent_storage: false, consent_contact: false });
  const [total, setTotal] = useState('');
  const [count, setCount] = useState('6');
  const [custom, setCustom] = useState('3');
  const [startDate, setStartDate] = useState(today);
  const [reminders, setReminders] = useState(true);
  const [edited, setEdited] = useState<Inst[] | null>(null);

  const n = count === 'custom' ? Math.max(1, Math.min(60, Number(custom) || 1)) : Number(count);
  const auto = useMemo(() => schedule(Number(total), n, startDate), [total, n, startDate]);
  const rows = edited && edited.length === auto.length ? edited : auto;
  const sum = rows.reduce((s, r) => s + (Number(r.amount_sek) || 0), 0);

  const setRow = (i: number, patch: Partial<Inst>) => setEdited(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createPledge({
        campaign_id: campaign,
        donor_id: donorId || undefined,
        new_donor: donorId ? undefined : { full_name: nd.full_name, phone: nd.phone || undefined, email: nd.email, consent_storage: nd.consent_storage, consent_contact: nd.consent_contact },
        total_sek: Number(total),
        reminders,
        installments: rows.map((r) => ({ due_on: r.due_on, amount_sek: Number(r.amount_sek) }))
      });
      if (!res.ok) return setError(res.error);
      router.push(`/admin/loften/${res.id}`);
      router.refresh();
    });
  };

  if (campaigns.length === 0) return <div className="rounded-2xl border border-mosque-ink/10 bg-white p-5 text-sm">Skapa en kampanj först under Kampanjer.</div>;

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-mosque-ink/10 bg-white p-5">
        <h2 className="text-base font-extrabold">Givare och kampanj</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="pl-campaign">Kampanj</label>
            <select id="pl-campaign" className={input} value={campaign} onChange={(e) => setCampaign(e.target.value)}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          </div>
          <div>
            <label className={label} htmlFor="pl-donor">Givare</label>
            <select id="pl-donor" className={input} value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              <option value="">Ny givare…</option>
              {donors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
        </div>
        {!donorId && (
          <div className="grid gap-4 rounded-xl bg-mosque-cream p-4 sm:grid-cols-3">
            <div><label className={label} htmlFor="nd-name">Namn</label><input id="nd-name" className={input} value={nd.full_name} onChange={(e) => setNd({ ...nd, full_name: e.target.value })} /></div>
            <div><label className={label} htmlFor="nd-phone">Telefon</label><input id="nd-phone" className={input} inputMode="tel" value={nd.phone} onChange={(e) => setNd({ ...nd, phone: e.target.value })} /></div>
            <div><label className={label} htmlFor="nd-email">E-post</label><input id="nd-email" type="email" className={input} value={nd.email} onChange={(e) => setNd({ ...nd, email: e.target.value })} /></div>
            <label className="flex items-start gap-2 text-sm sm:col-span-3"><input type="checkbox" className="mt-1" checked={nd.consent_storage} onChange={(e) => setNd({ ...nd, consent_storage: e.target.checked })} />Givaren har godkänt att vi sparar namn och kontaktuppgifter (krävs).</label>
            <label className="flex items-start gap-2 text-sm sm:col-span-3"><input type="checkbox" className="mt-1" checked={nd.consent_contact} onChange={(e) => setNd({ ...nd, consent_contact: e.target.checked })} />Givaren har godkänt att vi kontaktar hen om löftet (påminnelser).</label>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-mosque-ink/10 bg-white p-5">
        <h2 className="text-base font-extrabold">Belopp och plan</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={label} htmlFor="pl-total">Totalt belopp (kr)</label><input id="pl-total" type="number" min={1} step={1} inputMode="numeric" required className={input} value={total} onChange={(e) => { setTotal(e.target.value); setEdited(null); }} /></div>
          <div>
            <label className={label} htmlFor="pl-count">Antal delbetalningar</label>
            <select id="pl-count" className={input} value={count} onChange={(e) => { setCount(e.target.value); setEdited(null); }}>
              {['1', '2', '6', '12'].map((c) => <option key={c} value={c}>{c}</option>)}<option value="custom">Annat antal</option>
            </select>
            {count === 'custom' && <input aria-label="Eget antal" type="number" min={1} max={60} className={`${input} mt-2`} value={custom} onChange={(e) => { setCustom(e.target.value); setEdited(null); }} />}
          </div>
          <div><label className={label} htmlFor="pl-start">Första förfallodag</label><input id="pl-start" type="date" required className={input} value={startDate} onChange={(e) => { setStartDate(e.target.value); setEdited(null); }} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />Påminnelse 2 dagar före varje förfallodag (om givaren godkänt kontakt)</label>

        {rows.length > 0 && (
          <div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-mosque-ink/60"><tr><th className="py-1">#</th><th className="py-1">Förfaller</th><th className="py-1">Belopp (kr)</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3 text-mosque-ink/50">{i + 1}</td>
                    <td className="py-1 pr-3"><input aria-label={`Förfallodag ${i + 1}`} type="date" className={input} value={r.due_on} onChange={(e) => setRow(i, { due_on: e.target.value })} /></td>
                    <td className="py-1"><input aria-label={`Belopp ${i + 1}`} type="number" min={1} step={1} className={input} value={r.amount_sek} onChange={(e) => setRow(i, { amount_sek: Number(e.target.value) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`mt-2 text-sm font-semibold ${sum === Number(total) ? 'text-emerald-800' : 'text-red-700'}`}>Summa {sum} kr {sum === Number(total) ? '✓' : `(ska vara ${Number(total) || 0} kr)`}</p>
          </div>
        )}
      </section>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}
      <div className="flex gap-3">
        <button disabled={pending || rows.length === 0 || sum !== Number(total)} className="rounded-lg bg-mosque-emerald px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Sparar…' : 'Spara löftet'}</button>
        <button type="button" onClick={() => router.push('/admin/loften')} className="rounded-lg bg-mosque-ink/10 px-5 py-2.5 text-sm font-bold">Avbryt</button>
      </div>
    </form>
  );
}
