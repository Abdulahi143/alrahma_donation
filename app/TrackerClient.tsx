'use client';

import { useState } from 'react';
import { PublicDonation, Lang, TransparencyFile } from '@/lib/types';
import { t } from '@/lib/i18n';
import LanguageDropdown from '@/components/LanguageDropdown';
import ProgressCard from '@/components/ProgressCard';
import LiveFeed from '@/components/LiveFeed';
import PaymentQR, { QrCode } from '@/components/PaymentQR';

// Client shell: owns the language toggle and composes the server-fetched
// totals/donations into the tracker layout.
export default function TrackerClient({
  goal,
  raised,
  initialDonations,
  subtitle,
  isLive,
  pausedMessage,
  qrCodes
}: {
  goal: number;
  raised: number;
  initialDonations: PublicDonation[];
  subtitle?: string | null;
  isLive: boolean;
  pausedMessage?: string | null;
  qrCodes: { swish?: QrCode; paypal?: QrCode };
}) {
  const [lang, setLang] = useState<Lang>('en');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div
      dir={dir}
      className="min-h-screen w-full bg-[radial-gradient(circle_at_50%_-10%,#1a3c21_0%,#0e2a14_55%,#081a0c_100%)] px-8 pb-12 pt-8 text-mosque-cream"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src="/logo.png" alt="Masjid Al-Rahma" className="h-14 w-14 flex-shrink-0" />
            <div>
              <div className="text-xl font-extrabold">{t(lang, 'mosqueName')}</div>
              <div className="text-[13px] font-medium text-mosque-mint/70">{subtitle || 'New Minaret & Hall Fund'}</div>
            </div>
          </div>
          <LanguageDropdown lang={lang} onChange={setLang} />
        </div>

        <div className="mb-6">
          <ProgressCard lang={lang} raised={raised} goal={goal} />
        </div>

        {isLive ? (
          <>
            <PaymentQR lang={lang} codes={qrCodes} />

            <div className="my-6 flex flex-col items-center gap-2 text-center">
              <a
                href={`/supporter?lang=${lang}`}
                className="rounded-xl bg-mosque-gold px-8 py-3.5 text-base font-extrabold text-mosque-deep shadow-lg transition hover:brightness-110"
              >
                {t(lang, 'becomeMonthly')}
              </a>
              <div className="text-[13px] text-mosque-mint/60">{t(lang, 'monthlyHint')}</div>
            </div>

            <LiveFeed lang={lang} initial={initialDonations} />
          </>
        ) : (
          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
            <div className="mb-3 text-3xl">⏸️</div>
            <div className="mb-1.5 text-lg font-extrabold">Kampanjen är pausad</div>
            <div className="mx-auto max-w-md text-sm leading-relaxed text-mosque-mint/70">
              {pausedMessage || 'Kampanjen är pausad för tillfället. Tack för ert tålamod — vi är snart tillbaka.'}
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-mosque-mint/40">
          JazakAllah Khair to everyone supporting this campaign
        </div>
      </div>
    </div>
  );
}
