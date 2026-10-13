import { Lang } from '@/lib/types';
import { t } from '@/lib/i18n';

export interface QrCode {
  kind: 'swish' | 'paypal';
  svg: string;
  detail?: string;
}

// Swish / PayPal QR codes shown above the live feed. SVGs are generated
// server-side from the payment URLs (see lib/qr.ts), so they are trusted.
export default function PaymentQR({ lang, codes }: { lang: Lang; codes: { swish?: QrCode; paypal?: QrCode } }) {
  const entries = [codes.swish, codes.paypal].filter(Boolean) as QrCode[];
  const hintKey = { swish: 'scanSwish', paypal: 'scanPaypal' } as const;
  if (entries.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 p-7 backdrop-blur">
      <div className="mb-1 text-base font-extrabold">{t(lang, 'giveNow')}</div>
      <div className="mb-5 text-[13px] text-mosque-mint/70">{t(lang, 'giveNowSubtitle')}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {entries.map((c) => (
          <div key={c.kind} className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
            <div className="mb-3 text-sm font-extrabold text-mosque-gold">{t(lang, c.kind)}</div>
            <div
              className="h-44 w-44 rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: c.svg }}
              role="img"
              aria-label={`${t(lang, c.kind)} QR`}
            />
            {c.detail && <div className="mt-3 text-sm font-bold">{c.detail}</div>}
            <div className="mt-1 text-xs text-mosque-mint/60">{t(lang, hintKey[c.kind])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
