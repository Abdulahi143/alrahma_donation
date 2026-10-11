'use client';

import { useState } from 'react';
import { Lang, CommPref, TransparencyFile } from '@/lib/types';
import { t } from '@/lib/i18n';
import { formText, validateRegistration } from '@/lib/registration';

// Registration + GDPR consent capture. Submits to /api/register, which
// writes the donor, the pending donation/plan, and an immutable consent_log
// row server-side using the service-role key (see lib/supabase/server.ts).
export default function RegisterForm({ lang, transparencyFiles }: { lang: Lang; transparencyFiles: TransparencyFile[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'onetime' | 'monthly'>('onetime');
  const [months, setMonths] = useState<2 | 6 | 12>(6);
  const [comms, setComms] = useState<Record<CommPref, boolean>>({
    email: false,
    sms: false,
    whatsapp: false,
    none: true
  });
  const [consent, setConsent] = useState(false);
  const [publicDisplayConsent, setPublicDisplayConsent] = useState(false);
  const [displayMode, setDisplayMode] = useState<'anonymous' | 'entered' | 'custom'>('anonymous');
  const [displayName, setDisplayName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'swish' | 'bank_transfer'>('swish');
  const [reference, setReference] = useState('');
  const text = formText[lang];
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleComm = (key: CommPref) => {
    if (key === 'none') {
      setComms({ email: false, sms: false, whatsapp: false, none: true });
    } else {
      setComms((c) => ({ ...c, none: false, [key]: !c[key] }));
    }
  };

  const disabled = !name || !email || !amount || !consent || loading;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    const payload = {
      fullName: name, email, phone, amountSek: Number(amount), preferredLanguage: lang,
      frequency, months: frequency === 'monthly' ? months : null, comms,
      gdprConsent: consent, publicDisplayConsent, paymentMethod, displayMode, displayName
    };
    if (!validateRegistration(payload)) { setError(text.invalid); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) { setError(text[result.error] || text.failed); return; }
      setReference(result.reference);
      setSubmitted(true);
    } catch (e) {
      setError(text.failed);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-6 rounded-[20px] border border-mosque-mint/35 bg-mosque-mint/10 p-7 text-center backdrop-blur">
        <div className="mb-2 text-3xl">✅</div>
        <div className="mb-1.5 text-lg font-extrabold text-mosque-cream">{t(lang, 'thankYou')}</div>
        <div className="mx-auto max-w-md text-[13px] leading-relaxed text-mosque-mint/70">
          {text.pending}
        </div>
        <div className="mt-4 text-sm text-mosque-mint/70">{text.reference}</div>
        <div className="mt-2 break-all font-mono font-bold text-mosque-gold" dir="ltr">{reference}</div>

        {transparencyFiles.length > 0 && (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
            <div className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-mosque-mint/60">
              Se vad som verkligen görs med insamlade medel
            </div>
            <div className="flex flex-col gap-2">
              {transparencyFiles.map((f, i) => (
                <a
                  key={i}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-mosque-cream hover:bg-white/[0.1]"
                >
                  <span>📎</span>
                  {f.label || f.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-[20px] border border-white/10 bg-white/5 p-7 backdrop-blur">
      <div className="mb-1 text-lg font-extrabold">{t(lang, 'registerTitle')}</div>
      <div className="mb-5 text-[13px] text-mosque-mint/70">{t(lang, 'registerSubtitle')}</div>

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label={t(lang, 'fullName')} value={name} onChange={setName} placeholder="e.g. Ali Hassan" />
        <Field type="email" label={t(lang, 'email')} value={email} onChange={setEmail} placeholder="name@email.com" />
        <Field type="tel" required={comms.sms || comms.whatsapp} label={t(lang, 'phone')} value={phone} onChange={setPhone} placeholder="+46 70 000 00 00" />
        <Field type="number" label={t(lang, 'amount')} value={amount} onChange={setAmount} placeholder="1000" />
      </div>
      <label className="mb-4 block text-sm">
        {text.paymentMethod}
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'swish' | 'bank_transfer')} className="mt-2 block w-full rounded-lg bg-mosque-deep p-3">
          <option value="swish">Swish</option>
          <option value="bank_transfer">{text.bankTransfer}</option>
        </select>
      </label>

      <div className="mb-4">
        <div className="mb-2 text-xs font-bold text-mosque-mint/70">{t(lang, 'plan')}</div>
        <div className="flex flex-wrap gap-2">
          {(['onetime', 'monthly'] as const).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFrequency(f)}
              className={`rounded-lg border border-white/15 px-4 py-2 text-sm font-bold ${
                frequency === f ? 'bg-mosque-gold/90 text-mosque-deep' : 'bg-transparent text-mosque-cream/80'
              }`}
            >
              {t(lang, f === 'onetime' ? 'oneTime' : 'monthly')}
            </button>
          ))}
        </div>
        {frequency === 'monthly' && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {([2, 6, 12] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMonths(m)}
                className={`rounded-lg border border-white/15 px-3.5 py-2 text-sm font-semibold ${
                  months === m ? 'bg-mosque-mint/25 text-mosque-cream' : 'bg-transparent text-mosque-cream/70'
                }`}
              >
                {m} mo
              </button>
            ))}
          </div>
        )}
        {frequency === 'monthly' && <p className="mt-2 text-xs text-mosque-mint/70">{text.planTotal}</p>}
      </div>

      <div className="mb-4.5 mb-4">
        <p className="mb-2 text-xs text-mosque-mint/70">{text.notificationConsent}</p>
        <div className="mb-2 text-xs font-bold text-mosque-mint/70">{t(lang, 'communication')}</div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['email', '✉️'],
              ['sms', '💬'],
              ['whatsapp', '📱'],
              ['none', '🚫']
            ] as [CommPref, string][]
          ).map(([key, icon]) => (
            <button
              type="button"
              aria-pressed={comms[key]}
              key={key}
              onClick={() => toggleComm(key)}
              className={`flex items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-semibold ${
                comms[key] ? 'bg-mosque-mint/25 text-mosque-cream' : 'bg-transparent text-mosque-cream/70'
              }`}
            >
              <span>{icon}</span>
              {key === 'none' ? text.none : key}
            </button>
          ))}
        </div>
      </div>

      <label className="mb-4.5 mb-4 flex items-start gap-2.5 rounded-lg bg-white/[0.04] p-3.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={() => setConsent((c) => !c)}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <span className="text-[12.5px] leading-relaxed text-mosque-mint/80">
          {t(lang, 'gdprText')}{' '}
          <a href="/privacy" className="font-semibold text-mosque-gold">
            {t(lang, 'privacyLink')}
          </a>
        </span>
      </label>
      <fieldset className="mb-4 rounded-lg bg-white/[0.04] p-3.5">
        <legend className="text-sm font-bold">{text.displayChoice}</legend>
        <p className="mb-3 text-xs text-mosque-mint/80">{text.displayHelp}</p>
        {(['anonymous', 'entered', 'custom'] as const).map(mode => (
          <label key={mode} className="mb-2 flex items-center gap-2 text-sm">
            <input type="radio" name="displayMode" value={mode} checked={displayMode === mode} onChange={() => { setDisplayMode(mode); setPublicDisplayConsent(false); }} />
            {mode === 'anonymous' ? text.anonymous : mode === 'entered' ? text.enteredName : text.customName}
          </label>
        ))}
        {displayMode === 'custom' && <label className="mt-3 block text-sm">
          {text.displayName}
          <input required maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-2 block w-full rounded-lg border border-white/15 bg-white/[0.06] p-3" />
        </label>}
        {displayMode !== 'anonymous' && <p className="mt-3 break-words text-sm text-mosque-gold">{text.displayName}: {displayMode === 'entered' ? name : displayName}</p>}
      </fieldset>
      {displayMode !== 'anonymous' && <label className="mb-4 flex items-start gap-2.5 rounded-lg bg-white/[0.04] p-3.5 text-xs text-mosque-mint/80">
        <input type="checkbox" checked={publicDisplayConsent} onChange={e => setPublicDisplayConsent(e.target.checked)} />
        <span>{text.displayConsent}</span>
      </label>}

      {error && <div role="alert" className="mb-3 text-sm font-semibold text-red-300">{error}</div>}

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-xl bg-mosque-gold py-3.5 font-extrabold text-mosque-deep disabled:opacity-40"
      >
        {loading ? '…' : t(lang, 'submit')}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = true
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: 'text' | 'email' | 'tel' | 'number';
  required?: boolean;
}) {
  return (
    <label>
      <div className="mb-1.5 text-xs font-bold text-mosque-mint/70">{label}</div>
      <input
        type={type}
        required={required}
        min={type === 'number' ? 1 : undefined}
        max={type === 'number' ? 10000000 : undefined}
        step={type === 'number' ? 1 : undefined}
        maxLength={type === 'text' ? 120 : type === 'email' ? 254 : type === 'tel' ? 30 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-mosque-cream placeholder:text-mosque-cream/30"
      />
    </label>
  );
}
