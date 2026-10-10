-- Row Level Security. Enable on every table that holds personal data.
alter table donors enable row level security;
alter table donations enable row level security;
alter table payment_plans enable row level security;
alter table consent_log enable row level security;
alter table campaign_totals enable row level security;

-- Public (anon key): can read confirmed donations only, for the live tracker.
-- No personal columns (email/phone) are exposed by the API views used client-side.
create policy "public can read confirmed donations"
  on donations for select
  using (status = 'confirmed');

create policy "public can read campaign totals"
  on campaign_totals for select
  using (true);

-- Public can INSERT a donor registration and a pending donation/plan themselves
-- (the register form), but cannot read other donors' rows.
create policy "anyone can register as a donor"
  on donors for insert
  with check (true);

create policy "anyone can submit a pending donation"
  on donations for insert
  with check (status = 'pending');

create policy "anyone can submit a pending payment plan"
  on payment_plans for insert
  with check (status = 'active');

create policy "anyone can write their own consent log entry"
  on consent_log for insert
  with check (true);

-- Everything else (reading donor PII, updating status, approving payments,
-- exporting reports) is done from the server using the service-role key in
-- app/api/**, which bypasses RLS deliberately and must stay behind admin auth.
-- Never expose SUPABASE_SERVICE_ROLE_KEY to the client.

-- Payment account settings and broadcast history are admin-only: RLS is on
-- with no policies, so only the service-role key (used in app/api/admin/**,
-- gated by requireAdmin) can read or write them.
alter table campaign_settings enable row level security;
alter table broadcast_log enable row level security;
