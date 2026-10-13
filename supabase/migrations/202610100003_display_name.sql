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
  if not anonymous_display and (nullif(trim(payload->>'displayName'), '') is null or length(payload->>'displayName') > 120) then
    raise exception 'Invalid display name';
  end if;
  public_name := case when anonymous_display then 'Anonymous' else payload->>'displayName' end;
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


