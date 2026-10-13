'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Card } from '@/components/admin/ui';
import { refundTransaction } from '../actions';

export default function RefundForm({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = () =>
    start(async () => {
      const res = await refundTransaction(id, reason);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  return (
    <Card>
      <h2 className="mb-2 text-base font-extrabold">Återbetala</h2>
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-lg bg-mosque-ink/10 px-4 py-2 text-sm font-bold">Återbetala gåvan…</button>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="refund-reason" className="text-xs font-bold text-mosque-ink/60">Anledning (krävs, sparas i loggen)</label>
          <textarea id="refund-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          <p className="text-xs text-mosque-ink/50">Det här markerar gåvan som återbetald i systemet. Själva pengarna måste du betala tillbaka via banken eller Swish.</p>
          {error && <div role="alert" className="text-sm font-semibold text-red-700">{error}</div>}
          <div className="flex gap-2">
            <button disabled={pending} onClick={go} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Markera som återbetald</button>
            <button onClick={() => setOpen(false)} className="rounded-lg bg-mosque-ink/10 px-4 py-2 text-sm font-bold">Avbryt</button>
          </div>
        </div>
      )}
    </Card>
  );
}
