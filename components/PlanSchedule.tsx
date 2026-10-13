'use client';
import { useState } from 'react';
import { PaymentPlan } from '@/lib/types';

export default function PlanSchedule({ plan, onSaved }: { plan: PaymentPlan; onSaved: () => void }) {
  const [value, setValue] = useState(plan.first_due_on || '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstDueOn: value || null }) });
      const result = await res.json();
      if (!res.ok) { setNotice(result.error); return; }
      setNotice(value ? 'Förfallodatum sparat.' : 'Planens automatiska påminnelser är avstängda.'); onSaved();
    } catch { setNotice('Kunde inte spara. Försök igen.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="mt-4 space-y-2 rounded-lg bg-mosque-cream p-3">
    <label className="block">Första delbetalningens förfallodatum<input type="date" disabled={busy} value={value} onChange={e => setValue(e.target.value)} className="mt-1 block rounded-lg border p-2" /></label>
    <p className="text-xs">Nästa delbetalning förfaller samma dag varje månad (sista dagen i kortare månader). En påminnelse förbereds efter 7 dagar, högst en per obetald delbetalning. Utan datum skickas inga planpåminnelser.</p>
    <button disabled={busy} className="rounded-lg border bg-white px-3 py-2">{busy ? 'Sparar…' : 'Spara förfallodatum'}</button>
    {notice && <p role="status">{notice}</p>}
  </form>;
}
