-- Phase 2: Transaktioner and Löften. Run after phase1.sql. Safe to re-run.

-- Who physically received a cash gift (free text, e.g. a volunteer's name).
-- registered_by (who entered it in the admin) stays the four-eyes anchor.
alter table transactions add column if not exists received_by_name text;
alter table transactions add column if not exists import_batch uuid;
create index if not exists transactions_import_batch_idx on transactions (import_batch) where import_batch is not null;

-- Duplicate guard for imports and manual entries: the same receipt number
-- cannot be booked twice in one campaign.
create unique index if not exists transactions_receipt_unique
  on transactions (campaign_id, receipt_no)
  where receipt_no is not null and status <> 'rejected';
