import { NextResponse } from "next/server";
import { z } from "zod";

import { parseRecipientInput } from "@/lib/email-helpers";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import { getSessionUser } from "@/lib/session-user";

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentBase64: z.string().trim().min(1),
  contentType: z.string().trim().max(200).optional(),
});

const sendEmailSchema = z
  .object({
    to: z.union([z.string(), z.array(z.string())]),
    cc: z.union([z.string(), z.array(z.string())]).optional(),
    bcc: z.union([z.string(), z.array(z.string())]).optional(),
    subject: z.string().trim().max(240).optional().or(z.literal("")),
    textBody: z.string().trim().max(120_000).optional().or(z.literal("")),
    htmlBody: z.string().trim().max(300_000).optional().or(z.literal("")),
    attachments: z.array(attachmentSchema).max(10).optional(),
  })
  .refine(
    (value) => {
      const hasBody =
        (value.textBody && value.textBody.length > 0) ||
        (value.htmlBody && value.htmlBody.length > 0);
      return hasBody;
    },
    { message: "Email body is required" },
  );

interface RouteParams {
  params: Promise<{ id: string }>;
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
  const parsed = sendEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid email payload",
      },
      { status: 400 },
    );
  }

  const toAddresses = parseRecipientInput(parsed.data.to);
  const ccAddresses = parseRecipientInput(parsed.data.cc);
  const bccAddresses = parseRecipientInput(parsed.data.bcc);
  const subject = parsed.data.subject?.trim() || "(No subject)";
  const textBody = parsed.data.textBody?.trim() || "";
  const htmlBody = parsed.data.htmlBody?.trim() || "";

  if (toAddresses.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one recipient is required" },
      { status: 400 },
    );
  }

  const resend = getResendClient();

  const basePayload = {
    from: mailbox.emailAddress,
    to: toAddresses,
    cc: ccAddresses.length > 0 ? ccAddresses : undefined,
    bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
    subject,
    replyTo: mailbox.emailAddress,
    attachments: parsed.data.attachments?.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: Buffer.from(attachment.contentBase64, "base64"),
    })),
  };

  const sendPayload: Parameters<typeof resend.emails.send>[0] = htmlBody
    ? textBody
      ? { ...basePayload, text: textBody, html: htmlBody }
      : { ...basePayload, html: htmlBody }
    : { ...basePayload, text: textBody };

  const { data, error } = await resend.emails.send(sendPayload);

  const status = error ? "failed" : "sent";

  const sentEmail = await prisma.sentEmail.create({
    data: {
      ownerId: sessionUser.id,
      mailboxId: mailbox.id,
      resendEmailId: data?.id ?? null,
      toAddresses,
      ccAddresses,
      bccAddresses,
      subject,
      textBody: textBody || null,
      htmlBody: htmlBody || null,
      status,
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

  return NextResponse.json({
    ok: true,
    sentEmail,
  });
}
