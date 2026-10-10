-- Al-Rahma Mosque donation platform schema
-- Run in the Supabase SQL editor, or via supabase db push

create extension if not exists "pgcrypto";

-- Donors: registered supporters (GDPR data subject)
create table if not exists donors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text,
  preferred_language text default 'en' check (preferred_language in ('en','sv','ar')),
  comm_email boolean default true,
  comm_sms boolean default false,
  comm_whatsapp boolean default false,
  comm_opt_out boolean default false,
  gdpr_consent boolean not null default false,
  gdpr_consent_at timestamptz,
  marketing_consent boolean default false,
  created_at timestamptz not null default now(),
  -- GDPR: right-to-erasure support. Soft-delete keeps donation totals intact
  -- while scrubbing personal fields; a scheduled job can hard-delete after
  -- the retention window (see README "GDPR" section).
  deleted_at timestamptz
);

-- Recurring pledges (2/6/12 month plans)
create table if not exists payment_plans (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references donors(id) on delete set null,
  display_name text not null,
  total_amount_sek integer not null check (total_amount_sek > 0),
  months integer not null check (months in (2,6,12)),
  amount_per_month_sek integer generated always as (total_amount_sek / months) stored,
  installments_paid integer not null default 0,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now()
);

-- One-off donations, or a single installment against a payment plan
create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references donors(id) on delete set null,
  display_name text not null,           -- snapshot at time of gift (survives donor deletion)
  amount_sek integer not null check (amount_sek > 0),
  method text not null check (method in ('cash','swish','card','bank_transfer')),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  message text,
  is_anonymous boolean default false,
  payment_plan_id uuid references payment_plans(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Immutable log of consent capture, kept even if the donor record is scrubbed
-- (Article 7(1) GDPR: controller must be able to demonstrate consent was given)
create table if not exists consent_log (
  id uuid primary key default gen_random_uuid(),
  donor_email text not null,
  consent_text_shown text not null,
  consent_given boolean not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Campaign-level running total, updated by trigger below for fast reads
create table if not exists campaign_totals (
  id text primary key default 'main',
  goal_sek integer not null default 15000000,
  raised_sek integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into campaign_totals (id) values ('main') on conflict do nothing;

create or replace function bump_campaign_total() returns trigger as $$
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'confirmed' and OLD.status <> 'confirmed') then
    update campaign_totals set raised_sek = raised_sek + NEW.amount_sek, updated_at = now() where id = 'main';
  elsif (TG_OP = 'INSERT' and NEW.status = 'confirmed') then
    update campaign_totals set raised_sek = raised_sek + NEW.amount_sek, updated_at = now() where id = 'main';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_bump_campaign_total on donations;
create trigger trg_bump_campaign_total
  after insert or update on donations
  for each row execute function bump_campaign_total();

-- Realtime: enable so the public tracker can subscribe to new confirmed donations
alter publication supabase_realtime add table donations;

-- Payment accounts shown to donors at checkout (Swish/Bankgiro/IBAN), editable in
-- the admin "Payment accounts" tab. Single row, same pattern as campaign_totals.
create table if not exists campaign_settings (
  id text primary key default 'main',
  swish_number text not null default '123 456 78 90',
  bankgiro text not null default '5678-1234',
  iban text not null default 'SE45 5000 0000 0583 9825 7466',
  -- Live/paused toggle for the public tracker (admin "Betalkonton" tab).
  -- When false, the tracker shows paused_message instead of the live feed
  -- and registration form.
  is_live boolean not null default true,
  paused_message text not null default 'Kampanjen är pausad för tillfället. Tack för ert tålamod — vi är snart tillbaka.',
  -- Transparency attachments (receipts, progress photos, contractor
  -- invoices) donors see on the post-donation thank-you screen, as
  -- {label, url} pairs. Admin pastes links to files hosted in Supabase
  -- Storage or elsewhere; no upload pipeline is implied here.
  transparency_files jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into campaign_settings (id) values ('main') on conflict do nothing;

-- Migration for existing deployments created before this column set:
alter table campaign_settings add column if not exists is_live boolean not null default true;
alter table campaign_settings add column if not exists paused_message text not null default 'Kampanjen är pausad för tillfället. Tack för ert tålamod — vi är snart tillbaka.';
alter table campaign_settings add column if not exists transparency_files jsonb not null default '[]'::jsonb;

-- Audit trail of every SMS/email broadcast sent from the admin Broadcast tab.
-- Does not store per-recipient rows (only a count) to avoid duplicating PII;
-- the actual send goes through the provider configured in lib/broadcast.ts.
create table if not exists broadcast_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms','email')),
  recipient_count integer not null,
  message text not null,
  simulated boolean not null default true,
  created_at timestamptz not null default now()
);
