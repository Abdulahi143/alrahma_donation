-- Payment settings added after the QR/supporter update: bank rows, card link,
-- uploaded QR images and the PayPal placeholder toggle. Safe to re-run.
alter table public.campaign_settings add column if not exists plusgiro text not null default '';
alter table public.campaign_settings add column if not exists bank_name text not null default '';
alter table public.campaign_settings add column if not exists account_holder text not null default '';
alter table public.campaign_settings add column if not exists account_number text not null default '';
alter table public.campaign_settings add column if not exists bic text not null default '';
alter table public.campaign_settings add column if not exists card_link text not null default '';
-- While paypal_link is empty, show the Swish QR in the PayPal slot.
alter table public.campaign_settings add column if not exists paypal_placeholder boolean not null default true;
-- Own uploaded QR images (public URLs in the "qr-codes" Storage bucket).
alter table public.campaign_settings add column if not exists swish_qr_url text not null default '';
alter table public.campaign_settings add column if not exists paypal_qr_url text not null default '';
insert into storage.buckets (id, name, public) values ('qr-codes', 'qr-codes', true) on conflict do nothing;
