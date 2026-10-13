'use client';

import { useEffect, useState } from 'react';
import { fmtSEK } from '@/lib/format';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Donation, Donor, PaymentPlan, CampaignSettings, BroadcastLogEntry } from '@/lib/types';

type Tab = 'overview' | 'donations' | 'donors' | 'plans' | 'broadcast' | 'settings' | 'reports';

const NAV: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Översikt' },
  { key: 'donations', label: 'Donationslogg' },
  { key: 'donors', label: 'Givare' },
  { key: 'plans', label: 'Betalningsplaner' },
  { key: 'broadcast', label: 'Utskick' },
  { key: 'settings', label: 'Betalkonton' },
  { key: 'reports', label: 'Rapporter' }
];

// Line icons (24px grid, 1.8 stroke), drawn from currentColor.
const ICONS: Record<Tab, string> = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',
  donations: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z',
  donors: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.7a3.5 3.5 0 0 1 0 6.6',
  plans: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h3m2 0h1m-6 4h3',
  broadcast: 'M4 12v3a1 1 0 0 0 1 1h2l5 4V6L7 10H5a1 1 0 0 0-1 1v1Zm13-3.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13',
  settings: 'M3 7h4m4 0h10M3 17h10m4 0h4M9 4v6m8 4v6',
  reports: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h6'
};

