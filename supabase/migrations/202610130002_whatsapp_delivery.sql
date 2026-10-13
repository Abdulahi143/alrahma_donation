-- Only delivery status is retained: no incoming messages or phone numbers.
create table if not exists public.whatsapp_delivery_events (
  provider_message_id text not null,
  status text not null check (status in ('sent','delivered','read','failed')),
  occurred_at timestamptz not null,
  error_code integer,
  primary key (provider_message_id, status, occurred_at)
);
alter table public.whatsapp_delivery_events enable row level security;
revoke all on public.whatsapp_delivery_events from anon, authenticated;
grant all on public.whatsapp_delivery_events to service_role;
