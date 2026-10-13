'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Donation, Lang } from '@/lib/types';
import { fmtSEK, timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CARD } from './PaymentQR';

const METHOD: Record<Donation['method'], string> = {
  swish: 'Swish',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank'
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

// Subscribes to Supabase Realtime for newly confirmed donations so the
// tracker updates the instant an admin approves a payment.
export default function LiveFeed({ lang, initial }: { lang: Lang; initial: Donation[] }) {
  const [donations, setDonations] = useState<Donation[]>(initial);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('public:donations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'donations', filter: 'status=eq.confirmed' },
        (payload) => {
          const row = payload.new as Donation;
          setDonations((prev) => [row, ...prev.filter((d) => d.id !== row.id)].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  return (
    <div className={`${CARD} p-5 sm:p-8`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-pulseGlow rounded-full bg-mosque-mint" />
          <h2 className="text-2xl font-semibold">{t(lang, 'liveTitle')}</h2>
        </div>
        <div className="text-xs text-mosque-cream/55">{t(lang, 'liveSync')}</div>
      </div>

      <div className="mt-5 flex max-h-[460px] flex-col gap-3 overflow-y-auto">
        {donations.length === 0 && (
          <div className="py-6 text-center text-sm text-mosque-cream/60">{t(lang, 'liveEmpty')}</div>
        )}
        {donations.map((d) => (
          <div
            key={d.id}
            className="flex animate-slideIn items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-black/20 p-3.5"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-mosque-gold/30 bg-mosque-gold/10 text-xs font-bold text-mosque-gold">
              {d.is_anonymous ? '★' : initials(d.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{d.is_anonymous ? t(lang, 'anonymousSupporter') : d.display_name}</div>
              {d.message && <div className="truncate text-[13px] italic text-mosque-cream/55">“{d.message}”</div>}
            </div>
            <div className="flex-shrink-0 text-end">
              <div className="text-xl font-bold text-mosque-gold" dir="ltr">{fmtSEK(d.amount_sek)}</div>
              <div className="mt-0.5 text-[11px] text-mosque-cream/50">
                {timeAgo(d.created_at)} • {METHOD[d.method] ?? d.method}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center text-xs text-mosque-cream/55">{t(lang, 'liveFooter')}</div>
    </div>
  );
}
