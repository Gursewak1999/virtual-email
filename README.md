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
