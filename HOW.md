# Resend Inbound -> Supabase Pipeline

This project now ingests inbound emails from Resend, stores rich metadata in Supabase Postgres via Prisma, and stores attachment binaries in Supabase Storage.

## What it does

- Receives Resend webhook events at `/api/webhooks/resend/inbound`.
- Verifies Svix signatures using `RESEND_WEBHOOK_SECRET`.
- Fetches full inbound content (HTML, text, headers, raw email URL) from Resend Receiving API.
- Fetches attachment signed URLs from Resend Receiving Attachments API.
- Uploads attachment binaries to Supabase Storage.
- Persists email + attachment metadata in Postgres with idempotent upserts.
- Runs a Vercel cron backfill endpoint every 10 minutes to replay recent inbound messages and close delivery gaps.

## Database models

Prisma models are in `prisma/schema.prisma`:

- `InboundEmail`
- `InboundEmailAttachment`

Captured fields include:

- Resend ids and timestamps (`resendEmailId`, `webhookCreatedAt`, `resendCreatedAt`)
- Sender/recipient detail (`fromRaw`, parsed from fields, to/cc/bcc/reply-to addresses and parsed recipient objects)
- Message metadata (`subject`, `messageId`, `inReplyTo`, `references`, `headers`)
- Full content (`htmlBody`, `textBody`)
- Raw source objects (`rawWebhook`, `rawReceivingEmail`)
- Attachment metadata (`contentType`, `contentDisposition`, `downloadUrl`, size)
- Storage metadata (`storageBucket`, `storagePath`, `storagePublicUrl`, `sha256`, `storageUploadedAt`)

## Environment variables

Copy `.env.example` to `.env` and set values:

- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_INBOUND_DOMAIN` (set to `jatts.ca`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_EMAIL_ATTACHMENTS_BUCKET`
- `SUPABASE_EMAIL_ATTACHMENTS_PUBLIC`
- `CRON_SECRET`

## Supabase setup

1. Create a Supabase project.
2. Set `DATABASE_URL` to the project Postgres connection string.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run migrations:

```bash
bun run db:migrate
```

Attachment bucket is auto-created on first upload if it does not exist.

## Resend setup for catch-all @jatts.ca

1. Add and verify `jatts.ca` in Resend with receiving capability enabled.
2. Point MX records for inbound handling to Resend receiving as instructed in Resend dashboard.
3. Configure a webhook in Resend:
	- Endpoint: `https://<your-vercel-domain>/api/webhooks/resend/inbound`
	- Event: `email.received`
4. Save the webhook signing secret to `RESEND_WEBHOOK_SECRET`.

Once MX is configured, inbound is catch-all on domain level: any address at `@jatts.ca` is received by Resend and forwarded to your webhook.

## Vercel deployment (24x7)

This repository includes `vercel.json` with cron:

- Path: `/api/jobs/resend-backfill`
- Schedule: every 10 minutes

To activate reliable backfill in production:

1. Deploy to Vercel.
2. Add all environment variables in Vercel Project Settings.
3. Ensure `CRON_SECRET` is set (Vercel will pass it as bearer token to cron route).
4. Keep Resend webhook pointed at your production domain.

Webhook + cron backfill + idempotent upsert gives robust 24x7 behavior on serverless infrastructure.

## Local run

```bash
bun install
bun run db:generate
bun dev
```

## Test checklist

1. Send an email to any inbox at `@jatts.ca`.
2. Confirm `POST /api/webhooks/resend/inbound` returns `ok: true`.
3. Verify rows in `InboundEmail` and `InboundEmailAttachment`.
4. Verify files in the configured Supabase storage bucket.
