-- Payment settings introduced by the QR code / supporter page update.
alter table public.campaign_settings add column if not exists paypal_link text not null default '';
