-- Test fixtures are rolled back; no messages are sent.
BEGIN;
do $$
declare d uuid; n uuid; p uuid;
begin
  insert into donors(full_name,email,phone,comm_whatsapp,comm_opt_out) values ('Queue test','queue-test@example.invalid','+46700000000',true,false) returning id into d;
  insert into donations(donor_id,display_name,amount_sek,method,status) values (d,'Anonymous',120,'swish','pending') returning id into n;
  if (select count(*) from notification_queue where donation_id=n) <> 1 then raise exception 'Pledge was not queued'; end if;
  update donations set status='confirmed' where id=n;
  update donations set status='confirmed' where id=n;
  if (select count(*) from notification_queue where donation_id=n and template_id='payment_confirmed') <> 1 then raise exception 'Confirmation duplicated'; end if;
  if exists(select 1 from notification_queue where donation_id=n and template_id='pledge_received' and status='queued') then raise exception 'Stale acknowledgement'; end if;
  insert into payment_plans(donor_id,display_name,total_amount_sek,months) values (d,'Anonymous',120,6) returning id into p;
  if not exists(select 1 from notification_queue where plan_id=p) then raise exception 'Plan was not queued'; end if;
  insert into donations(donor_id,display_name,amount_sek,method,status,created_at) values (d,'Anonymous',120,'swish','pending',now()-interval '8 days') returning id into n;
  perform queue_pledge_reminders();
  perform queue_pledge_reminders();
  if (select count(*) from notification_queue where donation_id=n and template_id='pledge_reminder') <> 1 then raise exception 'Reminder duplicated or missing'; end if;
  update donors set comm_opt_out=true where id=d;
  if exists(select 1 from notification_queue where donor_id=d and status='queued') then raise exception 'Opt-out did not cancel'; end if;
  insert into donations(donor_id,display_name,amount_sek,method,status) values (d,'Anonymous',120,'swish','pending') returning id into n;
  if exists(select 1 from notification_queue where donation_id=n) then raise exception 'Opted-out donor queued'; end if;
  if not exists(select 1 from notification_logs l join notification_queue q on q.id=l.queue_id where q.donor_id=d and l.event='cancelled') then raise exception 'Cancellation log missing'; end if;
end; $$;
ROLLBACK;

