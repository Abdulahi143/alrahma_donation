import Link from 'next/link';
import { fmtSEK } from '@/lib/format';

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-mosque-ink/60">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-mosque-ink/10 bg-white p-5 ${className}`}>{children}</div>;
}

const PILL: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  grey: 'bg-mosque-ink/10 text-mosque-ink/70'
};
export function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL[tone]}`}>{children}</span>;
}

export function ButtonLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={`inline-block rounded-lg px-4 py-2.5 text-sm font-bold ${primary ? 'bg-mosque-emerald text-white hover:brightness-110' : 'bg-mosque-ink/10 text-mosque-ink hover:bg-mosque-ink/15'}`}>
      {children}
    </Link>
  );
}

// Two bars against the goal: confirmed money and outstanding pledges.
export function GoalBars({ confirmed, pledged, goal }: { confirmed: number; pledged: number; goal: number }) {
  const pct = (n: number) => Math.min(100, Math.round((n / goal) * 100));
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between gap-2 text-sm">
          <span className="font-semibold">Insamlat</span>
          <span className="tabular-nums">{fmtSEK(confirmed)} <span className="text-mosque-ink/50">({pct(confirmed)} %)</span></span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-mosque-ink/10" role="progressbar" aria-label="Insamlat" aria-valuenow={pct(confirmed)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-mosque-emerald" style={{ width: `${pct(confirmed)}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between gap-2 text-sm">
          <span className="font-semibold">Utlovat</span>
          <span className="tabular-nums">{fmtSEK(pledged)} <span className="text-mosque-ink/50">({pct(pledged)} %)</span></span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-mosque-ink/10" role="progressbar" aria-label="Utlovat" aria-valuenow={pct(pledged)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-mosque-gold" style={{ width: `${pct(pledged)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ComingSoon({ title, why, phase, children }: { title: string; why: string; phase: string; children?: React.ReactNode }) {
  return (
    <div>
      <PageHead title={title} sub={why} />
      <Card className="max-w-xl">
        <Pill tone="amber">{phase}</Pill>
        <p className="mt-3 text-sm text-mosque-ink/70">Den här sidan byggs i en senare fas. Databasen för den finns redan.</p>
        {children}
      </Card>
    </div>
  );
}
