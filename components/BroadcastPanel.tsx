'use client';

import { useEffect, useRef, useState } from 'react';
import { BroadcastLogEntry } from '@/lib/types';
import type { BroadcastRecipient } from '@/lib/broadcast-recipients';
import { Channel, isSwedishSmsAddress, recipientAddress } from '@/lib/communication';

type Template = { id: string; language: string; body: string };
type SmsEstimate = { currency: string; estimatedCost: number; parts: number; recipients: number };
const labels: Record<Channel, string> = { sms: 'SMS', email: 'E-post', whatsapp: 'WhatsApp' };
const statuses: Record<string, string> = { sending: 'Pågår – kontrollera leverantören före nytt försök', accepted: 'Accepterat', partial: 'Delvis accepterat', failed: 'Misslyckat' };

export default function BroadcastPanel() {
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [channel, setChannel] = useState<Channel>('sms');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [providers, setProviders] = useState<Record<Channel, boolean>>({ sms: false, email: false, whatsapp: false });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [log, setLog] = useState<BroadcastLogEntry[]>([]);
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<SmsEstimate | null>(null);
  const [estimateError, setEstimateError] = useState('');
  const reviewId = useRef<string | null>(null);

  const template = templates.find(t => `${t.id}:${t.language}` === templateKey);
  const group = recipients.filter(r => !r.comm_opt_out && r[`comm_${channel}`]);
  const eligible = group.filter(r => {
    const address = recipientAddress(r, channel);
    return address && (channel !== 'sms' || isSwedishSmsAddress(address)) && (channel !== 'whatsapp' || !template || r.preferred_language === template.language);
  });
  const excludedNonSwedish = channel === 'sms' ? group.filter(r => {
    const address = recipientAddress(r, 'sms');
    return address && !isSwedishSmsAddress(address);
  }).length : 0;
  const visible = group.filter(r => `${r.full_name} ${r.phone || ''} ${r.email}`.toLowerCase().includes(search.toLowerCase()));
  const chosen = eligible.filter(r => selected.includes(r.id));
  const reach = new Set(chosen.map(r => recipientAddress(r, channel))).size;
  const text = channel === 'whatsapp' ? template?.body || '' : message.trim();
  const canReview = providers[channel] && reach > 0 && !!text && !busy;

  async function load() {
    const response = await fetch('/api/admin/broadcast');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Kunde inte läsa utskick.');
    setRecipients(data.recipients || []);
    setLog(data.log || []);
    setProviders(data.providers);
    setTemplates(data.templates || []);
    setLoaded(true);
  }

  useEffect(() => { load().catch(() => setNotice('Kunde inte läsa utskick. Ladda om sidan.')); }, []);

  async function fetchEstimate(id: string) {
    setEstimate(null); setEstimateError('');
    try {
      const response = await fetch('/api/admin/broadcast/estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, donorIds: chosen.map(r => r.id) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Kunde inte beräkna kostnaden.');
      if (result.recipients !== reach) throw new Error('Mottagarna har ändrats. Gå tillbaka och granska igen.');
      if (reviewId.current === id) setEstimate(result);
    } catch (error) {
      if (reviewId.current === id) setEstimateError(error instanceof Error ? error.message : 'Kunde inte beräkna kostnaden.');
    }
  }

  function beginReview() {
    const id = crypto.randomUUID();
    reviewId.current = id; setBatchId(id); setEstimate(null); setEstimateError('');
    if (channel === 'sms') void fetchEstimate(id);
  }

  async function send() {
    if (!batchId || busy || (channel === 'sms' && !estimate)) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, channel, message: text, donorIds: chosen.map(r => r.id), templateId: template?.id, language: template?.language })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Utskicket misslyckades.');
      setNotice(`${result.accepted} accepterade, ${result.failed} misslyckade eller okända.${result.excludedNonSwedish ? ` ${result.excludedNonSwedish} utländska nummer uteslöts.` : ''} Leverans är ännu inte bekräftad.${result.auditWarning ? ' Loggen kunde inte uppdateras; kontrollera 46elks.' : ''}`);
      reviewId.current = null; setBatchId(null); setSelected([]); setMessage(''); setEstimate(null);
      try { await load(); } catch { setNotice('Utskicket behandlades. Historiken kunde inte uppdateras här; kontrollera 46elks.'); }
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : 'Anslutningen avbröts.'} Kontrollera historiken och 46elks innan du startar ett nytt utskick.`);
    } finally { setBusy(false); }
  }

  if (!loaded && !notice) return <p>Läser utskick…</p>;

  return <section className="space-y-5">
    <div>
      <h1 className="text-2xl font-extrabold">Utskick</h1>
      <p className="mt-1 text-sm text-mosque-ink/65">Donationuppdateringar och påminnelser till givare som valt kanalen. Inga nya insamlingsmeddelanden. Högst 50 givare per utskick.</p>
    </div>

    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Channel[]).map(key =>
      <button key={key} type="button" disabled={busy || !!batchId} aria-pressed={key === channel} onClick={() => { setChannel(key); setSelected([]); setNotice(''); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${key === channel ? 'bg-mosque-emerald text-white' : 'bg-white'}`}>
        {labels[key]} ({recipients.filter(r => !r.comm_opt_out && r[`comm_${key}`] && (key !== 'sms' || isSwedishSmsAddress(recipientAddress(r, 'sms')))).length})
      </button>)}</div>

    <p className="text-sm">{providers[channel] ? channel === 'sms' ? '46elks är anslutet. Kontrollera saldo hos 46elks före större utskick.' : 'Leverantören är konfigurerad.' : channel === 'whatsapp' ? 'WhatsApp väntar på Meta-godkännande och API-inställningar.' : `${labels[channel]} behöver en konfigurerad leverantör.`}</p>
    {channel === 'sms' && <p className="rounded-lg bg-white p-3 text-sm"><strong>Endast Sverige (+46).</strong> Nummer utanför Sverige kan inte väljas eller skickas till här. {excludedNonSwedish} givare med utländska nummer är uteslutna.</p>}

    {channel === 'whatsapp' ? <div className="space-y-2">
      <label className="block text-sm font-bold">Godkänd WhatsApp-mall
        <select value={templateKey} disabled={busy || !!batchId} onChange={e => { setTemplateKey(e.target.value); setSelected([]); }} className="ml-3 rounded-lg border p-2"><option value="">Välj mall</option>{templates.map(t => <option key={`${t.id}:${t.language}`} value={`${t.id}:${t.language}`}>{t.id} · {t.language}</option>)}</select>
      </label>
      <p className="rounded-lg bg-white p-3 text-sm">{template?.body || 'Inga meddelanden skickas utan en godkänd mall.'}</p>
    </div> : <label className="block text-sm font-bold">Meddelande
      <textarea maxLength={channel === 'sms' ? 480 : 4000} disabled={busy || !!batchId} value={message} onChange={e => setMessage(e.target.value)} className="mt-2 block min-h-32 w-full rounded-lg border p-3 font-normal" />
      <span className="mt-1 block text-xs font-normal text-mosque-ink/60">{message.length}/{channel === 'sms' ? 480 : 4000} tecken{channel === 'sms' ? ' · Långa SMS kan delas upp och kosta mer.' : ''}</span>
    </label>}

    <div className="rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{labels[channel]}-gruppen ({eligible.length}) · Valda {channel === 'email' ? 'adresser' : 'nummer'} ({reach})</strong>
        <div className="flex gap-3 text-sm"><button type="button" disabled={busy || !!batchId} onClick={() => setSelected(eligible.filter(r => visible.includes(r)).slice(0, 50).map(r => r.id))} className="text-mosque-emerald underline">Markera upp till 50</button><button type="button" disabled={busy || !!batchId} onClick={() => setSelected([])} className="underline">Rensa</button></div>
      </div>
      <input type="search" value={search} disabled={busy || !!batchId} onChange={e => setSearch(e.target.value)} placeholder="Sök namn eller kontakt" aria-label="Sök givare" className="my-3 w-full rounded-lg border p-2 text-sm" />
      {!group.length && <p className="text-sm">Inga givare har valt denna kanal.</p>}
      <div className="max-h-80 overflow-auto">{visible.map(r => <label key={r.id} className="flex items-center gap-2 border-t py-2 text-sm">
        <input type="checkbox" disabled={busy || !!batchId || !eligible.includes(r) || (!selected.includes(r.id) && selected.length >= 50)} checked={selected.includes(r.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id))} />
        <span>{r.full_name}</span><span className="ml-auto text-xs text-mosque-ink/60">{!recipientAddress(r, channel) ? 'Kontaktuppgifter behöver rättas' : channel === 'sms' && !isSwedishSmsAddress(recipientAddress(r, 'sms')) ? 'Utanför Sverige – utesluten' : channel === 'whatsapp' && template && r.preferred_language !== template.language ? 'Annat språk än mallen' : r.id.startsWith('profile:') ? 'Ny givarprofil' : ''}</span>
      </label>)}</div>
    </div>

    {!batchId ? <button type="button" disabled={!canReview} onClick={beginReview} className="rounded-lg bg-mosque-emerald px-4 py-2 font-bold text-white disabled:opacity-40">Granska {labels[channel]} ({reach})</button> : <div className="space-y-3 rounded-xl border border-mosque-emerald bg-white p-4">
      <h2 className="text-lg font-extrabold">Granska före utskick</h2>
      <p className="text-sm">{reach} unika {channel === 'email' ? 'e-postadresser' : 'nummer'} får meddelandet. Dubbletter skickas en gång.</p>
      <p className="text-sm text-mosque-ink/65">{chosen.map(r => `${r.full_name} (${(recipientAddress(r, channel) || '').slice(-4)})`).join(', ')}</p>
      <p className="whitespace-pre-wrap rounded-lg bg-mosque-cream p-3 text-sm">{text}</p>
      {channel === 'sms' && <div className="rounded-lg bg-mosque-cream p-3 text-sm" role="status">
        {estimate ? <><strong>Uppskattad kostnad: {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: estimate.currency, maximumFractionDigits: 4 }).format(estimate.estimatedCost / 10000)}</strong><p>{estimate.parts} SMS-delar till {estimate.recipients} nummer. 46elks slutliga kostnad kan skilja sig.</p></> : estimateError ? <><p>{estimateError} Inget SMS skickades.</p><button type="button" onClick={() => fetchEstimate(batchId)} className="mt-2 underline">Försök beräkna igen</button></> : <p>Beräknar kostnaden hos 46elks… Inget SMS skickas.</p>}
      </div>}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || (channel === 'sms' && !estimate)} onClick={send} className="rounded-lg bg-mosque-emerald px-4 py-2 font-bold text-white disabled:opacity-40">{busy ? 'Skickar…' : `Bekräfta och skicka ${labels[channel]} (${reach})`}</button><button type="button" disabled={busy} onClick={() => { reviewId.current = null; setBatchId(null); setEstimate(null); }} className="rounded-lg border px-4 py-2">Ändra</button></div>
    </div>}

    {notice && <p role="status" className="rounded-lg bg-white p-3 text-sm">{notice}</p>}
    <h2 className="font-bold">Utskickshistorik</h2>
    {log.map(entry => <article key={entry.id} className="rounded-lg bg-white p-3 text-sm"><strong>{entry.channel.toUpperCase()}</strong> · {statuses[entry.status || ''] || (entry.simulated ? 'Tidigare simulering' : 'Äldre utskick')} · {entry.accepted_count || 0} accepterade · {entry.failed_count || 0} misslyckade<p className="truncate text-mosque-ink/65">{entry.message}</p></article>)}
  </section>;
}
