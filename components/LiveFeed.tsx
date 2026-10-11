'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { PublicDonation, Lang } from '@/lib/types';
import { fmtSEK, timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';

// Refresh only safe display fields; private donation rows are never broadcast.
export default function LiveFeed({ lang, initial }: { lang: Lang; initial: PublicDonation[] }) {
  const [donations, setDonations] = useState<PublicDonation[]>(initial);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabaseBrowser.from('public_donations')
        .select('*').order('created_at', { ascending: false }).limit(30);
      if (active && !error && data) setDonations(data);
    };
    const timer = setInterval(refresh, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 p-7 backdrop-blur">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 animate-pulseGlow rounded-full bg-mosque-mint" />
        <div className="text-base font-extrabold">{t(lang, 'liveFeed')}</div>
      </div>

      <div className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto">
        {donations.map((d) => (
          <div
            key={d.id}
            className="flex animate-slideIn items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3.5"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mosque-emerald to-mosque-forest text-sm font-extrabold text-mosque-cream">
              {(d.is_anonymous ? 'A' : d.display_name.charAt(0)).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{d.is_anonymous ? 'Anonymous' : d.display_name}</div>
              {d.message && (
                <div className="truncate text-[13px] italic text-mosque-mint/70">"{d.message}"</div>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-[17px] font-extrabold text-mosque-gold">{fmtSEK(d.amount_sek)}</div>
              <div className="mt-0.5 text-xs text-mosque-mint/50">{timeAgo(d.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
