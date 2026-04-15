import { NextResponse, type NextRequest } from "next/server";
import type { EmailReceivedEvent, WebhookEventPayload } from "resend";

import { ingestInboundEmail } from "@/lib/inbound-ingestion";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseWebhookEvent(rawPayload: string, request: NextRequest): WebhookEventPayload {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing RESEND_WEBHOOK_SECRET in production.");
    }

    return JSON.parse(rawPayload) as WebhookEventPayload;
  }

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    throw new Error("Missing Resend webhook signature headers.");
  }

  const resend = getResendClient();

  return resend.webhooks.verify({
    payload: rawPayload,
    headers: {
      id,
      timestamp,
      signature,
    },
    webhookSecret,
  });
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    route: "resend-inbound-webhook",
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawPayload = await request.text();
    const event = parseWebhookEvent(rawPayload, request);

    if (event.type !== "email.received") {
      return NextResponse.json(
        {
          ok: true,
          ignored: true,
          reason: "Unsupported event type.",
          eventType: event.type,
        },
        { status: 202 },
      );
    }

    const result = await ingestInboundEmail({
      resendEmailId: event.data.email_id,
      source: "webhook",
      webhookEvent: event as EmailReceivedEvent,
      rawWebhook: event,
    });

    if (result.skipped) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: result.reason,
          resendEmailId: result.resendEmailId,
        },
        { status: 202 },
      );
    }

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: asErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
