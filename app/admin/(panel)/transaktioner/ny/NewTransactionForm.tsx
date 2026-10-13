'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createManualTransaction } from '../actions';

const input = 'w-full rounded-lg border border-mosque-ink/15 bg-white px-3 py-2.5 text-sm';
const label = 'mb-1.5 block text-xs font-bold text-mosque-ink/60';

export default function NewTransactionForm({
  campaigns,
  donors,
  installments,
  today,
  me
}: {
  campaigns: { id: string; title: string }[];
  donors: { id: string; full_name: string }[];
  installments: { id: string; campaign_id: string; label: string }[];
  today: string;
  me: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? '');

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createManualTransaction(fd);
      if (!res.ok) return setError(res.error);
      router.push('/admin/transaktioner?status=awaiting_approval');
      router.refresh();
    });
  };

  if (campaigns.length === 0) {
    return <div className="rounded-2xl border border-mosque-ink/10 bg-white p-5 text-sm">Skapa en kampanj först under Kampanjer.</div>;
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-mosque-ink/10 bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="amount_sek">Belopp (kr)</label>
          <input id="amount_sek" name="amount_sek" type="number" min={1} step={1} inputMode="numeric" required className={input} />
        </div>
        <div>
          <label className={label} htmlFor="received_on">Mottagen</label>
          <input id="received_on" name="received_on" type="date" required defaultValue={today} max={today} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="campaign_id">Kampanj</label>
          <select id="campaign_id" name="campaign_id" required className={input} value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="method">Betalsätt</label>
          <select id="method" name="method" required className={input} defaultValue="cash">
            <option value="cash">Kontant</option>
            <option value="bank_transfer">Banköverföring</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="receipt_no">Kvittonummer</label>
          <input id="receipt_no" name="receipt_no" maxLength={40} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="received_by_name">Mottagen av</label>
          <input id="received_by_name" name="received_by_name" maxLength={60} defaultValue={me} className={input} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="display_name">Förnamn (visas publikt)</label>
          <input id="display_name" name="display_name" maxLength={40} placeholder="Lämna tomt för Anonym" className={input} />
          <p className="mt-1 text-xs text-mosque-ink/50">Bara förnamn. Efternamn sparas aldrig här.</p>
        </div>
        <div>
          <label className={label} htmlFor="donor_id">Givare (valfritt)</label>
          <select id="donor_id" name="donor_id" className={input} defaultValue="">
            <option value="">Ingen kopplad givare</option>
            {donors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="installment_id">Gäller delbetalning på ett löfte (valfritt)</label>
        <select id="installment_id" name="installment_id" className={input} defaultValue="">
          <option value="">Nej, vanlig gåva</option>
          {installments.filter((i) => i.campaign_id === campaign).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-lg bg-mosque-emerald px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Sparar…' : 'Skicka för godkännande'}</button>
        <button type="button" onClick={() => router.push('/admin/transaktioner')} className="rounded-lg bg-mosque-ink/10 px-5 py-2.5 text-sm font-bold">Avbryt</button>
      </div>
    </form>
  );
}
