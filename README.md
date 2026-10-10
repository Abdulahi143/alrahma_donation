# Al-Rahma Mosque — Donation Platform

Next.js 14 (App Router) + Tailwind CSS + Supabase (database, auth, realtime). Built from the design in `Donation Tracker.dc.html`
and `Admin Dashboard.dc.html` in the parent project — those files are the
visual/interaction reference; this folder is the implementation.

## Stack

- **Next.js 14 / App Router / TypeScript** — public tracker page (`/`) and
  admin dashboard (`/admin`).
- **Tailwind CSS** — all styling, using the `mosque-*` color tokens defined in
  `tailwind.config.ts` (emerald/gold palette matching the design).
- **Supabase** — Postgres database, Row Level Security, Realtime (live feed),
  and Auth (admin login). See `supabase/*.sql`.

## Setup

1. `npm install`
2. Create a Supabase project. In the SQL editor, run in order:
   `supabase/schema.sql` → `supabase/rls-policies.sql` → `supabase/admins.sql`.
3. Enable email/password auth in Supabase Auth, create your first admin user,
   then insert a row into `admins` with that user's id.
4. Copy `.env.example` to `.env.local` and fill in the Supabase
   values. **`SUPABASE_SECRET_KEY` is a
   server-only secret** — never prefix them with `NEXT_PUBLIC_` or read them
   from a client component.
5. `npm run dev` — tracker at `/`, admin at `/admin` (redirects to
   `/admin/login` until you sign in).
6. Deploy to Vercel (or any Next.js host); add the same env vars there.

## Data model

- `donors` — one row per registered supporter (name, email, phone, language,
  communication preferences, GDPR consent timestamp).
- `donations` — one-off gifts and individual plan installments. Status is
  `pending` (submitted by a donor or awaiting cash/Swish reconciliation) →
  `confirmed` (counts toward the goal, appears on the live tracker) or
  `rejected`.
- `payment_plans` — recurring pledges split over 2 / 6 / 12 months.
- `consent_log` — append-only record of every GDPR consent captured, kept
  independently of the donor record (see GDPR section).
- `campaign_totals` — single-row running total, kept in sync by a Postgres
  trigger on `donations` so the tracker never has to sum the whole table.
- `admins` — allow-list of Supabase Auth user ids permitted to call
  `/api/admin/**`.
- `campaign_settings` — single row holding the Swish number, Bankgiro and
  IBAN shown to donors, editable from the admin "Payment accounts" tab.
- `broadcast_log` — count-only audit trail of every SMS/email broadcast sent
  from the admin "Broadcast" tab (never stores the recipient list itself).

## How the pieces connect

- The public tracker (`app/page.tsx`) reads `campaign_totals` and recent
  confirmed `donations` server-side on load, then `components/LiveFeed.tsx`
  subscribes to Supabase Realtime so new confirmed donations (e.g. an admin
  approving a Swish payment) appear instantly without a refresh.
- `components/RegisterForm.tsx` posts to `app/api/register/route.ts`, which
  upserts the donor, logs consent, and creates either a pending donation or a
  payment plan depending on the chosen frequency.
- The admin dashboard (`app/admin/page.tsx`) is a client component that calls
  `/api/admin/*` routes, all gated by `lib/auth.ts`'s `requireAdmin`, which
  checks for a Supabase Auth session AND membership in the `admins` table.

## Admin dashboard features

- **Full CRUD**: donations and payment plans can be created, edited, and
  deleted/cancelled from their admin tabs, not just created (`PUT`/`DELETE`
  on `/api/admin/donations/[id]` and `/api/admin/plans/[id]`).
- **CSV bulk import**: the Donations log and Donors tabs each have a file
  picker (parses CSV client-side, posts parsed rows to
  `/api/admin/donations/import` or `/api/admin/donors/import`) and a
  "Download empty template" button producing a correctly-headered blank CSV.
- **Broadcast**: pick any subset of donors (checkboxes, select all/none) and
  send them an SMS or email. Recipient counts respect each donor's
  `comm_sms`/`comm_email` preference and `comm_opt_out`. See "Wiring a real
  SMS/email provider" below — without one, sends are logged to
  `broadcast_log` as `simulated: true` and nothing actually goes out.
