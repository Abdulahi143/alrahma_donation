'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { decideTransaction } from './actions';

// Approve / reject for a transaction awaiting approval. The registrant cannot
// approve their own entry (also enforced by the server action and database).
export default function RowActions({ id, own }: { id: string; own: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (d: 'approve' | 'reject') =>
    start(async () => {
      const res = await decideTransaction(id, d);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button disabled={pending || own} onClick={() => decide('approve')} title={own ? 'En annan admin måste godkänna' : undefined} className="rounded-lg bg-mosque-emerald px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
          Godkänn
        </button>
        <button disabled={pending} onClick={() => decide('reject')} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-40">
          Avvisa
        </button>
      </div>
      {own && <span className="text-[11px] text-amber-700">Du registrerade den. En annan admin godkänner.</span>}
      {error && <span role="alert" className="text-[11px] font-semibold text-red-700">{error}</span>}
    </div>
  );
}
