'use client';
import { useEffect, useState } from 'react';
import { Donor, BroadcastLogEntry } from '@/lib/types';
import { Channel, recipientAddress } from '@/lib/communication';

type Template = { id: string; language: string; body: string };
const labels: Record<Channel, string> = { sms: 'SMS', email: 'E-post', whatsapp: 'WhatsApp' };
export default function BroadcastPanel({ donors }: { donors: Donor[] }) {
  const [channel, setChannel] = useState<Channel>('sms');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [providers, setProviders] = useState<Record<Channel, boolean>>({ sms: false, email: false, whatsapp: false });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [log, setLog] = useState<BroadcastLogEntry[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const template = templates.find(t => `${t.id}:${t.language}` === templateKey);
  const group = donors.filter(d => !d.comm_opt_out && d[`comm_${channel}`]);
  const eligible = group.filter(d => recipientAddress(d, channel) && (channel !== 'whatsapp' || !template || d.preferred_language === template.language));
  const reach = new Set(eligible.filter(d => selected.includes(d.id)).map(d => recipientAddress(d, channel))).size;

  async function load() {
    const response = await fetch('/api/admin/broadcast');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setLog(data.log); setProviders(data.providers); setTemplates(data.templates);
  }
  useEffect(() => { load().catch(() => setNotice('Kunde inte läsa utskicksinställningar.')); }, []);
  async function send() {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/admin/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, message, donorIds: eligible.filter(d => selected.includes(d.id)).map(d => d.id), templateId: template?.id, language: template?.language }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(`${result.accepted} accepterade av leverantören, ${result.failed} misslyckade. Leverans är ännu inte bekräftad.${result.auditWarning ? ' Loggen kunde inte uppdateras; skicka inte om utan kontroll.' : ''}`);
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Anslutningen avbröts. Kontrollera historiken innan du försöker igen.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <h1 className="text-2xl font-extrabold">Utskick</h1>
    <p className="text-sm text-mosque-ink/60">Uppdateringar om donationer till givare som valt kanalen. Högst 50 givare per utskick. Samma kontaktadress får ett meddelande.</p>
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Channel[]).map(key => <button key={key} disabled={busy} aria-pressed={key === channel} onClick={() => { setChannel(key); setSelected([]); setNotice(''); }} className={`rounded-lg px-4 py-2 ${key === channel ? 'bg-mosque-emerald text-white' : 'bg-white'}`}>{labels[key]} ({donors.filter(d => !d.comm_opt_out && d[`comm_${key}`]).length})</button>)}</div>
    <p className="text-sm">{providers[channel] ? 'Leverantören är konfigurerad.' : channel === 'whatsapp' ? 'WhatsApp väntar på Meta-godkännande och API-inställningar.' : `${labels[channel]} behöver en konfigurerad leverantör innan du kan skicka.`}</p>
    {channel === 'whatsapp' ? <div className="space-y-2">
      <label className="block text-sm">Godkänd WhatsApp-mall
        <select value={templateKey} onChange={e => { setTemplateKey(e.target.value); setSelected([]); }} className="ml-3 rounded-lg border p-2"><option value="">Välj mall</option>{templates.map(t => <option key={`${t.id}:${t.language}`} value={`${t.id}:${t.language}`}>{t.id} · {t.language}</option>)}</select>
      </label>
      <p className="rounded-lg bg-white p-3 text-sm">{template?.body || 'Inga meddelanden skickas utan en godkänd mall. Mottagarnas valda språk måste matcha mallen.'}</p>
    </div> : <label className="block text-sm">Meddelande<textarea maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} className="mt-2 block min-h-32 w-full rounded-lg border p-3" /></label>}
    <div className="rounded-xl bg-white p-4">
      <div className="mb-3 flex justify-between"><strong>{labels[channel]}-gruppen ({group.length}) · Valda kontakter ({reach})</strong><button disabled={busy} onClick={() => setSelected(eligible.slice(0,50).map(d => d.id))} className="text-sm">Markera upp till 50</button></div>
      {!group.length && <p className="text-sm">Inga givare har valt denna kanal.</p>}
      {group.map(d => <label key={d.id} className="flex items-center gap-2 py-1"><input type="checkbox" disabled={busy || !eligible.includes(d) || (!selected.includes(d.id) && selected.length >= 50)} checked={selected.includes(d.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids,d.id] : ids.filter(id => id !== d.id))} />{d.full_name}<span className="text-xs text-mosque-ink/60">{!recipientAddress(d, channel) ? 'Kontaktuppgifter behöver rättas' : channel === 'whatsapp' && template && d.preferred_language !== template.language ? 'Annat språk än mallen' : ''}</span></label>)}
    </div>
    <button disabled={busy || !providers[channel] || !reach || (channel === 'whatsapp' ? !template : !message.trim())} onClick={send} className="rounded-lg bg-mosque-emerald px-4 py-2 text-white disabled:opacity-40">{busy ? 'Skickar…' : `Skicka ${labels[channel]} (${reach})`}</button>
    {notice && <p role="status" className="rounded-lg bg-white p-3 text-sm">{notice}</p>}
    <h2 className="font-bold">Utskickshistorik</h2>
    {log.map(entry => <article key={entry.id} className="rounded-lg bg-white p-3 text-sm"><strong>{entry.channel.toUpperCase()}</strong> · {entry.status === 'legacy' || !entry.status ? (entry.simulated ? 'Tidigare simulering' : 'Äldre utskick') : `${entry.status} · ${entry.accepted_count} accepterade · ${entry.failed_count} misslyckade`}<p className="truncate">{entry.message}</p></article>)}
  </section>;
}
