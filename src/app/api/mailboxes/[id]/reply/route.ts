import { NextResponse } from "next/server";
import { z } from "zod";

import {
  extractEmailAddress,
  parseRecipientInput,
  stripHtml,
} from "@/lib/email-helpers";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import { getSessionUser } from "@/lib/session-user";

const replySchema = z
  .object({
    inboundEmailId: z.string().trim().min(1),
    textBody: z.string().trim().max(120_000).optional().or(z.literal("")),
    htmlBody: z.string().trim().max(300_000).optional().or(z.literal("")),
    replyAll: z.boolean().optional().default(false),
  })
  .refine(
    (value) => {
      const hasBody =
        (value.textBody && value.textBody.length > 0) ||
        (value.htmlBody && value.htmlBody.length > 0);
      return hasBody;
    },
    { message: "Reply body is required" },
  );

interface RouteParams {
  params: Promise<{ id: string }>;
}

function buildReplySubject(subject: string | null): string {
  const baseSubject = (subject || "").trim();
  if (!baseSubject) {
    return "Re: (No subject)";
  }

  return baseSubject.toLowerCase().startsWith("re:")
    ? baseSubject
    : `Re: ${baseSubject}`;
}

function buildQuotedText(replyBody: string, original: string | null): string {
  const quoted = (original || "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  if (!quoted.trim()) {
    return replyBody;
  }

  return `${replyBody}\n\n--- Original Message ---\n${quoted}`;
}

function dedupeAddresses(addresses: string[]): string[] {
  return addresses.filter((item, index, all) => all.indexOf(item) === index);
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const mailbox = await prisma.virtualMailbox.findFirst({
    where: {
      id,
      ownerId: sessionUser.id,
      isActive: true,
    },
    select: {
      id: true,
      emailAddress: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json(
      { ok: false, error: "Mailbox not found or inactive" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid reply payload",
      },
      { status: 400 },
    );
  }

  const inboundEmail = await prisma.inboundEmail.findFirst({
    where: {
      id: parsed.data.inboundEmailId,
      toAddresses: {
        has: mailbox.emailAddress,
      },
    },
    select: {
      id: true,
      fromAddress: true,
      fromRaw: true,
      toAddresses: true,
      ccAddresses: true,
      subject: true,
      textBody: true,
      htmlBody: true,
    },
  });

  if (!inboundEmail) {
    return NextResponse.json(
      { ok: false, error: "Original email not found" },
      { status: 404 },
    );
  }

  const senderAddress =
    inboundEmail.fromAddress || extractEmailAddress(inboundEmail.fromRaw);

  if (!senderAddress) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not determine sender address for reply",
      },
      { status: 400 },
    );
  }

  const toAddresses = [senderAddress];

  let ccAddresses: string[] = [];
  if (parsed.data.replyAll) {
    ccAddresses = dedupeAddresses(
      [
        ...parseRecipientInput(inboundEmail.toAddresses),
        ...parseRecipientInput(inboundEmail.ccAddresses),
      ].filter(
        (item) => item !== mailbox.emailAddress && item !== senderAddress,
      ),
    );
  }

  const baseTextBody = parsed.data.textBody?.trim() || "";
  const originalText =
    inboundEmail.textBody || stripHtml(inboundEmail.htmlBody || "");
  const textBody = buildQuotedText(baseTextBody, originalText);

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: mailbox.emailAddress,
    to: toAddresses,
    cc: ccAddresses.length > 0 ? ccAddresses : undefined,
    subject: buildReplySubject(inboundEmail.subject),
    text: textBody,
    html: parsed.data.htmlBody?.trim() || undefined,
    replyTo: mailbox.emailAddress,
  });

  const status = error ? "failed" : "sent";

  const sentEmail = await prisma.sentEmail.create({
    data: {
      ownerId: sessionUser.id,
      mailboxId: mailbox.id,
      resendEmailId: data?.id ?? null,
      toAddresses,
      ccAddresses,
      bccAddresses: [],
      subject: buildReplySubject(inboundEmail.subject),
      textBody,
      htmlBody: parsed.data.htmlBody?.trim() || null,
      status,
      replyToInboundEmailId: inboundEmail.id,
    },
    select: {
      id: true,
      resendEmailId: true,
      createdAt: true,
      status: true,
    },
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        sentEmail,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sentEmail });
}
