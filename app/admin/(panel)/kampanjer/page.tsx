import Link from 'next/link';
import { ButtonLink, Card, GoalBars, PageHead, Pill } from '@/components/admin/ui';
import { fmtDate } from '@/lib/admin/dates';
import { CAMPAIGN_STATUS_SV, FUND_SV } from '@/lib/admin/labels';
import { getCampaignsWithStats } from '@/lib/admin/queries';

const TONE = { draft: 'amber', published: 'green', paused: 'grey', ended: 'grey' } as const;

export default async function Campaigns() {
  const rows = await getCampaignsWithStats();

  return (
    <div>
      <PageHead
        title="Kampanjer"
        sub="Varje insamling har eget mål, egen sida och egna summor. Summorna räknas ut av databasen."
        action={<ButtonLink href="/admin/kampanjer/ny" primary>Ny kampanj</ButtonLink>}
      />
      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="font-bold">Ingen kampanj än</p>
          <p className="mt-1 text-sm text-mosque-ink/60">Skapa din första kampanj. Den syns inte för givare förrän du sätter den som Publicerad.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ campaign: c, stats }) => (
            <Card key={c.id}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Link href={`/admin/kampanjer/${c.id}`} className="text-lg font-extrabold hover:underline">{c.title}</Link>
                <Pill tone={TONE[c.status]}>{CAMPAIGN_STATUS_SV[c.status]}</Pill>
              </div>
              <div className="mb-4 text-xs text-mosque-ink/50">
                {FUND_SV[c.fund_type]}
                {c.starts_on && ` · ${fmtDate(c.starts_on)}`}
                {c.ends_on && ` till ${fmtDate(c.ends_on)}`}
              </div>
              <GoalBars confirmed={stats.confirmed_sek} pledged={stats.pledged_outstanding_sek} goal={c.goal_sek} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-mosque-ink/60">{stats.donors} givare · {stats.gifts} gåvor</span>
                <Link href={`/admin/kampanjer/${c.id}`} className="font-bold text-mosque-emerald underline">Redigera</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