function NavIcon({ name }: { name: Tab }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
      <path d={ICONS[name]} />
    </svg>
  );
}

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

  // Only the first load blocks the page; later refreshes update in place.
  const refresh = async () => {
    const [dRes, doRes, pRes] = await Promise.all([
      fetch('/api/admin/donations'),
      fetch('/api/admin/donors'),
      fetch('/api/admin/plans')
    ]);
    const [dJson, doJson, pJson] = await Promise.all([dRes.json(), doRes.json(), pRes.json()]);
    setDonations(dJson.donations || []);
    setDonors(doJson.donors || []);
    setPlans(pJson.plans || []);
    fetch('/api/admin/settings').then((r) => r.json()).then((j) => j.settings?.goal_sek && setGoal(j.settings.goal_sek));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const confirmed = donations.filter((d) => d.status === 'confirmed');
  const raised = confirmed.reduce((sum, d) => sum + d.amount_sek, 0);
  const [goal, setGoal] = useState(15000000);
  const pct = Math.min(100, (raised / goal) * 100);

  const logout = async () => {
    await supabaseBrowser.auth.signOut();
    window.location.href = '/admin/login';
  };

  return (
    <div className="flex min-h-screen bg-mosque-cream">
      <div className={`flex flex-shrink-0 flex-col gap-0.5 bg-mosque-deep p-3 text-mosque-cream transition-all duration-200 ${sidebarOpen ? 'w-60 p-4' : 'w-16 items-center'}`}>
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
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            title={item.label}
            className={`flex items-center gap-2.5 rounded-lg py-2.5 text-left text-sm font-semibold ${sidebarOpen ? 'px-3' : 'justify-center px-0'} ${
              tab === item.key ? 'bg-mosque-gold/90 text-mosque-deep' : 'text-mosque-cream/85'
            }`}
          >
            <NavIcon name={item.key} />
            {sidebarOpen && item.label}
          </button>
        ))}

        <button
          onClick={logout}
          title="Logga ut"
          className={`mt-auto flex items-center rounded-lg py-2.5 text-sm font-semibold text-mosque-cream/85 hover:bg-white/10 ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
        >
          {sidebarOpen ? 'Logga ut' : 'L'}
        </button>
      </div>

      <div className="min-w-0 flex-1 p-10">
        {loading ? (
          <div className="text-sm text-mosque-ink/50">Laddar…</div>
        ) : (
          <>
            {tab === 'overview' && (
              <Overview raised={raised} goal={goal} pct={pct} donorCount={donors.length} planCount={plans.length} recent={confirmed.slice(0, 5)} />
            )}
            {tab === 'donations' && <DonationsLog donations={donations} onRefresh={refresh} />}
            {tab === 'donors' && <Donors donors={donors} onRefresh={refresh} />}
            {tab === 'plans' && <Plans plans={plans} onRefresh={refresh} />}
            {tab === 'broadcast' && <Broadcast donors={donors} />}
            {tab === 'settings' && <Settings />}
            {tab === 'reports' && <Reports />}
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ raised, goal, pct, donorCount, planCount, recent }: any) {
  const stats = [
    { label: 'Insamlat totalt', value: fmtSEK(raised), color: 'text-mosque-emerald' },
    { label: 'Registrerade givare', value: String(donorCount), color: 'text-mosque-ink' },
    { label: 'Aktiva betalningsplaner', value: String(planCount), color: 'text-mosque-ink' }
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold text-mosque-ink">Översikt</h1>
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-mosque-ink/10 bg-white p-5">
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

function Donors({ donors, onRefresh }: { donors: Donor[]; onRefresh: () => void }) {
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
      <div className="overflow-hidden rounded-2xl border border-mosque-ink/10 bg-white">
        <div className="grid grid-cols-5 gap-2 bg-mosque-cream px-5 py-3 text-xs font-bold uppercase tracking-wide text-mosque-ink/50">
          <div>Namn</div><div>Telefon</div><div>E-post</div><div>Samtycke</div><div></div>
        </div>
        {donors.map((d) => (
          <div key={d.id} className="grid grid-cols-5 gap-2 border-t border-mosque-ink/5 px-5 py-3.5 text-sm items-center">
            <div className="font-bold text-mosque-ink">{d.full_name}</div>
            <div className="text-mosque-ink/60">{d.phone || '—'}</div>
            <div className="text-mosque-ink/60">{d.email}</div>
            <div className="text-mosque-ink/60">{d.gdpr_consent ? 'Givet' : '—'}</div>
            <button onClick={() => erase(d.id)} className="justify-self-end text-xs font-bold text-red-600">Radera (GDPR)</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Plans({ plans, onRefresh }: { plans: PaymentPlan[]; onRefresh: () => void }) {
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
            <div className="text-mosque-ink/50">{p.installments_paid}/{p.months} betalda</div>
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

function Broadcast({ donors }: { donors: Donor[] }) {
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(donors.map((d) => d.id)));
  const [log, setLog] = useState<BroadcastLogEntry[]>([]);
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setSelected(new Set(donors.map((d) => d.id)));
  }, [donors]);

  useEffect(() => {
    fetch('/api/admin/broadcast').then((r) => r.json()).then((j) => setLog(j.log || []));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedDonors = donors.filter((d) => selected.has(d.id));
  const smsReach = selectedDonors.filter((d) => d.phone && d.comm_sms && !d.comm_opt_out).length;
  const emailReach = selectedDonors.filter((d) => d.email && d.comm_email && !d.comm_opt_out).length;

  const send = async (channel: 'sms' | 'email') => {
    if (!message.trim() || sending) return;
    setSending(true);
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, message, donorIds: Array.from(selected) })
    });
    const json = await res.json();
    setSending(false);
    if (json.error) return setToast(json.error);
    setToast(`Skickat till ${json.recipients} mottagare${json.simulated ? ' (simulerat — ingen leverantör konfigurerad)' : ''}`);
    setMessage('');
    fetch('/api/admin/broadcast').then((r) => r.json()).then((j) => setLog(j.log || []));
    setTimeout(() => setToast(''), 5000);
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold text-mosque-ink">Utskick</h1>
      <div className="mb-5 text-sm text-mosque-ink/60">Skicka SMS eller e-post till valda givare</div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] items-start">
        <div className="rounded-2xl border border-mosque-ink/10 bg-white p-5">
          <div className="mb-2 text-xs font-bold text-mosque-ink/50">Meddelande</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="t.ex. JazakAllah Khair — vi har nått 45% av vårt mål!"
            className="min-h-[120px] w-full rounded-lg border border-mosque-ink/15 p-3 text-sm"
          />
          {toast && <div className="mt-3 rounded-lg bg-mosque-emerald/10 p-3 text-sm font-bold text-mosque-emerald">{toast}</div>}
          <div className="mt-4 flex gap-2">
            <button disabled={!message.trim() || sending} onClick={() => send('sms')} className="whitespace-nowrap rounded-lg bg-mosque-emerald px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              Skicka SMS ({smsReach})
            </button>
            <button disabled={!message.trim() || sending} onClick={() => send('email')} className="whitespace-nowrap rounded-lg bg-mosque-emerald px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              Skicka e-post ({emailReach})
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-mosque-ink/10 bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase text-mosque-ink/50">Mottagare</div>
            <button onClick={() => setSelected(selected.size === donors.length ? new Set() : new Set(donors.map((d) => d.id)))} className="text-xs font-bold text-mosque-emerald">
              {selected.size === donors.length ? 'Avmarkera alla' : 'Markera alla'}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-mosque-ink/10">
            {donors.map((d) => (
              <label key={d.id} className="flex items-center gap-2 border-b border-mosque-ink/5 px-3 py-2 last:border-0">
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{d.full_name}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-sm font-bold"><span>Valda</span><span className="text-mosque-emerald">{selected.size}</span></div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-sm font-extrabold text-mosque-ink">Skickhistorik</div>
        <div className="overflow-hidden rounded-2xl border border-mosque-ink/10 bg-white">
          {log.length === 0 && <div className="p-8 text-center text-sm text-mosque-ink/40">Inget skickat än</div>}
          {log.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 border-b border-mosque-ink/5 px-5 py-3.5 last:border-0">
              <div className="min-w-0">
                <div className="text-sm font-bold text-mosque-ink">{l.channel.toUpperCase()} · {l.recipient_count} mottagare{l.simulated ? ' · simulerat' : ''}</div>
                <div className="truncate text-xs text-mosque-ink/50">{l.message}</div>
              </div>
              <div className="flex-shrink-0 text-xs text-mosque-ink/40">{new Date(l.created_at).toLocaleString('sv-SE')}</div>
            </div>
          ))}
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
        paypalPlaceholder: settings.paypal_placeholder,
        goalSek: settings.goal_sek,
        plusgiro: settings.plusgiro,
        bankName: settings.bank_name,
        accountHolder: settings.account_holder,
        accountNumber: settings.account_number,
        bic: settings.bic,
        cardLink: settings.card_link,
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
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Insamlingsmål (SEK)</div>
            <input type="number" min={1} value={settings.goal_sek ?? ''} onChange={(e) => setSettings({ ...settings, goal_sek: Number(e.target.value) })} className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          </div>
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
            <label className="mt-2 flex items-center gap-2 text-xs text-mosque-ink/70">
              <input type="checkbox" checked={settings.paypal_placeholder ?? true} onChange={(e) => setSettings({ ...settings, paypal_placeholder: e.target.checked })} />
              Visa Swish-QR som platshållare i PayPal-rutan tills en PayPal-länk anges
            </label>
          </div>
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Kort/online-betalningslänk (t.ex. Stripe, Swedbank Pay) — visas som QR-kod på startsidan</div>
            <input value={settings.card_link ?? ''} onChange={(e) => setSettings({ ...settings, card_link: e.target.value })} placeholder="https://give.alrahma.se" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
          </div>
          <div className="mb-1 mt-5 text-sm font-extrabold">Bankuppgifter</div>
          <div className="mb-3 text-[11px] text-mosque-ink/50">Visas på startsidan. Tomma fält döljs. Med IBAN + kontoinnehavare visas även en bank-QR (GiroCode).</div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Kontoinnehavare</div>
              <input value={settings.account_holder ?? ''} onChange={(e) => setSettings({ ...settings, account_holder: e.target.value })} placeholder="Al-Rahma Mosque" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Bank</div>
              <input value={settings.bank_name ?? ''} onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })} placeholder="Swedbank" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Kontonummer (clearing + konto)</div>
              <input value={settings.account_number ?? ''} onChange={(e) => setSettings({ ...settings, account_number: e.target.value })} placeholder="" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">IBAN</div>
              <input value={settings.iban ?? ''} onChange={(e) => setSettings({ ...settings, iban: e.target.value })} placeholder="" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">BIC / SWIFT</div>
              <input value={settings.bic ?? ''} onChange={(e) => setSettings({ ...settings, bic: e.target.value })} placeholder="" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-mosque-ink/50">Plusgiro</div>
              <input value={settings.plusgiro ?? ''} onChange={(e) => setSettings({ ...settings, plusgiro: e.target.value })} placeholder="" className="w-full rounded-lg border border-mosque-ink/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} className="rounded-lg bg-mosque-emerald px-4 py-2 text-sm font-bold text-white">Spara ändringar</button>
            {saved && <span className="text-sm font-bold text-mosque-emerald">Sparat</span>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <QrUpload kind="swish" title="Swish QR-kod" url={settings.swish_qr_url} onChange={(u) => setSettings({ ...settings, swish_qr_url: u })} />
          <QrUpload kind="paypal" title="PayPal QR-kod" url={settings.paypal_qr_url} onChange={(u) => setSettings({ ...settings, paypal_qr_url: u })} />
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

// Upload your own QR image (e.g. the Swish/PayPal business QR). Saved
// immediately; shown on the public page instead of the generated QR.
function QrUpload({ kind, title, url, onChange }: { kind: 'swish' | 'paypal'; title: string; url: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    const res = await fetch('/api/admin/qr', { method: 'POST', body: form });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error || 'Uppladdningen misslyckades');
    onChange(json.url);
  };

  const remove = async () => {
    setBusy(true);
    await fetch(`/api/admin/qr?kind=${kind}`, { method: 'DELETE' });
    setBusy(false);
    onChange('');
  };

  return (
    <div className="rounded-2xl border border-mosque-ink/10 bg-white p-6 text-center">
      <div className="mb-3 text-xs font-bold text-mosque-ink/50">{title}</div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="mx-auto h-44 w-44 rounded-md border border-mosque-ink/10 object-contain" />
      ) : (
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-md border border-dashed border-mosque-ink/20 text-xs text-mosque-ink/40">
          Ingen uppladdad bild — en genererad kod visas
        </div>
      )}
      <div className="mt-3 flex items-center justify-center gap-2">
        <label className="cursor-pointer rounded-lg bg-mosque-emerald px-3 py-1.5 text-xs font-bold text-white">
          {busy ? 'Laddar upp…' : url ? 'Byt bild' : 'Ladda upp bild'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={busy} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {url && (
          <button onClick={remove} disabled={busy} className="rounded-lg bg-mosque-ink/10 px-3 py-1.5 text-xs font-bold text-mosque-ink">Ta bort</button>
        )}
      </div>
      {error && <div className="mt-2 text-xs font-semibold text-red-600">{error}</div>}
      <div className="mt-1.5 text-[11px] text-mosque-ink/50">PNG, JPG, WebP eller SVG, max 2 MB</div>
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
