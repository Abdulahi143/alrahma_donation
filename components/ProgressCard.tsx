import { Lang } from '@/lib/types';
import { t } from '@/lib/i18n';
import { CARD } from './PaymentQR';

const num = (n: number) => n.toLocaleString('sv-SE');

export default function ProgressCard({ lang, raised, goal }: { lang: Lang; raised: number; goal: number }) {
  const pct = Math.min(100, goal > 0 ? (raised / goal) * 100 : 0);

  return (
    <div className={`${CARD} p-5 sm:p-8`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-widest text-mosque-cream/60">{t(lang, 'totalRaised')}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="text-5xl font-bold leading-none sm:text-6xl" dir="ltr">
              {num(raised)} <span className="text-3xl font-semibold text-mosque-cream/70 sm:text-4xl">kr</span>
            </div>
            {raised === 0 && (
              <span className="rounded-md border border-mosque-mint/30 bg-mosque-emerald/20 px-2 py-0.5 text-xs font-semibold text-mosque-mint">
                {t(lang, 'justLaunched')}
              </span>
            )}
          </div>
        </div>
        <div className="text-end">
          <div className="text-sm font-semibold uppercase tracking-widest text-mosque-gold/80">{t(lang, 'targetGoal')}</div>
          <div className="mt-2 text-3xl font-bold text-mosque-gold sm:text-4xl" dir="ltr">
            {num(goal)} <span className="text-xl font-semibold">kr</span>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="mb-2.5 flex items-center gap-2 font-mono text-base font-bold">
          <span className="h-2 w-2 rounded-full bg-mosque-gold" />
          <span dir="ltr">{pct.toFixed(1)}%</span> {t(lang, 'funded')}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full min-w-[10px] rounded-full bg-gradient-to-r from-mosque-gold to-[#f2c230] transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
