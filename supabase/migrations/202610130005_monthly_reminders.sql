BEGIN;
alter table public.payment_plans add column first_due_on date;
alter table public.donors add column reminders_paused boolean not null default false;
alter table public.campaign_settings add column notifications_paused boolean not null default false;
alter table public.notification_queue add column installment_number integer check (installment_number between 1 and 12);
alter table public.notification_queue add column amount_due integer;
alter table public.notification_queue add column due_on date;
drop index public.notification_plan_once;
create unique index notification_plan_once on public.notification_queue(plan_id,template_id) where plan_id is not null and installment_number is null;
create unique index notification_installment_once on public.notification_queue(plan_id,template_id,installment_number) where plan_id is not null and installment_number is not null;

insert into public.notification_templates(id,language,body) values
 ('plan_reminder','sv','Salam! En vänlig påminnelse om en obetald delbetalning i din donationsplan till Masjid Al Rahma. Kvar på delbetalningen: {{amount}} kr. Planens betalningsreferens: {{reference}}. Om du redan har betalat, kontakta moskén så att vi kan kontrollera betalningen. För att ändra planen eller sluta få påminnelser, kontakta oss via https://alrahmaborlange.se/. Tack för ditt stöd.'),
 ('plan_reminder','en','Salam! A friendly reminder about an unpaid installment in your donation plan to Masjid Al Rahma. Remaining on this installment: {{amount}} SEK. Plan payment reference: {{reference}}. If you have already paid, please contact the mosque so we can check your payment. To change your plan or stop reminders, contact us through https://alrahmaborlange.se/. Thank you for your support.'),
 ('plan_reminder','ar','السلام عليكم! تذكير لطيف بقسط غير مدفوع ضمن خطة تبرعك لمسجد الرحمة. المتبقي من هذا القسط: {{amount}} كرونة. مرجع دفع الخطة: {{reference}}. إذا كنت قد دفعت بالفعل، تواصل مع المسجد للتحقق. لتعديل الخطة أو إيقاف التذكيرات، تواصل معنا عبر https://alrahmaborlange.se/. شكرًا لدعمك.');

-- Amounts are recomputed immediately before sending; old or paid installments return null.
create function public.plan_reminder_details(target_plan uuid,target_installment integer) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare p payment_plans; paid bigint; earliest integer; due date; remaining integer;
begin
  select * into p from payment_plans where id=target_plan;
  if not found or p.status<>'active' or p.amount_per_month_sek<1 then return null; end if;
  select coalesce(sum(amount_sek),0) into paid from donations where payment_plan_id=p.id and status='confirmed';
  earliest=least(p.months+1,floor(paid::numeric/p.amount_per_month_sek)+1)::integer;
  if earliest>p.months or target_installment is distinct from earliest then return null; end if;
  if p.first_due_on is null then return jsonb_build_object('waiting',true); end if;
  due=(p.first_due_on+make_interval(months=>earliest-1))::date;
  if due+7>(now() at time zone 'Europe/Stockholm')::date then return jsonb_build_object('waiting',true); end if;
  remaining=p.amount_per_month_sek-(paid%p.amount_per_month_sek)::integer;
  return jsonb_build_object('amount',remaining,'reference',p.reference,'dueOn',due);
end; $$;
revoke all on function public.plan_reminder_details(uuid,integer) from public,anon,authenticated;
grant execute on function public.plan_reminder_details(uuid,integer) to service_role;

create function public.queue_monthly_reminders() returns integer
language plpgsql security invoker set search_path=public as $$
declare queued integer;
begin
  insert into notification_queue(donor_id,plan_id,template_id,language,installment_number,amount_due,due_on)
  select d.id,p.id,'plan_reminder',coalesce(d.preferred_language,'en'),progress.installment,(details.value->>'amount')::integer,(details.value->>'dueOn')::date
  from payment_plans p join donors d on d.id=p.donor_id
  cross join lateral (select least(p.months+1,floor(coalesce(sum(n.amount_sek),0)::numeric/greatest(p.amount_per_month_sek,1))+1)::integer installment from donations n where n.payment_plan_id=p.id and n.status='confirmed') progress
  cross join lateral (select plan_reminder_details(p.id,progress.installment) value) details
  where details.value ? 'amount' and d.comm_whatsapp and not d.comm_opt_out and not d.reminders_paused and d.deleted_at is null
    and nullif(trim(d.phone),'') is not null and exists(select 1 from campaign_settings where id='main' and is_live and not notifications_paused)
  on conflict do nothing;
  get diagnostics queued=row_count;
  return queued;
end; $$;
revoke all on function public.queue_monthly_reminders() from public,anon,authenticated;
grant execute on function public.queue_monthly_reminders() to service_role;
COMMIT;
