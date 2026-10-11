BEGIN;
create table public.notification_templates (
  id text not null,
  language text not null check (language in ('en','sv','ar')),
  body text not null,
  approval_status text not null default 'draft' check (approval_status in ('draft','approved','rejected')),
  primary key (id, language)
);
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references public.donors(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete cascade,
  plan_id uuid references public.payment_plans(id) on delete cascade,
  template_id text not null,
  language text not null,
  status text not null default 'queued' check (status in ('queued','cancelled','sent','failed')),
  created_at timestamptz not null default now(),
  foreign key (template_id, language) references public.notification_templates(id, language),
  check (num_nonnulls(donation_id, plan_id) = 1)
);
create unique index notification_donation_once on public.notification_queue(donation_id, template_id) where donation_id is not null;
create unique index notification_plan_once on public.notification_queue(plan_id, template_id) where plan_id is not null;
create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.notification_queue(id) on delete cascade,
  event text not null check (event in ('queued','cancelled','sent','delivered','read','failed')),
  provider_message_id text,
  created_at timestamptz not null default now()
);
alter table public.notification_templates enable row level security;
alter table public.notification_queue enable row level security;
alter table public.notification_logs enable row level security;
revoke all on public.notification_templates, public.notification_queue, public.notification_logs from anon, authenticated;
grant all on public.notification_templates, public.notification_queue, public.notification_logs to service_role;

insert into public.notification_templates(id, language, body) values
 ('pledge_received','en','Thank you for your pledge of {{amount}} SEK to Al-Rahma. Reference: {{reference}}. Payment is awaiting verification.'),
 ('payment_confirmed','en','Thank you! Your payment of {{amount}} SEK to Al-Rahma is confirmed. Reference: {{reference}}.'),
 ('pledge_reminder','en','A reminder about your pledge of {{amount}} SEK to Al-Rahma. Reference: {{reference}}. If you have already paid, please contact us.'),
 ('pledge_received','sv','Tack för ditt löfte om {{amount}} kr till Al-Rahma. Referens: {{reference}}. Betalningen väntar på verifiering.'),
 ('payment_confirmed','sv','Tack! Din betalning på {{amount}} kr till Al-Rahma är bekräftad. Referens: {{reference}}.'),
 ('pledge_reminder','sv','En påminnelse om ditt löfte på {{amount}} kr till Al-Rahma. Referens: {{reference}}. Kontakta oss om du redan har betalat.'),
 ('pledge_received','ar','شكرًا لتعهدك بمبلغ {{amount}} كرونة لمسجد الرحمة. المرجع: {{reference}}. الدفع بانتظار التحقق.'),
 ('payment_confirmed','ar','شكرًا! تم تأكيد دفعتك بقيمة {{amount}} كرونة لمسجد الرحمة. المرجع: {{reference}}.'),
 ('pledge_reminder','ar','تذكير بتعهدك بمبلغ {{amount}} كرونة لمسجد الرحمة. المرجع: {{reference}}. تواصل معنا إذا كنت قد دفعت بالفعل.');

create function public.queue_pledge_notification() returns trigger
language plpgsql set search_path = public as $$
declare kind text;
begin
  if TG_TABLE_NAME = 'payment_plans' then
    if TG_OP <> 'INSERT' then return NEW; end if;
    kind := 'pledge_received';
  elsif NEW.status = 'confirmed' then
    if TG_OP = 'UPDATE' and OLD.status = 'confirmed' then return NEW; end if;
    kind := 'payment_confirmed';
  elsif TG_OP = 'INSERT' and NEW.status = 'pending' then
    kind := 'pledge_received';
  else
    return NEW;
  end if;
  insert into notification_queue(donor_id, donation_id, plan_id, template_id, language)
  select d.id,
    case when TG_TABLE_NAME = 'donations' then NEW.id end,
    case when TG_TABLE_NAME = 'payment_plans' then NEW.id end,
    kind, coalesce(d.preferred_language, 'en')
  from donors d where d.id = NEW.donor_id and d.comm_whatsapp and not d.comm_opt_out
    and d.deleted_at is null and nullif(trim(d.phone), '') is not null
  on conflict do nothing;
  return NEW;
end; $$;
create trigger queue_donation_notification after insert or update on public.donations for each row execute function public.queue_pledge_notification();
create trigger queue_plan_notification after insert on public.payment_plans for each row execute function public.queue_pledge_notification();

create function public.log_notification_event() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' or NEW.status is distinct from OLD.status then
    insert into notification_logs(queue_id, event) values (NEW.id, NEW.status);
  end if;
  return NEW;
end; $$;
create trigger log_notification_event after insert or update on public.notification_queue for each row execute function public.log_notification_event();

create function public.cancel_donor_notifications() returns trigger
language plpgsql set search_path = public as $$
begin
  if NEW.deleted_at is not null or NEW.comm_opt_out or not NEW.comm_whatsapp or nullif(trim(NEW.phone),'') is null then
    update notification_queue set status='cancelled' where donor_id=NEW.id and status='queued';
  end if;
  return NEW;
end; $$;
create trigger cancel_donor_notifications after update on public.donors for each row execute function public.cancel_donor_notifications();

create function public.cancel_stale_notifications() returns trigger
language plpgsql set search_path = public as $$
begin
  if NEW.status <> 'pending' then
    update notification_queue set status='cancelled' where donation_id=NEW.id and status='queued' and template_id in ('pledge_received','pledge_reminder');
  end if;
  if NEW.status <> 'confirmed' then
    update notification_queue set status='cancelled' where donation_id=NEW.id and status='queued' and template_id='payment_confirmed';
  end if;
  return NEW;
end; $$;
create trigger cancel_stale_notifications after update on public.donations for each row execute function public.cancel_stale_notifications();

create function public.queue_pledge_reminders() returns integer
language plpgsql security invoker set search_path = public as $$
declare queued integer;
begin
  insert into notification_queue(donor_id, donation_id, template_id, language)
  select d.id, n.id, 'pledge_reminder', coalesce(d.preferred_language,'en')
  from donations n join donors d on d.id=n.donor_id
  where n.status='pending' and n.created_at < now() - interval '7 days'
    and d.comm_whatsapp and not d.comm_opt_out and d.deleted_at is null
    and nullif(trim(d.phone),'') is not null
    and exists (select 1 from campaign_settings where id='main' and is_live)
  on conflict do nothing;
  get diagnostics queued = row_count;
  return queued;
end; $$;
revoke all on function public.queue_pledge_reminders() from public, anon, authenticated;
grant execute on function public.queue_pledge_reminders() to service_role;
COMMIT;
