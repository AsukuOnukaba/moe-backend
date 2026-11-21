# MOE Africa final production-readiness report

Date: 2026-11-21
Scope: order lifecycle and payouts, delivery policy, messaging regressions, artisan social profiles, order complaints, ratings, schedulers, and release preparation.

## Implemented and tested

- Final milestone eligibility, transfer recording, and verification now block open order disputes and payout states `disputed`/`reversed`. Recorder/verifier separation and duplicate transfer gates remain enforced.
- The delivery-review scheduler processes both `delivered` and `delivery_disputed` orders at the configured 72-hour deadline, retaining its conditional-update idempotency guard.
- `CUSTOMER_DELIVERY_REVIEW_HOURS=72`, `APP_TIMEZONE=Africa/Lagos`, and explicit scheduler leadership are documented in `.env.example` and accepted by startup validation. Live payments remain disabled.
- Artisan website, Instagram, Facebook, X, and LinkedIn URLs persist in `ArtisanProfile`, are validated as complete HTTP(S) URLs, and are available to the public artisan mapper.
- Order-linked artisan complaints persist category, order, description, private attachment/voice metadata, status, and event history. Creation checks artisan order ownership; attachment access is authenticated; status updates are admin-only.
- Existing frontend message navigation, admin attachment/voice composition, selection/search/archive behavior, Customer Inquiry attachments, payment-profile role visibility, social settings, complaint dialog, and rating interfaces were verified against the current backend contract.
- The Playwright workflow now includes focused admin messaging regression coverage. The route mocks were fixed so frontend document navigation is never mistaken for an API request.
- A storage-safe option was added to the existing real HTTP lifecycle integration suite. It drives the running Nest API and local PostgreSQL without uploading test blobs to shared storage.

## Changed database migration

`20261121120000_social_profiles_order_complaints` is additive and backward-compatible. It adds nullable social URL fields, nullable order-complaint links plus status/timestamps to `ContactMessage`, and new attachment/event tables with indexes and foreign keys. Local PostgreSQL reports 36 migrations and an up-to-date schema.

## Verification results

- Backend production build: passed.
- Frontend production build: passed (existing large-chunk advisory only).
- Focused payout/production/quality/messaging Jest run: 18 tests passed.
- Support complaint unit tests: 2 passed.
- PostgreSQL lifecycle and payout integration suites: 10 passed.
- Real Nest HTTP + PostgreSQL lifecycle: 1 passed. Covered login, readiness, approval, initial payout record/independent verification, early Start Work rejection, Start Work, production timing, quality approval without automatic disbursement, delivery acceptance, rating, and final eligibility.
- Local Playwright equivalent of the Linux workflow: 5 passed. Covered desktop order production/rating plus desktop and 390×844 admin messaging selection, attachment, and voice-control UI.
- Prisma migration status: 36 found; database schema up to date.
- `git diff --check`: passed in both repositories.

## Scheduler verification

- Readiness cron: every 15 minutes.
- Production cron: every 20 minutes.
- Delivery review cron: every 30 minutes.
- Readiness reminders use unique `(orderId, kind)` records; delivery processing uses conditional updates; production processing targets the current order state. Restarts therefore do not repeat claimed transitions. None of these jobs records or verifies a bank transfer.
- Production must run `ORDER_SCHEDULERS_ENABLED=true` on one leader only and `false` on all other replicas.

## Configuration still required

- `INITIAL_PAYOUT_LIMITS_JSON` is missing locally and must be reviewed and supplied per currency before production initial payouts.
- Assign distinct per-user Finance capabilities through `PATCH /admin/users/:id`; do not automatically alter real users. Normally keep `ADMIN_PAYOUT_FINANCE_USER_IDS` unset.
- Reconfirm production API URL, exact CORS origin, Cloudinary, Resend sender, secrets, and single scheduler leader in the deployment platform. Values were checked only for presence and were not printed.
- Keep `PAYMENT_MODE=test` and `PAYMENT_LIVE_ENABLED=false` until a separately approved live-payment release.

## Blocked or not executed

- GitHub Actions was not triggered: the GitHub CLI is not authenticated and these commits have not been pushed. No hosted-CI success is claimed. After pushing, open **Actions → Playwright Order UI → Run workflow** on the release branch, or run `gh workflow run playwright.yml --ref <release-branch>` from an authenticated shell, then require the `order-ui` job before merge.
- No production deployment, production database operation, capability assignment, real payout, or live gateway action was performed.

## Exact deployment and rollback sequence

1. Require green hosted Playwright and backend checks for the committed SHAs; validate API URL/CORS and required configuration.
2. Disable schedulers on all old and new replicas.
3. Take a custom-format `pg_dump`, list its contents, and restore it into a separate rehearsal database.
4. In the maintenance window run `npx prisma migrate status`, then `npx prisma migrate deploy` from the reviewed backend artifact.
5. Deploy the backend with test payments and schedulers disabled; smoke-test health, auth, CORS, notification configuration, signed storage access, and order reads.
6. Deploy the frontend and run Customer, Artisan, Admin, Recorder, and Verifier smoke tests.
7. Enable schedulers on exactly one leader and verify one execution of the 15/20/30-minute jobs without duplicate notifications.
8. To roll back, disable all schedulers, restore the prior frontend and compatible backend artifacts, and leave the additive schema in place. If a data restore is approved, stop writes and restore the verified dump into a new database before switching `DATABASE_URL`; never destructively restore over the active database.

Operator commands, Finance capability payloads, smoke tests, lock risks, backup rehearsal, and rollback detail are in `PRODUCTION_RELEASE_RUNBOOK.md`.