- **Live/paused toggle**: Settings has a "Live-kampanj" switch
  (`campaign_settings.is_live`). When off, the public tracker replaces the
  live feed + registration form with a pause message (editable in the same
  tab) — no code change needed to take the campaign offline temporarily.
- **Post-donation transparency**: after a successful registration, donors
  see a richer thank-you screen. Settings lets admins attach labeled links
  (receipts, construction photos, invoices — `campaign_settings.transparency_files`)
  that appear on that screen so donors can see what was actually done with
  funds.
- **Payment accounts**: Swish number / Bankgiro / IBAN are editable in
  Settings (`campaign_settings` table) and shown next to a placeholder QR
  pattern generated from the Swish number — it is **not** a real, scannable
  Swish QR code (see "Known stubs" below).

## Wiring a real SMS/email provider

`lib/broadcast.ts` has `sendSms`/`sendEmail` functions that no-op (return
`simulated: true`) until you set the matching env vars from `.env.example`:
Twilio (`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER`) for
SMS, Resend (`RESEND_API_KEY`) for email. Swap in a different provider by
editing just those two functions — nothing else in the broadcast route or
UI needs to change.

## GDPR

- **Lawful basis & consent**: the register form requires an explicit,
  unticked checkbox before submission is allowed (no pre-checked consent).
  The exact text shown is written to `consent_log` at submission time, along
  with IP and user-agent, so the mosque can demonstrate consent was given
  (GDPR Art. 7).
- **Purpose limitation**: communication preference (email / SMS / WhatsApp /
  none) is captured and stored per-donor; respect `comm_opt_out` before any
  outreach.
- **Data minimisation**: the live tracker and its Realtime feed only ever
  read `donations` (display name + amount + message), never the `donors`
  table — personal data (email, phone) is never sent to the browser.
- **Right of access / erasure**: the admin Donors tab has an "Erase (GDPR)"
  action (`DELETE /api/admin/donors/[id]`) that scrubs personal fields
  (name, email, phone) and soft-deletes the donor while leaving historical
  donation totals intact (each `donations` row already snapshots
  `display_name` at the time of the gift, so campaign totals don't change).
  Add a scheduled job to hard-delete soft-deleted rows after your retention
  period.
- **Security**: Row Level Security is enabled on every table; the public
  anon key can only insert new pending registrations and read confirmed
  donations/totals (see `supabase/rls-policies.sql`). All reads/writes of
  personal data go through `/api/admin/**`, gated by Supabase Auth + the
  `admins` allow-list, using the service-role key only on the server.
- **Before going live**: replace the placeholder `/privacy` page with real
  policy text (translated into EN/SV/AR), add a
  cookie banner if you add any analytics, and confirm a data retention
  period with the mosque board.

## Known stubs / next steps

- Payment methods (Swish, card) are recorded but not integrated with a real
  payment provider — wire `app/api/register/route.ts` and the admin "Record
  donation" action to your provider of choice (e.g. Swish Handel API, Stripe)
  when ready; today amounts are entered/confirmed manually or via the pending
  → approve flow. The Swish QR shown in admin Settings is a deterministic
  placeholder pattern, not a real scannable code — generating one requires a
  Swish Handel merchant certificate (`SWISH_MERCHANT_ID`/`SWISH_CERT_PATH` in
  `.env.example`) and Swish's own QR image API.
- Recurring `payment_plans` installments are not yet auto-charged; the admin
  Payment plans tab tracks progress (`installments_paid`) for manual
  reconciliation until a billing provider is connected.
- SMS/email broadcast (`app/api/admin/broadcast/route.ts`) runs in simulated
  mode until Twilio/Resend env vars are set (see "Wiring a real SMS/email
  provider" above) — until then it's fully functional UI + audit log, but no
  message actually leaves the server.
- CSV import now validates each row (name/amount/email presence, amount
  bounds, email format, in-file duplicate emails) and reports exactly which
  rows were skipped and why, next to the import button — safe to hand to
  non-technical staff.
- The public register form (`/api/register`) validates email format and
  donation amount server-side (not just in the browser) before writing to
  the database.
