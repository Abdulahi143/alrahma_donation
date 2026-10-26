# WhatsApp handoff — Masjid Al Rahma

Deploy the current `feature/abdiaziz-development` branch (or merge it into the branch that your hosting deploys). The site is https://donera.alrahmaborlange.se/.

## 1. Database status

The **Al-Rahma** Supabase project received these migrations through the SQL Editor on 18 October 2026, in filename order:

- `supabase/migrations/202610130001_payment_qr.sql`
- `supabase/migrations/202610130002_whatsapp_delivery.sql`
- `supabase/migrations/202610130003_whatsapp_messages.sql`
- `supabase/migrations/202610130004_installments.sql`
- `supabase/migrations/202610130005_monthly_reminders.sql`
- `supabase/migrations/202610130006_notification_controls.sql`
- `supabase/migrations/202610140001_payment_settings.sql`
- `supabase/migrations/202610140002_admin_phase1.sql`
- `supabase/migrations/202610140003_admin_phase2.sql`

The API now resolves `campaigns`, `campaign_stats`, `transactions`, `pledges`, `whatsapp_delivery_events` and `notification_controls_log`; the local admin overview loads. **Do not rerun these files or `setup.sql` on this project.** The SQL Editor does not register these runs in Supabase CLI migration history. `setup.sql` is for a fresh installation only. The third migration reset WhatsApp template approval to draft; Meta approval still needs to be completed.

## 2. Set hosting secrets

Keep secrets in the hosting environment, never Git or chat. Keep existing Supabase variables. Add:

| Variable | Value |
| --- | --- |
| `ELKS_API_USERNAME` | 46elks API username, private |
| `ELKS_API_PASSWORD` | 46elks API password, private |
| `ELKS_FROM` | `AlRahma` for one-way SMS |
| `WHATSAPP_ENABLED` | `false` until provider setup is verified |
| `WHATSAPP_NOTIFICATIONS_ENABLED` | `false` until templates, database and recipient testing are ready |
| `WHATSAPP_ACCESS_TOKEN` | Meta access token for this app/account; test tokens expire |
| `WHATSAPP_PHONE_NUMBER_ID` | Currently test sender `1391002004094201` |
| `WHATSAPP_API_VERSION` | Version supported by the app; current Meta screen shows `v25.0` |
| `META_APP_SECRET` | Secret of the Al-Rahma Meta app |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | A long randomly generated secret, also entered in Meta |
| `CRON_SECRET` | A separate long randomly generated secret for scheduled processing |

Meta app: `1643281760658629`. Test WhatsApp Business Account: `2044197469567756`. These IDs are not access tokens.

## 3. Connect Meta

Use the API setup, not the partner flow. Set the callback URL to:

`https://donera.alrahmaborlange.se/api/whatsapp/webhook`

Enter the matching verify token and subscribe to `messages`. The endpoint verifies `X-Hub-Signature-256` using the app secret and only accepts statuses for the configured sender. Deploy and set secrets before clicking Verify and save. Complete Meta's publishing/account requirements for production callbacks. The admin never needs to enter callback URLs or tokens.

We are keeping Meta's **test sender** for now; it retains its test identity and can only message verified test recipients. The owner's personal WhatsApp account must not be deleted or migrated. For production, register a separate mosque-controlled number and request the display name **Masjid Al Rahma**. Number verification, billing, template approval and any required business verification remain Meta setup tasks.

## 4. Approve the two messages

The exact Swedish, English and Arabic texts are in `202610130003_whatsapp_messages.sql` and `202610130005_monthly_reminders.sql`, and appear as previews in admin after migration. The two purposes are thank-you messages and reminders, using `payment_confirmed`, `pledge_reminder` and `plan_reminder` templates. No donation solicitation or registration acknowledgements.

Create matching templates in Meta with the appropriate transactional category (Meta decides approval/category). Replace `{{amount}}` with Meta's `{{1}}`, and `{{reference}}` with `{{2}}`. Keep **amount first, reference second**, as the sender uses these positional body parameters. Provide fictitious sample values for approval, not donor details.

After Meta approves each exact language/text, update the corresponding `notification_templates` row with its exact `provider_name`, exact Meta `provider_language`, and `approval_status='approved'`. Do not approve drafts locally before Meta approval. The migration resets approval because the bodies have changed.

## 5. Test, then enable

