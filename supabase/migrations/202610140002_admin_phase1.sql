-- Phase 1 of the admin rebuild: campaigns, transactions, pledges, donors,
-- audit log. These are NEW tables; the legacy tables (donations, donors,
-- payment_plans, campaign_settings ...) are untouched and still power the
-- public tracker until a later phase replaces it.
-- Run after schema.sql / admins.sql. Safe to re-run.
--
-- Access model: every table has RLS enabled and (except published campaigns)
-- NO policy, so only the server (service-role key, behind admin auth) can
-- read or write. There are no roles yet: any row in `admins` is a full admin.

-- ---------------------------------------------------------------- enums
do $$ begin
  create type campaign_status as enum ('draft', 'published', 'paused', 'ended');
exception when duplicate_object then null; end $$;
do $$ begin
  create type fund_type as enum ('sadaqah', 'zakat', 'building', 'other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type tx_method as enum ('swish', 'card', 'paypal', 'cash', 'bank_transfer', 'import');
exception when duplicate_object then null; end $$;
do $$ begin
  -- pending_provider = online payment started but not yet confirmed by the provider
  create type tx_status as enum ('pending_provider', 'awaiting_approval', 'confirmed', 'rejected', 'refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pledge_status as enum ('active', 'cancelled');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_text text not null default '',
  long_text text not null default '',
  image_url text not null default '',
  goal_sek integer not null check (goal_sek > 0),
  starts_on date,
  ends_on date,
  fund_type fund_type not null default 'sadaqah',
  -- Do outstanding pledges count toward the public total? Default no.
  pledges_count_public boolean not null default false,
  status campaign_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- --------------------------------------------------------------- donors
-- Only created when needed (pledge, contact consent, donor-provided email).
-- Anonymous online gifts never create a row here.
create table if not exists donor_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  anonymized_at timestamptz,
  check (phone is not null or email is not null or anonymized_at is not null)
);
create index if not exists donor_profiles_phone_idx on donor_profiles (phone);
create index if not exists donor_profiles_email_idx on donor_profiles (lower(email));

-- One row per consent decision, per purpose. Latest row per (donor, purpose) wins.
create table if not exists donor_consents (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references donor_profiles(id) on delete cascade,
  purpose text not null check (purpose in ('storage', 'contact_sms', 'contact_email', 'show_first_name')),
  granted boolean not null,
  source text not null check (source in ('form', 'event', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists donor_consents_donor_idx on donor_consents (donor_id, purpose, created_at desc);

-- --------------------------------------------------------------- pledges
create table if not exists pledges (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  donor_id uuid not null references donor_profiles(id) on delete restrict,
  total_sek integer not null check (total_sek > 0),
  status pledge_status not null default 'active',
  cancel_reason text,
  reminders boolean not null default true,
  created_at timestamptz not null default now(),
  check (status <> 'cancelled' or cancel_reason is not null)
);

create table if not exists pledge_installments (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null references pledges(id) on delete cascade,
  seq integer not null check (seq > 0),
  due_on date not null,
  amount_sek integer not null check (amount_sek > 0),
  unique (pledge_id, seq)
);

-- ---------------------------------------------------------- transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  amount_sek integer not null check (amount_sek > 0),
  received_on date not null default current_date,
  method tx_method not null,
  status tx_status not null,
  donor_id uuid references donor_profiles(id) on delete set null,
  -- First name shown publicly; null = "Anonym". Never a surname.
  display_name text,
  installment_id uuid references pledge_installments(id) on delete set null,
  receipt_no text,
  -- Manual / imported rows: who entered and who approved (admin user ids).
  registered_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  -- Online rows: provider reference, locked from edits in the app.
  provider_ref text,
  refund_reason text,
  created_at timestamptz not null default now(),
  -- Four eyes, enforced in the database as well as the UI.
  check (approved_by is null or approved_by <> registered_by),
  check (
    method in ('swish', 'card', 'paypal')
    or status in ('awaiting_approval', 'rejected')
    or approved_by is not null
  ),
  check (status <> 'refunded' or refund_reason is not null)
);
create index if not exists transactions_campaign_idx on transactions (campaign_id, status);
create index if not exists transactions_received_idx on transactions (received_on desc);
create index if not exists transactions_status_idx on transactions (status, created_at);

-- ------------------------------------------------------------ audit log
-- Append-only: UPDATE/DELETE are blocked for everyone, including the service role.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_name text,
  action text not null,       -- e.g. campaign.create, campaign.update
  object_type text not null,
  object_id text,
  object_label text,
  changes jsonb,              -- {field: {from, to}}
  ip text
);
create index if not exists audit_log_at_idx on audit_log (at desc);

create or replace function audit_log_immutable() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;
drop trigger if exists trg_audit_log_immutable on audit_log;
create trigger trg_audit_log_immutable
  before update or delete on audit_log
  for each row execute function audit_log_immutable();
drop trigger if exists trg_audit_log_no_truncate on audit_log;
create trigger trg_audit_log_no_truncate
  before truncate on audit_log
  for each statement execute function audit_log_immutable();

-- --------------------------------------------------------------- totals
-- Totals are always computed here, never typed in.
create or replace view installment_balances with (security_invoker = true) as
select
  i.id as installment_id,
  i.pledge_id,
  p.campaign_id,
  i.seq,
  i.due_on,
  i.amount_sek,
  coalesce(sum(t.amount_sek) filter (where t.status = 'confirmed'), 0)::int as paid_sek,
  greatest(i.amount_sek - coalesce(sum(t.amount_sek) filter (where t.status = 'confirmed'), 0), 0)::int as outstanding_sek,
  p.status as pledge_status
from pledge_installments i
join pledges p on p.id = i.pledge_id
left join transactions t on t.installment_id = i.id
group by i.id, p.id;

create or replace view campaign_stats with (security_invoker = true) as
select
  c.id as campaign_id,
  coalesce(tx.confirmed_sek, 0)::int as confirmed_sek,
  coalesce(tx.gifts, 0)::int as gifts,
  coalesce(tx.donors, 0)::int as donors,
  coalesce(pl.outstanding_sek, 0)::int as pledged_outstanding_sek
from campaigns c
left join (
  select campaign_id,
         sum(amount_sek) as confirmed_sek,
         count(*) as gifts,
         -- each anonymous gift counts as one donor
         count(distinct coalesce(donor_id::text, id::text)) as donors
  from transactions where status = 'confirmed' group by campaign_id
) tx on tx.campaign_id = c.id
left join (
  select campaign_id, sum(outstanding_sek) as outstanding_sek
  from installment_balances where pledge_status = 'active' group by campaign_id
) pl on pl.campaign_id = c.id;

-- ------------------------------------------------------------------ RLS
alter table campaigns enable row level security;
alter table donor_profiles enable row level security;
alter table donor_consents enable row level security;
alter table pledges enable row level security;
alter table pledge_installments enable row level security;
alter table transactions enable row level security;
alter table audit_log enable row level security;

drop policy if exists "public can read published campaigns" on campaigns;
create policy "public can read published campaigns"
  on campaigns for select using (status = 'published');

-- ------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('campaign-images', 'campaign-images', true)
on conflict do nothing;
