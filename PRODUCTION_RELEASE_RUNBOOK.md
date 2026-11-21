# MOE Africa production release runbook

This runbook prepares the order, messaging, complaint, and payout release. It does not authorize a deployment, a production-data change, or live payment processing.

## 1. Pre-deployment checks

1. Create an approved release commit and record both frontend and backend SHAs.
2. Confirm the backend build, focused Jest suites, PostgreSQL integration suites, frontend build, and Playwright workflow are green for those SHAs.
3. Confirm the frontend API base URL is the production HTTPS backend and that `CORS_ORIGINS` contains the exact frontend origin.
4. Verify storage and notification settings without printing their values: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
5. Keep `PAYMENT_MODE=test` and `PAYMENT_LIVE_ENABLED=false`. Do not configure live gateway keys during this release.
6. Set `CUSTOMER_DELIVERY_REVIEW_HOURS=72` and `APP_TIMEZONE=Africa/Lagos`.
7. Set `ORDER_SCHEDULERS_ENABLED=true` on exactly one backend instance and `false` on every other replica.
8. Review `INITIAL_PAYOUT_LIMITS_JSON` with Finance. A missing or malformed limit blocks initial payouts rather than relaxing the limit.
9. Confirm no open payout dispute or reversal exists for an order used in the smoke test.

## 2. Finance capability assignment

Use separate named admin accounts. Through `PATCH /admin/users/:id`, assign only the capabilities required by each role:

```json
{
  "adminCapabilities": [
    "payout_amount_approve",
    "payout_transfer_record",
    "payout_dispute",
    "payout_mark_not_required"
  ]
}
```

Assign the Recorder payload above to the designated Recorder. Assign this narrower payload to a different Verifier account:

```json
{
  "adminCapabilities": [
    "payout_transfer_verify",
    "payout_dispute"
  ]
}
```

Do not put both accounts in `ADMIN_PAYOUT_FINANCE_USER_IDS`; that bootstrap grants all payout capabilities and weakens separation of duties. Leave it unset when per-user capabilities are configured. Verify that a Recorder attempting to verify their own transfer receives `RECORDER_CANNOT_VERIFY`, and verify an ordinary admin is rejected from approve, record, verify, dispute, and reversal actions.

## 3. Database backup and restore rehearsal

Run these commands from an approved secure operator host. The variables must be supplied by the secret manager; never paste their values into logs or tickets.

```sh
pg_dump --format=custom --no-owner --file=moe-pre-release.dump "$DATABASE_URL"
pg_restore --list moe-pre-release.dump
createdb "$RESTORE_REHEARSAL_DATABASE"
pg_restore --no-owner --dbname="$RESTORE_REHEARSAL_DATABASE" moe-pre-release.dump
```

Validate row counts and application startup against the rehearsal database, then remove it under the normal data-retention process. Never restore over the active production database. For an approved disaster restore, direct `pg_restore` to a newly created database, validate it, and switch the application connection only after sign-off.

The `20261121120000_social_profiles_order_complaints` migration is additive: nullable social/contact fields, new support-ticket tables, indexes, and foreign keys. Creating indexes and validating foreign keys can briefly lock busy tables, so run the migration in the database maintenance window and monitor locks. Deploy the migration before backend code that writes the new columns. The older frontend remains compatible while the backend is rolled forward.

## 4. Release order

1. Stop background work on all current replicas by setting `ORDER_SCHEDULERS_ENABLED=false`, then confirm no order cron job is running.
2. Take and verify the production backup.
3. Run `npx prisma migrate status`, then `npx prisma migrate deploy` from the reviewed backend artifact.
4. Deploy the backend artifact with live payment disabled. Keep schedulers disabled initially.
5. Smoke-test health, authentication, CORS, storage signing, notification configuration, and read-only order endpoints.
6. Deploy the frontend artifact with the reviewed production API URL.
7. Enable `ORDER_SCHEDULERS_ENABLED=true` on one leader only. Confirm the readiness (15 minutes), production (20 minutes), and delivery-review (30 minutes) jobs execute once and produce no duplicate notifications.
8. Complete the role smoke tests below. Record evidence and release SHAs.

## 5. Role smoke tests

- Customer: place a test-mode order, open Messages, send text/media, accept recorded delivery, submit and edit a 1–5 star review, and confirm duplicate reviews are prevented.
- Artisan: see New Orders, submit readiness, wait for initial transfer verification before Start Work, add production evidence, submit for quality, view the completed rating, and submit an order-linked complaint.
- Admin: approve readiness and quality, request corrections, review a complaint/history, reply with an attachment or voice note, search/select/archive conversations, and confirm Contact Us records cannot be bulk archived as conversations.
- Finance Recorder: approve the allowed amount and record a unique initial/final transfer reference; confirm duplicate references are rejected.
- Finance Verifier: independently verify the transfer; confirm the Recorder cannot self-verify and that final payout is blocked until quality approval, delivery acceptance, and no open dispute/reversal.
- Scheduler leader: verify correct order/user targeting and idempotent notifications after a restart; confirm no scheduler automatically disburses funds.

## 6. Rollback

1. Disable schedulers on every new backend replica.
2. Roll the frontend back to its previous immutable artifact.
3. Roll the backend back to the previous artifact only if it is compatible with the additive schema. The migration intentionally has no destructive down migration; leave the added nullable columns/tables in place during an application rollback.
4. If data restoration is genuinely required, stop all writes, obtain incident approval, restore the verified dump into a new database, validate it, then switch `DATABASE_URL`. Do not run an in-place destructive restore.
5. Re-run health/CORS/auth checks and the Customer, Artisan, Admin, and Finance gate smoke tests before re-enabling the single scheduler leader.

## 7. Required configuration checklist

- Core: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`
- Storage: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Order policy: `CUSTOMER_DELIVERY_REVIEW_HOURS=72`, reviewed `INITIAL_PAYOUT_LIMITS_JSON`
- Scheduling: `APP_TIMEZONE=Africa/Lagos`, one leader with `ORDER_SCHEDULERS_ENABLED=true`
- Payments: `PAYMENT_MODE=test`, `PAYMENT_LIVE_ENABLED=false`
- Finance: separate Recorder/Verifier `adminCapabilities`; normally leave `ADMIN_PAYOUT_FINANCE_USER_IDS` unset
