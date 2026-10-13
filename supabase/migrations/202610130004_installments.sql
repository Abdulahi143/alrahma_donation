BEGIN;
alter table public.donations add column paid_on date;
alter table public.donations add column recording_key uuid unique;

create function public.protect_paid_plan_terms() returns trigger
language plpgsql set search_path=public as $$
begin
  if (NEW.total_amount_sek<>OLD.total_amount_sek or NEW.months<>OLD.months) and exists(select 1 from donations where payment_plan_id=OLD.id and status='confirmed') then
    raise exception 'Planens belopp och antal månader kan inte ändras efter registrerad betalning.';
  end if;
  return NEW;
end; $$;
create trigger protect_paid_plan_terms before update on public.payment_plans for each row execute function public.protect_paid_plan_terms();

create function public.sync_plan_payments() returns trigger
language plpgsql set search_path=public as $$
declare target uuid; total_paid bigint;
begin
  for target in select distinct id from unnest(array[case when TG_OP<>'DELETE' then NEW.payment_plan_id end,case when TG_OP<>'INSERT' then OLD.payment_plan_id end]) id where id is not null loop
    perform 1 from payment_plans where id=target for update;
    select coalesce(sum(amount_sek),0) into total_paid from donations where payment_plan_id=target and status='confirmed';
    update payment_plans set installments_paid=least(months,total_paid/greatest(amount_per_month_sek,1)),
      status=case when status='cancelled' then status when total_paid>=total_amount_sek then 'completed' else 'active' end where id=target;
  end loop;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end; $$;
create trigger sync_plan_payments after insert or update or delete on public.donations for each row execute function public.sync_plan_payments();

create function public.record_installment(plan_id uuid,amount integer,payment_method text,payment_date date,request_key uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare p payment_plans; existing donations; paid bigint; payment donations;
begin
  if amount is null or amount<1 or amount>10000000 or payment_method is null or payment_method not in ('swish','bank_transfer','cash','card') or payment_date is null or payment_date>(now() at time zone 'Europe/Stockholm')::date or request_key is null then raise exception 'Kontrollera betalningsuppgifterna.'; end if;
  select * into p from payment_plans where id=plan_id for update;
  if not found then raise exception 'Betalningsplanen hittades inte.'; end if;
  select * into existing from donations where recording_key=request_key;
  if found then
    if existing.payment_plan_id<>plan_id or existing.amount_sek<>amount or existing.method<>payment_method or existing.paid_on<>payment_date then raise exception 'Uppgifterna har ändrats. Kontrollera den tidigare betalningen.'; end if;
    return to_jsonb(existing);
  end if;
  if p.status<>'active' or p.donor_id is null or not exists(select 1 from donors where id=p.donor_id and deleted_at is null) then raise exception 'Planen är avslutad, avbruten eller saknar givare.'; end if;
  select coalesce(sum(amount_sek),0) into paid from donations where payment_plan_id=plan_id and status='confirmed';
  if paid+amount>p.total_amount_sek then raise exception 'Beloppet överstiger det som återstår att betala.'; end if;
  insert into donations(donor_id,payment_plan_id,display_name,is_anonymous,amount_sek,method,status,confirmed_at,paid_on,recording_key,reference)
  values(p.donor_id,p.id,p.display_name,coalesce(p.is_anonymous,true),amount,payment_method,'confirmed',now(),payment_date,request_key,'AR-'||upper(replace(gen_random_uuid()::text,'-','')))
  returning * into payment;
  return to_jsonb(payment);
end; $$;
revoke all on function public.record_installment(uuid,integer,text,date,uuid) from public,anon,authenticated;
grant execute on function public.record_installment(uuid,integer,text,date,uuid) to service_role;
COMMIT;