Run `npm test` and `npm run build`. Tests mock providers and run the complete migrations and setup file in an isolated in-memory PostgreSQL database; they send no real messages. Test the deployed webhook verification and signed delivery callbacks. Check that Supabase data loads and the Swish QR appears.

For an explicitly agreed test recipient only, enable both WhatsApp flags and send a test message using the admin queue button. Check provider acceptance, then delivered/read status in admin. Restore flags to false if testing is incomplete. Never enable the real-donor schedule while using the test sender.

The authenticated admin API `POST /api/admin/notifications/send` processes up to three approved queue entries. It checks current consent, language, contact number and payment status before sending. Concurrent workers claim rows once. Provider timeouts or uncertain results remain `sending` for investigation; **do not reset these rows blindly**, as the message may already have been sent. Provider acceptance is separate from delivery.

The database selects approved, eligible reminders before thank-you entries. Paused reminders and unapproved templates do not block other eligible messages.

## 6. Schedule production processing

Once production is ready, configure your hosting scheduler to call:

`GET https://donera.alrahmaborlange.se/api/cron/whatsapp`

with `Authorization: Bearer <CRON_SECRET>`. This prepares overdue reminders and processes up to three messages per invocation. Choose a frequency suitable for the queue size and hosting execution limits; it is not scheduled by this repository. Both WhatsApp flags must be true. Review monitoring before enabling.

One-time reminders cover pledges pending for at least seven days, once per pledge. Monthly reminders cover the earliest unpaid installment **seven days after its due date**, once per installment. Set the plan's first due date in donor details after agreeing it with the donor; existing plans have no assumed date. Dates stay anchored to that first day each month, using the month's last day where needed. Partial payments reduce the reminder amount, and the sender checks current payments again before sending. Rescheduling defers an existing queued reminder rather than sending early.

Approve the additional `plan_reminder` template in Swedish, English and Arabic from migration 005, again using amount as `{{1}}` and plan reference as `{{2}}`. There are two message purposes (thank-you and reminder), with separate one-time and monthly reminder templates.

In donor details, **Registrera mottagen betalning** records a verified receipt with amount, date and method; it does not initiate a bank transfer. Retries are idempotent, overpayments are blocked, and progress/completion update from confirmed receipts. Plan totals/month counts cannot change after a confirmed receipt. Test recording, correcting and rejecting a fixture receipt on staging before real use. Check that campaign totals count the money only once and anonymous plan receipts remain anonymous publicly.

Admins can pause automatic thank-you/reminder processing in WhatsApp-aviseringar, pause only a donor's reminders, or record that a donor asked to stop all notifications. Pausing leaves messages available for later processing; stopping all notifications changes their opt-out and cancels queued messages. It does not grant any new consent. Preference changes have a private audit log. Manual broadcasts are handled separately in Utskick.

Thank-you messages are queued once per confirmed donation record and processed by the scheduler. Campaign pause and opt-out block sending. Delivery callbacks store no inbound message bodies or recipient phone numbers; donor replies are not an admin inbox. The messages direct donors to the mosque's website for help and opting out, so ensure that contact channel is monitored and preferences are updated promptly.

The nine migrations listed in section 1 have been applied. Hosting deployment and production environment variables still need to be completed by the hosting owner.

## 7. Manual SMS broadcasts with 46elks

Set `ELKS_API_USERNAME`, `ELKS_API_PASSWORD`, and `ELKS_FROM` privately in the hosted app, then deploy this branch. Locally, the credentials were verified with one SMS to the developer's own number; no donor group was sent. The `AlRahma` text sender cannot receive replies.

Admins open **Utskick** in the sidebar, choose SMS, write a donation update or reminder, select opted-in donors, review the exact text and unique recipient count, then confirm. The review fetches a no-send 46elks dry run for each unique number and shows the total estimated cost in the account currency and the number of SMS parts. Confirmation stays disabled if 46elks cannot estimate the cost. Mass SMS only permits normalized Swedish numbers (`+46`); foreign numbers are excluded in the admin and checked again by the API before sending. The app checks consent again, limits a batch to 50 donors, deduplicates phone numbers, and records provider acceptance in the history. Acceptance does not prove delivery, and the final cost can differ from the estimate. Check the 46elks balance before a larger send. If a request times out or shows **Pågår**, check 46elks and the history before starting a new batch.
