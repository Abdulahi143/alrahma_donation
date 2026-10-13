'use client';
import { useState } from 'react';
import { Donor } from '@/lib/types';

export default function DonorNotifications({ donor, onSaved }: { donor: Donor; onSaved: () => void }) {
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function save(action: string) {
    setBusy(true); setNotice('');
    try {
      const res = await fetch(`/api/admin/donors/${donor.id}/notifications`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, donorRequested: requested }) });
      const result = await res.json();
      if (!res.ok) { setNotice(result.error); return; }
      setNotice('Aviseringsvalet är sparat.'); setRequested(false); onSaved();
    } catch { setNotice('Kunde inte spara. Försök igen.'); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 space-y-3 rounded-xl border p-4 text-sm">
    <h3 className="font-bold">Hantera aviseringar</h3>
    <p>{donor.comm_opt_out ? 'Givaren får inga aviseringar.' : donor.reminders_paused ? 'Betalningspåminnelser är pausade. Tackmeddelanden följer givarens val.' : 'Betalningspåminnelser följer givarens val.'}</p>
    {!donor.comm_opt_out && <>
      <button type="button" disabled={busy} onClick={() => save(donor.reminders_paused ? 'resume_reminders' : 'pause_reminders')} className="rounded-lg border px-3 py-2">{donor.reminders_paused ? 'Återuppta påminnelser' : 'Pausa påminnelser'}</button>
      <label className="flex items-start gap-2"><input type="checkbox" disabled={busy} checked={requested} onChange={e => setRequested(e.target.checked)} />Givaren har bett oss att stoppa alla aviseringar.</label>
      <button type="button" disabled={busy || !requested} onClick={() => save('stop_all')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700 disabled:opacity-40">Registrera begäran och stoppa aviseringar</button>
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
