import { fmtSEK } from '@/lib/format';
import { Lang } from '@/lib/types';
import { t } from '@/lib/i18n';

export default function ProgressCard({
  lang,
  raised,
  goal
}: {
  lang: Lang;
  raised: number;
  goal: number;
}) {
  const pct = Math.min(100, (raised / goal) * 100);

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 p-9 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mosque-mint/70">
            {t(lang, 'raisedLabel')}
          </div>
          <div className="text-5xl font-extrabold leading-none text-mosque-cream">{fmtSEK(raised)}</div>
        </div>
        <div className="text-right">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mosque-mint/70">
            {t(lang, 'goalLabel')}
          </div>
          <div className="text-3xl font-bold text-mosque-gold/90">{fmtSEK(goal)}</div>
        </div>
      </div>

      <div className="h-5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-mosque-emerald via-mosque-mint to-mosque-gold transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2.5 text-sm font-semibold text-mosque-cream/80">{pct.toFixed(1)}%</div>
    </div>
  );
}
