import { NextResponse, type NextRequest } from "next/server";

import { ingestInboundEmail } from "@/lib/inbound-ingestion";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? "25");
  if (!Number.isFinite(parsed)) {
    return 25;
  }

  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const resend = getResendClient();
    const receivingList = await resend.emails.receiving.list({ limit });

    if (receivingList.error || !receivingList.data) {
      return NextResponse.json(
        {
          ok: false,
          error: receivingList.error?.message ?? "Failed to list received emails from Resend.",
        },
        { status: 500 },
      );
    }

    const results = [] as Array<{
      resendEmailId: string;
      skipped: boolean;
      reason?: string;
      attachmentCount: number;
      uploadedAttachmentCount: number;
      emailId?: string;
    }>;

    for (const email of receivingList.data.data) {
      try {
        const ingestResult = await ingestInboundEmail({
          resendEmailId: email.id,
          source: "backfill",
        });

        results.push(ingestResult);
      } catch (error) {
        results.push({
          resendEmailId: email.id,
          skipped: true,
          reason: asErrorMessage(error),
          attachmentCount: 0,
          uploadedAttachmentCount: 0,
        });
      }
    }

    const ingestedCount = results.filter((item) => !item.skipped).length;
    const skippedCount = results.length - ingestedCount;

    return NextResponse.json({
      ok: true,
      scanned: receivingList.data.data.length,
      ingested: ingestedCount,
      skipped: skippedCount,
      results,
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
