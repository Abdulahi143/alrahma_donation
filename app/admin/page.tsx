'use client';

import { useEffect, useState } from 'react';
import { fmtSEK } from '@/lib/format';
import NotificationPanel from '@/components/NotificationPanel';
import BroadcastPanel from '@/components/BroadcastPanel';
import DonorDetails from '@/components/DonorDetails';
import AdminIcon, { AdminIconName } from '@/components/AdminIcon';
import { donorSummary, notificationChoices, planProgress } from '@/lib/donors';
import { Donation, Donor, PaymentPlan, CampaignSettings } from '@/lib/types';

type Tab = 'overview' | 'donations' | 'donors' | 'pending' | 'plans' | 'broadcast' | 'notifications' | 'settings' | 'reports';

const NAV: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Översikt' },
  { key: 'donations', label: 'Donationslogg' },
  { key: 'donors', label: 'Givare' },
  { key: 'pending', label: 'Väntande godkännanden' },
  { key: 'plans', label: 'Betalningsplaner' },
  { key: 'broadcast', label: 'Utskick' },
  { key: 'notifications', label: 'WhatsApp-aviseringar' },
  { key: 'settings', label: 'Betalkonton' },
  { key: 'reports', label: 'Rapporter' }
];

const STATUS_SV: Record<string, string> = { confirmed: 'bekräftad', pending: 'väntande', rejected: 'avvisad' };
const METHOD_SV: Record<string, string> = { cash: 'Kontant', swish: 'Swish', card: 'Kort', bank_transfer: 'Banköverföring' };

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? ''));
    return obj;
  });
}

