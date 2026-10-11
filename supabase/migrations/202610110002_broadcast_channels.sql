BEGIN;
alter table public.broadcast_log drop constraint if exists broadcast_log_channel_check;
alter table public.broadcast_log add constraint broadcast_log_channel_check check (channel in ('sms','email','whatsapp'));
alter table public.broadcast_log add column accepted_count integer not null default 0;
alter table public.broadcast_log add column failed_count integer not null default 0;
alter table public.broadcast_log add column status text not null default 'legacy' check (status in ('legacy','sending','accepted','partial','failed'));
alter table public.notification_templates add column provider_name text;
alter table public.notification_templates add column provider_language text;
COMMIT;
