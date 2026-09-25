# Data-preserving rollout: production corrections

This branch is the first implementation stage, not completion of the full improvement programme. Do not deploy until the live Render service and database have been identified, backed up, restored to a rehearsal environment, and verified. The live PostgreSQL database was accessed read-only for a private application-schema export. All 55 application tables passed an exact restored-row comparison in an isolated PostgreSQL-compatible PGlite rehearsal. No live records were modified. This export excludes database roles, grants, other schemas and external files; it does not replace a provider staging deployment rehearsal.

## Verified recovery status

On 25 September 2026, the authenticated Render dashboard reported suspension because the free usage allowance was exhausted. The existing database is Neon PostgreSQL and remained readable. A private, checksum-protected application export was restored and compared successfully. Native PostgreSQL backup executables were blocked by local Windows application-control policy; that restriction was respected. Provider-side staging, uploaded-file reconciliation and live release checks remain outstanding. No hosting plan, live schema or deployment was changed. The existing Render dashboard build command still invokes prisma:deploy and prisma:seed; replace it with the reviewed build-only command and explicitly disable automatic deployment before any release. Repository blueprint changes alone do not update these settings.

## Render recovery first

1. Sign in to the existing Render account and inspect the suspended service's Events, deployment logs, billing/usage notice and Environment. Record the exact suspension reason privately. Do not delete or recreate the service/database.
2. Identify DATABASE_URL's provider without sharing credentials. Confirm whether it points to persistent PostgreSQL (Render, Neon or another provider) or a local SQLite file. If SQLite was stored on an ephemeral web-service filesystem, do not redeploy in the hope of recovery; first investigate existing provider snapshots, exports and surviving storage. A repository backup is not a business-data backup.
3. Check database expiry and provider recovery options. Inspect document storage separately: database backup does not include uploaded files. Preserve uploads/object storage and record counts before migration.
4. The public URL alone does not establish why Render suspended the service or whether records survived. Any paid hosting change needs a chosen plan and budget.

## What changes

- Production: edit complete shift entries, backdated dates, overnight shifts, zero tank readings, downtime-adjusted rates, mandatory correction reasons and optimistic version checks.
- Delete is a retained void, never a physical row deletion. Original quantities remain in the database and the audit snapshot. Deleted runs/batches are excluded from active lists and production reports. Include deleted entries exposes history and Restore; restoration requires a reason and new QC review.
- Quantity/date/material corrections and deletion conservatively stop when sales or deliveries may depend on the batch. Legacy transactions do not have reliable allocations; do not bypass this guard by editing the database. Reconcile the records and implement the allocation phase first. Shift times and notes remain editable.
- New production starts PENDING; management explicitly configures qc_required_test_types. New tests withdraw release, failed tests mark FAILED, and release requires current passing evidence plus an authorized review. This controls batch status; sales/dispatch enforcement is a remaining stock-allocation phase and is not claimed complete here.
- Production creation supports Idempotency-Key. Browser production retries are bound to the original user; legacy offline entries are retained and not automatically replayed. Other offline writes are disabled until their APIs support safe deduplication. No passwords are newly queued.
- Existing seeded owner credentials and settings are preserved. Production requires a unique signing secret and PostgreSQL. Credential changes invalidate old tokens; all users must sign in again after deploying this version.
- Upload routes require authentication. Direct hyperlinks to private uploads need an authenticated-download UI before rollout if that storage is used. Existing external document links are not migrated.
- Build no longer runs db push or seed. Automatic deploy is disabled in the proposed blueprint; confirm the actual Render dashboard setting separately. Editing this file does not change existing dashboard settings.

## Backup and restore rehearsal

Use a secure terminal environment for DATABASE_URL; do not paste it into chat, commit it, or put it in command arguments.

From backend:

```text
python scripts/backup_database.py --output <private-directory-outside-repository>
```

SQLite uses the database backup API, integrity-checks the copy, and rehearses restoration. PostgreSQL requires pg_dump and pg_restore; a readable archive alone is not marked restore-verified.

For PostgreSQL, create an EMPTY disposable database named nsupure_restore_<unique-suffix> on a permitted test server. Supply its connection using RESTORE_DATABASE_URL, leaving DATABASE_URL set to the source. Then run:

```text
python scripts/verify_postgres_restore.py --manifest <backup-manifest.json>
```

This refuses nonempty targets and the source database. It restores without cleaning/dropping existing data, uses a transaction, and marks the manifest only after successful restoration. Reconcile restored business totals and uploaded files as an additional release check. Restrict backup access and retention; the archive contains private business records.

## Upgrade an existing database

Stop all writers before the final backup. Use a backup under 24 hours old and verified against the exact database connection configuration. Set BACKUP_MANIFEST to its manifest and MAINTENANCE_CONFIRMED=WRITES_STOPPED. The environment flag is an operator attestation, not automatic maintenance enforcement.

Generate Prisma for the target provider before applying the additive script:

```text
npm run db:provider
npm run prisma:generate
npm run prisma:deploy
```

The upgrade only adds version, voidedAt, voidReason, requestId and requestHash to ProductionRun; voidedAt to ProductionBatch; and a unique nullable request index. It checks row counts and runs transactionally. Existing columns are not transformed and nothing is seeded, deleted, truncated or reset. A backup checksum and successful restore proof are mandatory. Existing rows default to active version 1; historical QC statuses and monetary data are preserved.

Do not use db push, migrate reset, --accept-data-loss, or db:clean on the live database. db:clean is now restricted to explicitly opted-in disposable test environments.

Deploy first against a restored staging database, then validate edit, delete, restore, history, authorization, production/report totals and restart persistence. Enable traffic only after reconciliation. Reverting application code without considering new voided records would reintroduce deleted runs into old report totals; use a forward fix or a coordinated backup restore with a plan for all post-backup writes.

## Verification

```text
npm run build --prefix backend
npm run build --prefix frontend
npm run test:safe --prefix backend
npm run test:upgrade --prefix backend
npm test --prefix frontend
```

The safe runner creates a fresh SQLite database per test file and overrides inherited database settings. Upgrade rehearsal checks all 55 tables, old values, repeated migration, exact backup restoration and rejection of invalid backup evidence. GitHub CI also passed integration tests against a disposable PostgreSQL 18 service, using a unique schema per test file. These checks do not verify the suspended live service or its provider-specific migration/deployment path; rehearse that path on the actual provider before deployment.
