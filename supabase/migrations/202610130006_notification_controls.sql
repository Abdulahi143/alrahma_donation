BEGIN;
create table public.notification_controls_log (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references public.donors(id) on delete set null,
  action text not null check(action in ('pause_reminders','resume_reminders','stop_all','pause_automatic','resume_automatic')),
  created_at timestamptz not null default now()
);
alter table public.notification_controls_log enable row level security;
revoke all on public.notification_controls_log from anon,authenticated;
grant all on public.notification_controls_log to service_role;
create function public.set_donor_notification_controls(target_donor uuid,requested_action text) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if requested_action not in ('pause_reminders','resume_reminders','stop_all') then raise exception 'Invalid action'; end if;
  perform 1 from donors where id=target_donor and deleted_at is null for update;
  if not found then raise exception 'Donor not found'; end if;
  if requested_action='stop_all' then
    update donors set comm_opt_out=true,comm_email=false,comm_sms=false,comm_whatsapp=false where id=target_donor;
  else
    update donors set reminders_paused=(requested_action='pause_reminders') where id=target_donor;
  end if;
  insert into notification_controls_log(donor_id,action) values(target_donor,requested_action);
end; $$;
revoke all on function public.set_donor_notification_controls(uuid,text) from public,anon,authenticated;
grant execute on function public.set_donor_notification_controls(uuid,text) to service_role;
create function public.set_notification_pause(paused boolean) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if paused is null then raise exception 'Missing pause value'; end if;
  update campaign_settings set notifications_paused=paused,updated_at=now() where id='main';
  if not found then raise exception 'Campaign not found'; end if;
  insert into notification_controls_log(action) values(case when paused then 'pause_automatic' else 'resume_automatic' end);
end; $$;
revoke all on function public.set_notification_pause(boolean) from public,anon,authenticated;
grant execute on function public.set_notification_pause(boolean) to service_role;

create function public.pending_whatsapp_notifications() returns setof public.notification_queue
language sql security invoker set search_path=public as $$
  select q.* from notification_queue q
  join notification_templates t on t.id=q.template_id and t.language=q.language
  join donors d on d.id=q.donor_id
  where q.status='queued' and q.template_id in ('payment_confirmed','pledge_reminder','plan_reminder')
    and t.approval_status='approved' and t.provider_name is not null and t.provider_language is not null
    and d.comm_whatsapp and not d.comm_opt_out and d.deleted_at is null
    and d.preferred_language=q.language and nullif(trim(d.phone),'') is not null
    and (q.template_id='payment_confirmed' or not d.reminders_paused)
  order by case when q.template_id='payment_confirmed' then 1 else 0 end,q.created_at
  limit 3;
$$;
revoke all on function public.pending_whatsapp_notifications() from public,anon,authenticated;
grant execute on function public.pending_whatsapp_notifications() to service_role;

create or replace function public.queue_pledge_reminders() returns integer
language plpgsql security invoker set search_path=public as $$
declare queued integer;
begin
  insert into notification_queue(donor_id,donation_id,template_id,language)
  select d.id,n.id,'pledge_reminder',coalesce(d.preferred_language,'en')
  from donations n join donors d on d.id=n.donor_id
  where n.status='pending' and n.payment_plan_id is null and n.created_at < now()-interval '7 days'
    and d.comm_whatsapp and not d.comm_opt_out and not d.reminders_paused and d.deleted_at is null
    and nullif(trim(d.phone),'') is not null
    and exists(select 1 from campaign_settings where id='main' and is_live and not notifications_paused)
  on conflict do nothing;
  get diagnostics queued=row_count;
  return queued;
end; $$;
COMMIT;
