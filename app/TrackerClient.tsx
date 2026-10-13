'use client';

import { Donation, Lang } from '@/lib/types';
import PaymentQR, { QrCode } from '@/components/PaymentQR';

import BankTransfer from '@/components/BankTransfer';
import LanguageDropdown from '@/components/LanguageDropdown';
import LiveFeed from '@/components/LiveFeed';
import ProgressCard from '@/components/ProgressCard';
import { t } from '@/lib/i18n';
import { useState } from 'react';

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
  initialDonations: Donation[];
  subtitle?: string | null;
  isLive: boolean;
  pausedMessage?: string | null;
  qrCodes: { swish?: QrCode; paypal?: QrCode; card?: QrCode; bank?: QrCode };
}) {
  const [lang, setLang] = useState<Lang>('en');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div
      dir={dir}
      className="min-h-screen w-full bg-[radial-gradient(circle_at_50%_-10%,#1a3c21_0%,#0e2a14_55%,#081a0c_100%)] px-4 pb-10 pt-5 sm:px-8 sm:pb-12 sm:pt-8 text-mosque-cream"
    >
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Masjid Al-Rahma" className="h-11 w-11 flex-shrink-0 sm:h-12 sm:w-12" />
            <div>
              <div className="text-base font-extrabold sm:text-lg">{t(lang, 'mosqueName')}</div>
              <div className="text-xs font-medium text-mosque-mint/70">{subtitle}</div>
            </div>
          </div>
          <LanguageDropdown lang={lang} onChange={setLang} />
        </div>

        {/* <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <span className="inline-block rounded-full border border-mosque-gold/30 bg-mosque-gold/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-mosque-gold">
            ● {t(lang, 'heroBadge')}
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">{t(lang, 'heroTitle')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-mosque-cream/75 sm:text-base">{t(lang, 'heroSubtitle')}</p>
        </header>
 */}
        <div className="mb-5 sm:mb-6">
          <ProgressCard lang={lang} raised={raised} goal={goal} />
        </div>

        {isLive ? (
          <>
            <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <PaymentQR lang={lang} codes={qrCodes} />

              <div className="flex flex-col gap-5 sm:gap-6">
                <BankTransfer lang={lang} bank={qrCodes.bank} />
              </div>
            </div>

            <div className="mt-5 sm:mt-6">
              <LiveFeed lang={lang} initial={initialDonations} />
            </div>

            <div className="mt-5 flex flex-col items-center gap-4 rounded-3xl border border-mosque-gold/25 bg-gradient-to-b from-mosque-gold/[0.10] to-mosque-gold/[0.03] p-6 text-center shadow-xl shadow-black/20 sm:mt-6 sm:p-8">
              <span className="rounded-full border border-mosque-gold/30 bg-mosque-gold/10 px-3 py-0.5 text-xs font-semibold text-mosque-gold">
                {t(lang, 'sustained')}
              </span>
              <h2 className="text-2xl font-extrabold sm:text-3xl">{t(lang, 'monthlyTitle')}</h2>
              <a
                href={`/supporter?lang=${lang}`}
                className="w-full max-w-md rounded-xl bg-gradient-to-r from-[#e0c068] to-[#f2c230] px-6 py-3.5 text-center text-base font-extrabold text-mosque-deep shadow-lg transition hover:brightness-110"
              >
                {t(lang, 'monthlyCta')}
              </a>
              <div className="text-xs text-mosque-cream/60">{t(lang, 'monthlyHint')}</div>
            </div>

            <figure className="mt-5 rounded-3xl border border-white/10 bg-black/25 px-6 py-10 text-center sm:mt-6 sm:px-10 sm:py-12">
              <blockquote className="mx-auto max-w-2xl text-2xl italic leading-snug sm:text-3xl">{t(lang, 'quote')}</blockquote>
              <figcaption className="mt-5 text-xs font-semibold uppercase tracking-widest text-mosque-gold">— {t(lang, 'quoteSource')}</figcaption>
            </figure>
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

        <footer className="mt-10 border-t border-white/10 pt-8 text-center">
          <div className="text-2xl text-mosque-cream/90">{t(lang, 'jazak')}</div>
          <div className="mt-2 text-xs text-mosque-cream/45">© {new Date().getFullYear()} {t(lang, 'mosqueName')}</div>
        </footer>
      </div>
    </div>
  );
}
