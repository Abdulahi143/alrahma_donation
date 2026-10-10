'use client';

import { useState } from 'react';
import { Lang, CommPref, TransparencyFile } from '@/lib/types';
import { t } from '@/lib/i18n';

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
    email: true,
    sms: false,
    whatsapp: false,
    none: false
  });
  const [consent, setConsent] = useState(false);
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

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name,
          email,
          phone,
          amountSek: Number(amount),
          preferredLanguage: lang,
          frequency,
          months: frequency === 'monthly' ? months : null,
          comms,
          gdprConsent: consent
        })
      });
      if (!res.ok) throw new Error('Registration failed');
      setSubmitted(true);
    } catch (e) {
      setError('Something went wrong. Please try again.');
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
          Er donation är registrerad som väntande och bekräftas av administratören inom kort. Ni får en bekräftelse via {comms.email ? 'e-post' : comms.sms ? 'sms' : 'era valda kanaler'} när den är klar.
        </div>

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
    <div className="mt-6 rounded-[20px] border border-white/10 bg-white/5 p-7 backdrop-blur">
      <div className="mb-1 text-lg font-extrabold">{t(lang, 'registerTitle')}</div>
      <div className="mb-5 text-[13px] text-mosque-mint/70">{t(lang, 'registerSubtitle')}</div>

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label={t(lang, 'fullName')} value={name} onChange={setName} placeholder="e.g. Ali Hassan" />
        <Field label={t(lang, 'email')} value={email} onChange={setEmail} placeholder="name@email.com" />
        <Field label={t(lang, 'phone')} value={phone} onChange={setPhone} placeholder="+46 70 000 00 00" />
        <Field label={t(lang, 'amount')} value={amount} onChange={setAmount} placeholder="1000" />
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-bold text-mosque-mint/70">{t(lang, 'plan')}</div>
        <div className="flex flex-wrap gap-2">
          {(['onetime', 'monthly'] as const).map((f) => (
            <button
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
      </div>

      <div className="mb-4.5 mb-4">
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
              key={key}
              onClick={() => toggleComm(key)}
              className={`flex items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-semibold ${
                comms[key] ? 'bg-mosque-mint/25 text-mosque-cream' : 'bg-transparent text-mosque-cream/70'
              }`}
            >
              <span>{icon}</span>
              {key}
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

      {error && <div className="mb-3 text-sm font-semibold text-red-300">{error}</div>}

      <button
        onClick={submit}
        disabled={disabled}
        className="w-full rounded-xl bg-mosque-gold py-3.5 font-extrabold text-mosque-deep disabled:opacity-40"
      >
        {loading ? '…' : t(lang, 'submit')}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold text-mosque-mint/70">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-mosque-cream placeholder:text-mosque-cream/30"
      />
    </div>
  );
}