function downloadTemplate(type: 'donations' | 'donors') {
  const headers = type === 'donations' ? 'name,amount,method,status,date' : 'name,phone,email,total,plan';
  const blob = new Blob([headers + '\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-template.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function uploadCsv(
  file: File,
  endpoint: string
): Promise<{ imported?: number; error?: string; skipped?: { row: number; reason: string }[] }> {
  const text = await file.text();
  const rows = parseCsv(text);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows })
  });
  return res.json();
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const [dRes, doRes, pRes] = await Promise.all([
      fetch('/api/admin/donations'),
      fetch('/api/admin/donors'),
      fetch('/api/admin/plans')
    ]);
    const [dJson, doJson, pJson] = await Promise.all([dRes.json(), doRes.json(), pRes.json()]);
    setDonations(dJson.donations || []);
    setDonors(doJson.donors || []);
    setPlans(pJson.plans || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const pending = donations.filter((d) => d.status === 'pending');
  const confirmed = donations.filter((d) => d.status === 'confirmed');
  const raised = confirmed.reduce((sum, d) => sum + d.amount_sek, 0);
  const goal = 15000000;
  const pct = Math.min(100, (raised / goal) * 100);

  const approve = async (id: string, status: 'confirmed' | 'rejected') => {
    await fetch(`/api/admin/donations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    refresh();
  };

  return (
    <div className="flex min-h-screen bg-mosque-cream">
      <div className={`flex flex-shrink-0 flex-col gap-0.5 bg-mosque-deep p-3 text-mosque-cream transition-all duration-200 ${sidebarOpen ? 'w-72 p-4' : 'w-16 items-center'}`}>
        <div className={`mb-5 flex items-center border-b border-white/10 pb-5 ${sidebarOpen ? 'justify-between gap-2.5 px-2' : 'flex-col gap-3'}`}>
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Masjid Al-Rahma" className="h-10 w-10 flex-shrink-0" />
            {sidebarOpen && (
              <div>
                <div className="text-sm font-extrabold">Al-Rahma Mosque</div>
                <div className="text-[11px] text-mosque-mint/60">Admin</div>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Stäng sidopanelen' : 'Öppna sidopanelen'}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-mosque-cream/70 hover:bg-white/10"
          >
            <AdminIcon name={sidebarOpen ? 'collapse' : 'expand'} className="h-4 w-4" />
          </button>
        </div>

        {sidebarOpen && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-mosque-mint/50">Administration</p>}
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            title={item.label}
            aria-label={item.label}
            aria-current={tab === item.key ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mosque-gold ${sidebarOpen ? 'px-3' : 'justify-center px-0'} ${
              tab === item.key ? 'bg-white/10 text-white ring-1 ring-white/15 shadow-sm' : 'text-mosque-cream/65 hover:bg-white/5 hover:text-white'
            }`}
          >
            <AdminIcon name={item.key} />
            {sidebarOpen && item.label}
            {sidebarOpen && item.key === 'pending' && pending.length > 0 && <span className="ml-auto rounded-md bg-mosque-gold/20 px-2 py-0.5 text-xs text-mosque-gold">{pending.length}</span>}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
        {loading ? (
          <div className="text-sm text-mosque-ink/50">Laddar…</div>
        ) : (
          <>
            {tab === 'notifications' && <NotificationPanel />}
            {tab === 'overview' && (
              <Overview raised={raised} goal={goal} pct={pct} donorCount={donors.length} pendingCount={pending.length} planCount={plans.length} recent={confirmed.slice(0, 5)} />
            )}
            {tab === 'donations' && <DonationsLog donations={donations} onRefresh={refresh} />}
            {tab === 'donors' && <Donors donors={donors} donations={donations} plans={plans} onRefresh={refresh} />}
            {tab === 'pending' && <Pending pending={pending} onDecide={approve} />}
            {tab === 'plans' && <Plans plans={plans} donations={donations} onRefresh={refresh} />}
            {tab === 'broadcast' && <BroadcastPanel donors={donors} />}
            {tab === 'settings' && <Settings />}
            {tab === 'reports' && <Reports />}
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ raised, goal, pct, donorCount, pendingCount, planCount, recent }: any) {
  const stats = [
    { label: 'Insamlat totalt', value: fmtSEK(raised), color: 'text-mosque-emerald', icon: 'donations' },
    { label: 'Registrerade givare', value: String(donorCount), color: 'text-mosque-ink', icon: 'donors' },
    { label: 'Väntande godkännanden', value: String(pendingCount), color: 'text-amber-600', icon: 'pending' },
    { label: 'Aktiva betalningsplaner', value: String(planCount), color: 'text-mosque-ink', icon: 'plans' }
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold text-mosque-ink">Översikt</h1>
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-mosque-ink/10 bg-white p-5 shadow-sm">
            <div className={`mb-4 inline-flex rounded-xl bg-mosque-cream p-2.5 ${s.color}`}><AdminIcon name={s.icon as AdminIconName} /></div>
            <div className="text-xs font-bold uppercase tracking-wide text-mosque-ink/50">{s.label}</div>
            <div className={`mt-2 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="mb-6 rounded-2xl border border-mosque-ink/10 bg-white p-6">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-sm font-extrabold text-mosque-ink">Kampanjens framsteg</div>
          <div className="text-sm font-bold text-mosque-emerald">{pct.toFixed(1)}%</div>
        </div>
        <div className="h-3.5 w-full overflow-hidden rounded-full bg-mosque-ink/10">
          <div className="h-full rounded-full bg-gradient-to-r from-mosque-emerald via-mosque-mint to-mosque-gold" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mb-3 text-sm font-extrabold text-mosque-ink">Senaste donationerna</div>
      <div className="overflow-hidden rounded-2xl border border-mosque-ink/10 bg-white">
        {recent.map((d: Donation) => (
          <div key={d.id} className="flex items-center justify-between border-b border-mosque-ink/5 px-5 py-3.5 last:border-0">
            <div className="text-sm font-bold text-mosque-ink">{d.display_name}</div>
            <div className="text-sm font-extrabold text-mosque-emerald">{fmtSEK(d.amount_sek)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonationsLog({ donations, onRefresh }: { donations: Donation[]; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Kontant');
  const [importMsg, setImportMsg] = useState('');

  const methodMap: Record<string, string> = { Kontant: 'cash', Swish: 'swish', Kort: 'card', Banköverföring: 'bank_transfer' };

  const startCreate = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setMethod('Kontant');
    setOpen(true);
  };

  const startEdit = (d: Donation) => {
    setEditingId(d.id);
    setName(d.display_name);
    setAmount(String(d.amount_sek));
    setMethod(METHOD_SV[d.method] || 'Kontant');
    setOpen(true);
  };

  const save = async () => {
    const body = JSON.stringify({ displayName: name, amountSek: Number(amount), method: methodMap[method] || 'cash' });
    if (editingId) {
      await fetch(`/api/admin/donations/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    } else {
      await fetch('/api/admin/donations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    }
    setOpen(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Radera denna donation?')) return;
    await fetch(`/api/admin/donations/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadCsv(file, '/api/admin/donations/import');
    const skippedMsg = result.skipped?.length ? ` (${result.skipped.length} rader hoppades över: ${result.skipped.map((s) => `rad ${s.row} – ${s.reason}`).join(', ')})` : '';
    setImportMsg((result.error || `Importerade ${result.imported} donationer`) + skippedMsg);
    e.target.value = '';
    onRefresh();
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-mosque-ink">Donationslogg</h1>
        <button onClick={startCreate} className="rounded-lg bg-mosque-emerald px-4 py-2.5 text-sm font-bold text-white">
          + Registrera donation
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-mosque-ink/10 bg-white p-4">
        <div className="text-xs font-bold text-mosque-ink/60">Massimport</div>
        <input type="file" accept=".csv" onChange={onFile} className="text-xs" />
        <button onClick={() => downloadTemplate('donations')} className="rounded-lg bg-mosque-ink/10 px-3 py-1.5 text-xs font-bold text-mosque-ink">
          Ladda ner tom mall
        </button>
        {importMsg && <div className="text-xs font-semibold text-mosque-emerald">{importMsg}</div>}
      </div>

      {open && (
        <div className="mb-5 rounded-2xl border border-mosque-ink/10 bg-white p-5">
          <div className="mb-3 text-sm font-extrabold text-mosque-ink">{editingId ? 'Redigera donation' : 'Registrera en manuell/kontant donation'}</div>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Givarens namn" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Belopp (SEK)" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm">
              <option>Kontant</option>
              <option>Swish</option>
              <option>Kort</option>
              <option>Banköverföring</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg bg-mosque-emerald px-4 py-2 text-sm font-bold text-white">Spara</button>
            <button onClick={() => setOpen(false)} className="rounded-lg bg-mosque-ink/10 px-4 py-2 text-sm font-bold text-mosque-ink">Avbryt</button>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-mosque-ink/10 bg-white">
        <div className="grid grid-cols-6 gap-2 bg-mosque-cream px-5 py-3 text-xs font-bold uppercase tracking-wide text-mosque-ink/50">
          <div>Givare</div><div>Belopp</div><div>Metod</div><div>Status</div><div>Datum</div><div></div>
        </div>
        {donations.map((d) => (
          <div key={d.id} className="grid grid-cols-6 gap-2 border-t border-mosque-ink/5 px-5 py-3.5 text-sm items-center">
            <div className="font-bold text-mosque-ink">{d.display_name}</div>
            <div className="font-extrabold text-mosque-emerald">{fmtSEK(d.amount_sek)}</div>
            <div className="text-mosque-ink/60">{METHOD_SV[d.method] || d.method}</div>
            <div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${d.status === 'confirmed' ? 'bg-mosque-emerald/10 text-mosque-emerald' : 'bg-amber-100 text-amber-700'}`}>
                {STATUS_SV[d.status] || d.status}
              </span>
            </div>
            <div className="text-mosque-ink/50">{new Date(d.created_at).toLocaleDateString('sv-SE')}</div>
            <div className="flex justify-end gap-3">
              <button onClick={() => startEdit(d)} className="text-xs font-bold text-mosque-ink/50">Redigera</button>
              <button onClick={() => remove(d.id)} className="text-xs font-bold text-red-600">Radera</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Donors({ donors, donations, plans, onRefresh }: { donors: Donor[]; donations: Donation[]; plans: PaymentPlan[]; onRefresh: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = donors.find(d => d.id === detailId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const save = async () => {
    await fetch('/api/admin/donors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name, email, phone })
    });
    setOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    onRefresh();
  };

  const erase = async (id: string) => {
    if (!confirm('Radera denna givares personuppgifter? Detta kan inte ångras.')) return;
    await fetch(`/api/admin/donors/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadCsv(file, '/api/admin/donors/import');
    const skippedMsg = result.skipped?.length ? ` (${result.skipped.length} rader hoppades över: ${result.skipped.map((s) => `rad ${s.row} – ${s.reason}`).join(', ')})` : '';
    setImportMsg((result.error || `Importerade ${result.imported} givare`) + skippedMsg);
    e.target.value = '';
    onRefresh();
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-mosque-ink">Givare</h1>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-mosque-emerald px-4 py-2.5 text-sm font-bold text-white">
          + Registrera givare
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-mosque-ink/10 bg-white p-4">
        <div className="text-xs font-bold text-mosque-ink/60">Massimport</div>
        <input type="file" accept=".csv" onChange={onFile} className="text-xs" />
        <button onClick={() => downloadTemplate('donors')} className="rounded-lg bg-mosque-ink/10 px-3 py-1.5 text-xs font-bold text-mosque-ink">
          Ladda ner tom mall
        </button>
        {importMsg && <div className="text-xs font-semibold text-mosque-emerald">{importMsg}</div>}
      </div>

      {open && (
        <div className="mb-5 rounded-2xl border border-mosque-ink/10 bg-white p-5">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fullständigt namn" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg bg-mosque-emerald px-4 py-2 text-sm font-bold text-white">Spara</button>
            <button onClick={() => setOpen(false)} className="rounded-lg bg-mosque-ink/10 px-4 py-2 text-sm font-bold text-mosque-ink">Avbryt</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-mosque-ink/10 bg-white">
        <table className="w-full min-w-[950px] text-left text-sm">
          <thead className="bg-mosque-cream text-xs text-mosque-ink/60"><tr>{['Givare', 'Utlovat', 'Betalt', 'Kvar', 'Delbetalningar', 'Betalningsmetod', 'Aviseringar', 'Åtgärder'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>{donors.map(d => {
            const summary = donorSummary(d.id, donations, plans);
            return <tr key={d.id} className="border-t border-mosque-ink/10">
              <td className="px-4 py-3"><button onClick={() => setDetailId(d.id)} className="font-bold text-mosque-emerald underline">{d.full_name}</button><p className="text-xs text-mosque-ink/60">{d.email}</p></td>
              <td className="px-4 py-3">{fmtSEK(summary.pledged)}</td>
              <td className="px-4 py-3 font-bold text-mosque-emerald">{fmtSEK(summary.paid)}</td>
              <td className="px-4 py-3">{fmtSEK(summary.remaining)}</td>
              <td className="px-4 py-3">{summary.plans.length ? summary.plans.map(p => <span key={p.id} title="Betalda månadsbelopp | totalt antal månader" className="mr-2 inline-block rounded-lg bg-mosque-cream px-2.5 py-1 font-semibold tabular-nums">{planProgress(p, donations)}</span>) : '—'}</td>
              <td className="px-4 py-3">{summary.methods}</td>
              <td className="px-4 py-3">{notificationChoices(d)}</td>
              <td className="space-y-2 px-4 py-3"><button onClick={() => setDetailId(d.id)} className="block text-mosque-emerald">Visa detaljer</button><button onClick={() => erase(d.id)} className="block text-xs text-red-600">Radera (GDPR)</button></td>
            </tr>;
          })}</tbody>
        </table>
        {!donors.length && <p className="p-5 text-sm">Inga givare registrerade.</p>}
      </div>
      {detail && <DonorDetails key={detail.id} donor={detail} donations={donations} plans={plans} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function Pending({ pending, onDecide }: { pending: Donation[]; onDecide: (id: string, status: 'confirmed' | 'rejected') => void }) {
  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-mosque-ink">Väntande godkännanden</h1>
      <div className="flex flex-col gap-3">
        {pending.length === 0 && <div className="p-10 text-center text-sm text-mosque-ink/40">Inga väntande betalningar</div>}
        {pending.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mosque-ink/10 bg-white p-5">
            <div>
              <div className="text-sm font-bold text-mosque-ink">{p.display_name}</div>
              <div className="text-xs text-mosque-ink/50">{METHOD_SV[p.method] || p.method}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-base font-extrabold text-mosque-emerald">{fmtSEK(p.amount_sek)}</div>
              <button onClick={() => onDecide(p.id, 'confirmed')} className="rounded-lg bg-mosque-emerald px-3.5 py-2 text-xs font-bold text-white">Godkänn</button>
              <button onClick={() => onDecide(p.id, 'rejected')} className="rounded-lg bg-red-100 px-3.5 py-2 text-xs font-bold text-red-600">Avvisa</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Plans({ plans, donations, onRefresh }: { plans: PaymentPlan[]; donations: Donation[]; onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  const [months, setMonths] = useState('6');

  const startEdit = (p: PaymentPlan) => {
    setEditingId(p.id);
    setName(p.display_name);
    setTotal(String(p.total_amount_sek));
    setMonths(String(p.months));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setTotal('');
    setMonths('6');
  };

  const save = async () => {
    const body = JSON.stringify({ displayName: name, totalAmountSek: Number(total), months: Number(months) });
    if (editingId) {
      await fetch(`/api/admin/plans/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    } else {
      await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    }
    cancelEdit();
    onRefresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Avbryta denna betalningsplan?')) return;
    await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-mosque-ink">Betalningsplaner</h1>
      <div className="mb-5 overflow-hidden rounded-2xl border border-mosque-ink/10 bg-white">
        <div className="grid grid-cols-6 gap-2 bg-mosque-cream px-5 py-3 text-xs font-bold uppercase tracking-wide text-mosque-ink/50">
          <div>Givare</div><div>Totalt</div><div>Varaktighet</div><div>Per månad</div><div>Framsteg</div><div></div>
        </div>
        {plans.map((p) => (
          <div key={p.id} className="grid grid-cols-6 gap-2 border-t border-mosque-ink/5 px-5 py-3.5 text-sm items-center">
            <div className="font-bold text-mosque-ink">{p.display_name}</div>
            <div className="font-extrabold text-mosque-emerald">{fmtSEK(p.total_amount_sek)}</div>
            <div className="text-mosque-ink/60">{p.months} månader</div>
            <div className="text-mosque-ink/60">{fmtSEK(p.amount_per_month_sek)}</div>
            <div className="text-mosque-ink/50">{planProgress(p, donations)} månadsbelopp betalda</div>
            <div className="flex justify-end gap-3">
              <button onClick={() => startEdit(p)} className="text-xs font-bold text-mosque-ink/50">Redigera</button>
              <button onClick={() => remove(p.id)} className="text-xs font-bold text-red-600">Avbryt</button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-mosque-ink/10 bg-white p-5">
        <div className="mb-3 text-sm font-extrabold text-mosque-ink">{editingId ? 'Redigera plan' : 'Skapa en ny plan'}</div>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Givarens namn" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          <input value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Totalt (SEK)" className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          <select value={months} onChange={(e) => setMonths(e.target.value)} className="rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm">
            <option value="2">2 månader</option>
            <option value="6">6 månader</option>
            <option value="12">12 månader</option>
          </select>
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 rounded-lg bg-mosque-emerald px-4 py-2 text-sm font-bold text-white">{editingId ? 'Spara' : 'Skapa'}</button>
            {editingId && <button onClick={cancelEdit} className="rounded-lg bg-mosque-ink/10 px-4 py-2 text-sm font-bold text-mosque-ink">Avbryt</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Settings() {
  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then((j) => setSettings(j.settings));
  }, []);

  const save = async () => {
    if (!settings) return;
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swishNumber: settings.swish_number,
        bankgiro: settings.bankgiro,
        iban: settings.iban,
        paypalLink: settings.paypal_link,
        isLive: settings.is_live,
        pausedMessage: settings.paused_message,
        transparencyFiles: settings.transparency_files
      })
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const updateFile = (i: number, patch: Partial<{ label: string; url: string }>) => {
    if (!settings) return;
    const files = settings.transparency_files.slice();
    files[i] = { ...files[i], ...patch };
    setSettings({ ...settings, transparency_files: files });
  };
  const addFile = () => {
    if (!settings) return;
    setSettings({ ...settings, transparency_files: [...settings.transparency_files, { label: '', url: '' }] });
  };
  const removeFile = (i: number) => {
    if (!settings) return;
    setSettings({ ...settings, transparency_files: settings.transparency_files.filter((_, idx) => idx !== i) });
  };

  if (!settings) return <div className="text-sm text-mosque-ink/50">Laddar…</div>;

  // Deterministisk platshållarmönster från Swish-numret — inte en riktig,
  // skanningsbar kod. Koppla SWISH_MERCHANT_ID (se .env.example) för en riktig.
  let h = 0;
  for (const ch of settings.swish_number) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells = Array.from({ length: 144 }, () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return h % 100 < 45;
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold text-mosque-ink">Betalkonton</h1>
      <div className="mb-5 text-sm text-mosque-ink/60">Var donationer hamnar — visas för givare vid betalning</div>

      <div className="mb-4 rounded-2xl border border-mosque-ink/10 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-extrabold text-mosque-ink">Live-kampanj</div>
            <div className="text-xs text-mosque-ink/50">Styr om den publika sidan visar tracker + registrering, eller ett pausmeddelande</div>
          </div>
          <button
            onClick={() => setSettings({ ...settings, is_live: !settings.is_live })}
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${settings.is_live ? 'bg-mosque-emerald' : 'bg-mosque-ink/20'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${settings.is_live ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <div className={`mb-1.5 text-xs font-bold ${settings.is_live ? 'text-mosque-ink/30' : 'text-mosque-ink/50'}`}>
          Pausmeddelande (visas när kampanjen är pausad)
        </div>
        <textarea
          value={settings.paused_message}
          onChange={(e) => setSettings({ ...settings, paused_message: e.target.value })}
          disabled={settings.is_live}
          rows={2}
          className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm disabled:bg-mosque-ink/5 disabled:text-mosque-ink/40"
        />
        <div className="mt-2 text-xs font-bold">
          Status: <span className={settings.is_live ? 'text-mosque-emerald' : 'text-red-600'}>{settings.is_live ? 'Live' : 'Pausad'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr] items-start">
        <div className="rounded-2xl border border-mosque-ink/10 bg-white p-6">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Swish-nummer</div>
              <input value={settings.swish_number} onChange={(e) => setSettings({ ...settings, swish_number: e.target.value })} className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Bankgiro</div>
              <input value={settings.bankgiro} onChange={(e) => setSettings({ ...settings, bankgiro: e.target.value })} className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">PayPal-länk (t.ex. paypal.me/dittnamn) — visas som QR-kod på startsidan</div>
            <input value={settings.paypal_link ?? ''} onChange={(e) => setSettings({ ...settings, paypal_link: e.target.value })} placeholder="paypal.me/alrahma" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          </div>
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">IBAN</div>
            <input value={settings.iban} onChange={(e) => setSettings({ ...settings, iban: e.target.value })} className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} className="rounded-lg bg-mosque-emerald px-4 py-2 text-sm font-bold text-white">Spara ändringar</button>
            {saved && <span className="text-sm font-bold text-mosque-emerald">Sparat</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-mosque-ink/10 bg-white p-6 text-center">
          <div className="mb-3 text-xs font-bold text-mosque-ink/50">Swish QR-kod</div>
          <div className="mx-auto grid w-44 grid-cols-12 overflow-hidden rounded-md border-8 border-white shadow-[0_0_0_1px_#e7e2d2]">
            {cells.map((on, i) => (
              <div key={i} className="pb-[100%]" style={{ background: on ? '#0e2a14' : '#fff' }} />
            ))}
          </div>
          <div className="mt-3 text-sm font-extrabold">{settings.swish_number}</div>
          <div className="mt-1.5 text-[11px] text-mosque-ink/50">Demo-QR (ej skanningsbar) — ange SWISH_MERCHANT_ID för en riktig kod</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-mosque-ink/10 bg-white p-6">
        <div className="mb-1 text-sm font-extrabold text-mosque-ink">Transparens — bifogade filer</div>
        <div className="mb-3 text-xs text-mosque-ink/50">
          Länkar till kvitton, foton av bygget eller fakturor — visas för givare på tacksidan efter en donation, så de kan se vad som verkligen gjorts.
        </div>
        <div className="mb-3 flex flex-col gap-2">
          {settings.transparency_files.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={f.label}
                onChange={(e) => updateFile(i, { label: e.target.value })}
                placeholder="Titel, t.ex. Kvitto — grundarbete"
                className="min-w-0 flex-1 rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm"
              />
              <input
                value={f.url}
                onChange={(e) => updateFile(i, { url: e.target.value })}
                placeholder="https://…"
                className="min-w-0 flex-[1.4] rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm"
              />
              <button onClick={() => removeFile(i)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Ta bort</button>
            </div>
          ))}
          {!settings.transparency_files.length && <div className="text-xs text-mosque-ink/40">Inga filer tillagda ännu</div>}
        </div>
        <button onClick={addFile} className="rounded-lg bg-mosque-ink/10 px-3 py-1.5 text-xs font-bold text-mosque-ink">+ Lägg till fil</button>
      </div>
    </div>
  );
}

function Reports() {
  const cards = [
    { icon: '💰', title: 'Donationsrapport', type: 'donations' },
    { icon: '👥', title: 'Givarregister', type: 'donors' },
    { icon: '📅', title: 'Betalningsplaner', type: 'plans' }
  ];
  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-mosque-ink">Rapporter</h1>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.type} className="rounded-2xl border border-mosque-ink/10 bg-white p-5">
            <div className="mb-2.5 text-2xl">{c.icon}</div>
            <div className="mb-4 text-sm font-extrabold text-mosque-ink">{c.title}</div>
            <a href={`/api/admin/reports?type=${c.type}`} className="inline-block rounded-lg bg-mosque-ink/10 px-4 py-2 text-xs font-bold text-mosque-ink">
              Exportera CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
