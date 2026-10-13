BEGIN;
alter table public.notification_queue drop constraint notification_queue_status_check;
alter table public.notification_queue add constraint notification_queue_status_check check (status in ('queued','sending','cancelled','sent','failed'));
alter table public.notification_queue add column provider_message_id text unique;

create or replace function public.log_notification_event() returns trigger
language plpgsql set search_path = public as $$
begin
  if NEW.status in ('queued','cancelled','sent','failed') and (TG_OP='INSERT' or NEW.status is distinct from OLD.status) then
    insert into notification_logs(queue_id,event,provider_message_id) values (NEW.id,NEW.status,NEW.provider_message_id);
  end if;
  return NEW;
end; $$;

-- Only confirmed-payment thank-you messages; no registration acknowledgements.
create or replace function public.queue_pledge_notification() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_TABLE_NAME <> 'donations' then return NEW; end if;
  if NEW.status <> 'confirmed' then return NEW; end if;
  if TG_OP='UPDATE' and OLD.status='confirmed' then return NEW; end if;
  insert into notification_queue(donor_id,donation_id,template_id,language)
  select d.id,NEW.id,'payment_confirmed',coalesce(d.preferred_language,'en')
  from donors d where d.id=NEW.donor_id and d.comm_whatsapp and not d.comm_opt_out
    and d.deleted_at is null and nullif(trim(d.phone),'') is not null
  on conflict do nothing;
  return NEW;
end; $$;
update notification_queue set status='cancelled' where template_id='pledge_received' and status='queued';

create or replace function public.queue_pledge_reminders() returns integer
language plpgsql security invoker set search_path = public as $$
declare queued integer;
begin
  insert into notification_queue(donor_id,donation_id,template_id,language)
  select d.id,n.id,'pledge_reminder',coalesce(d.preferred_language,'en')
  from donations n join donors d on d.id=n.donor_id
  where n.status='pending' and n.payment_plan_id is null and n.created_at < now()-interval '7 days'
    and d.comm_whatsapp and not d.comm_opt_out and d.deleted_at is null
    and nullif(trim(d.phone),'') is not null
    and exists(select 1 from campaign_settings where id='main' and is_live)
  on conflict do nothing;
  get diagnostics queued = row_count;
  return queued;
end; $$;

update notification_templates set body=case language
  when 'sv' then 'Salam! En vänlig påminnelse om ditt registrerade donationslöfte till Masjid Al Rahma på {{amount}} kr. Betalningsreferens: {{reference}}. Om du redan har betalat, kontakta moskén så att vi kan kontrollera betalningen. Behöver du ändra ditt löfte eller sluta få påminnelser? Kontakta oss via https://alrahmaborlange.se/. Tack för ditt stöd.'
  when 'en' then 'Salam! A friendly reminder about your registered donation pledge of {{amount}} SEK to Masjid Al Rahma. Payment reference: {{reference}}. If you have already paid, please contact the mosque so we can check your payment. To change your pledge or stop reminders, contact us through https://alrahmaborlange.se/. Thank you for your support.'
  when 'ar' then 'السلام عليكم! تذكير لطيف بتعهدك المسجل بالتبرع بمبلغ {{amount}} كرونة لمسجد الرحمة. مرجع الدفع: {{reference}}. إذا كنت قد دفعت بالفعل، يرجى التواصل مع المسجد للتحقق من الدفع. لتعديل تعهدك أو إيقاف التذكيرات، تواصل معنا عبر https://alrahmaborlange.se/. شكرًا لدعمك.'
end, approval_status='draft',provider_name=null,provider_language=null where id='pledge_reminder';
update notification_templates set body=case language
  when 'sv' then 'Tack för ditt stöd till Masjid Al Rahma! Vi har bekräftat din betalning på {{amount}} kr. Betalningsreferens: {{reference}}. Må Allah belöna dig för din generositet. Vid frågor, kontakta moskén via https://alrahmaborlange.se/.'
  when 'en' then 'Thank you for supporting Masjid Al Rahma! We have confirmed your payment of {{amount}} SEK. Payment reference: {{reference}}. May Allah reward your generosity. For questions, contact the mosque through https://alrahmaborlange.se/.'
  when 'ar' then 'شكرًا لدعمك مسجد الرحمة! تم تأكيد دفعتك بمبلغ {{amount}} كرونة. مرجع الدفع: {{reference}}. جزاك الله خيرًا على كرمك. للاستفسارات، تواصل مع المسجد عبر https://alrahmaborlange.se/.'
end, approval_status='draft',provider_name=null,provider_language=null where id='payment_confirmed';
COMMIT;
