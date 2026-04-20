# Inbound Email Pipeline (Resend + Supabase + Next.js)

This app receives inbound Resend emails, stores metadata in Supabase Postgres via Prisma, and uploads attachments to Supabase Storage.

## Tech Stack

- Next.js (App Router)
- Bun
- Prisma + PostgreSQL (Supabase)
- Supabase Storage
- Resend Receiving API + Webhooks

## Key Routes

- `POST /api/webhooks/resend/inbound`
- `GET /api/jobs/resend-backfill` (optional manual replay endpoint)
- `POST /api/jobs/ircc-checks` (automated IRCC status checks)

## Setup

1. Copy `.env.example` to `.env`.
2. Set Supabase and Resend credentials.
3. Run:

```bash
bun install
bun run db:generate
bun run db:migrate
bun dev
```

Detailed deployment and DNS/webhook setup steps are in `HOW.md`.

## Automated IRCC Checks

The dashboard now supports automated case checks for records created in
`/dashboard/ircc`.

- Manual trigger from UI: `Dashboard -> IRCC Tracker -> Run Due Checks`
- API trigger (authenticated dashboard session):

```bash
curl -X POST "http://localhost:3000/api/jobs/ircc-checks?limit=50"
```

- API trigger for cron jobs (recommended in production):

```bash
curl -X POST "https://your-app.example.com/api/jobs/ircc-checks?limit=100" \
	-H "Authorization: Bearer $CRON_SECRET"
```

Optional query parameters:

- `limit`: Max number of cases processed in one run (default `25`, max `200`)
- `force=1`: Process all monitoring-enabled cases, not just due cases

Behavior summary:

- Processes cases where `monitorEnabled = true`
- Uses `nextCheckAt` and `monitorIntervalMinutes` to schedule recurring checks
- Writes snapshots into `IrccCaseSnapshot`
- Updates `lastKnownStatus`, `lastCheckedAt`, and `nextCheckAt`
