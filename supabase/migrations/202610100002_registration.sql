-- Registration is executed only by the server, in one transaction.
alter table public.donations add column if not exists reference text unique default ('AR-' || upper(replace(gen_random_uuid()::text, '-', '')));
alter table public.payment_plans add column if not exists reference text unique default ('AR-' || upper(replace(gen_random_uuid()::text, '-', '')));
alter table public.payment_plans add column if not exists method text not null default 'swish' check (method in ('swish', 'bank_transfer'));
alter table public.payment_plans add column if not exists is_anonymous boolean not null default true;
alter table public.consent_log add column if not exists purpose text not null default 'donation_processing';
alter table public.consent_log add column if not exists donor_id uuid references public.donors(id) on delete set null;
alter table public.consent_log add column if not exists registration_reference text;

-- The public endpoint must never allow callers to overwrite another donor by email.
-- Email is a contact address, not proof of identity; each submission has its own donor.
alter table public.donors drop constraint if exists donors_email_key;
create index if not exists donors_email_idx on public.donors(email);

drop policy if exists "anyone can register as a donor" on public.donors;
drop policy if exists "anyone can submit a pending donation" on public.donations;
drop policy if exists "anyone can submit a pending payment plan" on public.payment_plans;
drop policy if exists "anyone can write their own consent log entry" on public.consent_log;

-- Never expose donor IDs, references or other private columns on the live feed.
revoke select on public.donations from anon, authenticated;
grant select (id, display_name, amount_sek, status, message, is_anonymous, created_at) on public.donations to anon, authenticated;

create or replace function public.register_donation(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_donor uuid;
  registration_ref text;
  anonymous_display boolean := not (payload->>'publicDisplayConsent')::boolean;
  public_name text;
begin
  if not coalesce((payload->>'gdprConsent')::boolean, false)
     or (payload->>'amountSek')::integer not between 1 and 10000000
     or payload->>'paymentMethod' not in ('swish', 'bank_transfer')
     or payload->>'frequency' not in ('onetime', 'monthly') then
    raise exception 'Invalid registration';
  end if;
  if payload->>'frequency' = 'monthly' and (
     (payload->>'months')::integer not in (2,6,12)
     or (payload->>'amountSek')::integer % (payload->>'months')::integer <> 0) then
    raise exception 'Plan total must divide evenly by its number of months';
  end if;
  if not exists (select 1 from campaign_settings where id = 'main' and is_live) then
    raise exception 'Campaign is paused' using errcode = 'P0002';
  end if;
  insert into donors (full_name, email, phone, preferred_language, comm_email, comm_sms,
    comm_whatsapp, comm_opt_out, gdpr_consent, gdpr_consent_at)
  values (payload->>'fullName', payload->>'email', nullif(payload->>'phone', ''),
    payload->>'preferredLanguage', (payload->'comms'->>'email')::boolean,
    (payload->'comms'->>'sms')::boolean, (payload->'comms'->>'whatsapp')::boolean,
    (payload->'comms'->>'none')::boolean, true, now()) returning id into new_donor;
  public_name := case when anonymous_display then 'Anonymous' else payload->>'fullName' end;
  if payload->>'frequency' = 'monthly' then
    insert into payment_plans (donor_id, display_name, total_amount_sek, months, method, is_anonymous)
    values (new_donor, public_name, (payload->>'amountSek')::integer, (payload->>'months')::integer,
      payload->>'paymentMethod', anonymous_display) returning reference into registration_ref;
  else
    insert into donations (donor_id, display_name, amount_sek, method, status, is_anonymous)
    values (new_donor, public_name, (payload->>'amountSek')::integer,
      payload->>'paymentMethod', 'pending', anonymous_display) returning reference into registration_ref;
  end if;
  insert into consent_log (donor_id, donor_email, consent_text_shown, consent_given, purpose, registration_reference)
  values
    (new_donor, payload->>'email', payload->>'processingConsentText', true, 'donation_processing', registration_ref),
    (new_donor, payload->>'email', payload->>'displayConsentText', not anonymous_display, 'public_display', registration_ref),
    (new_donor, payload->>'email', payload->>'notificationConsentText',
      (payload->'comms'->>'email')::boolean or (payload->'comms'->>'sms')::boolean or (payload->'comms'->>'whatsapp')::boolean,
      'donation_notifications', registration_ref);
  return jsonb_build_object('reference', registration_ref, 'status', 'pending');
end;
$$;
revoke all on function public.register_donation(jsonb) from public, anon, authenticated;
grant execute on function public.register_donation(jsonb) to service_role;

-- Keep totals correct when staff amend, reject or delete a confirmed donation.
create or replace function public.bump_campaign_total() returns trigger as $$
declare delta integer := 0;
begin
  if TG_OP <> 'INSERT' and OLD.status = 'confirmed' then delta := delta - OLD.amount_sek; end if;
  if TG_OP <> 'DELETE' and NEW.status = 'confirmed' then delta := delta + NEW.amount_sek; end if;
  update public.campaign_totals set raised_sek = raised_sek + delta, updated_at = now() where id = 'main';
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$ language plpgsql set search_path = public;
drop trigger if exists trg_bump_campaign_total on public.donations;
create trigger trg_bump_campaign_total after insert or update or delete on public.donations
for each row execute function public.bump_campaign_total();
update public.campaign_totals set raised_sek = (select coalesce(sum(amount_sek), 0) from public.donations where status = 'confirmed') where id = 'main';

-- Public feed contains only display fields; no donor IDs or payment references.
create or replace view public.public_donations with (security_invoker = true) as
select id, case when is_anonymous then 'Anonymous' else display_name end as display_name,
  amount_sek, case when is_anonymous then null else message end as message, is_anonymous, created_at
from public.donations where status = 'confirmed';
grant select on public.public_donations to anon, authenticated, service_role;
-- Postgres Changes sends whole records; the public feed polls the safe view instead.
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donations') then
    alter publication supabase_realtime drop table public.donations;
  end if;
end;
$$;

-- The public page does not need a privileged key to render the form.
drop policy if exists "public can read campaign display settings" on public.campaign_settings;
create policy "public can read campaign display settings" on public.campaign_settings for select to anon, authenticated using (id = 'main');
revoke select on public.campaign_settings from anon, authenticated;
grant select (id, is_live, paused_message, transparency_files) on public.campaign_settings to anon, authenticated;

