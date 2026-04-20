import { NextResponse } from "next/server";

import { buildSnippet, stripHtml } from "@/lib/email-helpers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? "50");

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(200, Math.max(1, Math.trunc(parsed)));
}

export async function GET(
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
    },
    select: {
      id: true,
      emailAddress: true,
      label: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json(
      { ok: false, error: "Mailbox not found" },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") === "sent" ? "sent" : "inbox";
  const limit = parseLimit(url.searchParams.get("limit"));

  if (folder === "sent") {
    const sentEmails = await prisma.sentEmail.findMany({
      where: {
        mailboxId: mailbox.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    const emails = sentEmails.map((email) => ({
      id: email.id,
      kind: "sent" as const,
      subject: email.subject || "(No subject)",
      from: mailbox.emailAddress,
      to: email.toAddresses,
      cc: email.ccAddresses,
      bcc: email.bccAddresses,
      preview: buildSnippet(email.textBody ?? stripHtml(email.htmlBody ?? "")),
      textBody: email.textBody,
      htmlBody: email.htmlBody,
      createdAt: email.createdAt,
      status: email.status,
      isRead: true,
      attachments: [],
    }));

    return NextResponse.json({ ok: true, mailbox, folder, emails });
  }

  const inboundEmails = await prisma.inboundEmail.findMany({
    where: {
      toAddresses: {
        has: mailbox.emailAddress,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      attachments: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  const readIds = new Set(
    (
      await prisma.inboundEmailRead.findMany({
        where: {
          mailboxId: mailbox.id,
          emailId: {
            in: inboundEmails.map((email) => email.id),
          },
        },
        select: {
          emailId: true,
        },
      })
    ).map((item) => item.emailId),
  );

  const emails = inboundEmails.map((email) => ({
    id: email.id,
    kind: "inbound" as const,
    subject: email.subject || "(No subject)",
    from: email.fromAddress || email.fromRaw,
    to: email.toAddresses,
    cc: email.ccAddresses,
    bcc: email.bccAddresses,
    preview: buildSnippet(email.textBody ?? stripHtml(email.htmlBody ?? "")),
    textBody: email.textBody,
    htmlBody: email.htmlBody,
    createdAt: email.createdAt,
    isRead: readIds.has(email.id),
    messageId: email.messageId,
    attachments: email.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      hasDownload: Boolean(
        attachment.storagePath ||
        attachment.storagePublicUrl ||
        attachment.downloadUrl,
      ),
      downloadPath: `/api/mail/attachments/${attachment.id}/download`,
    })),
  }));

  return NextResponse.json({ ok: true, mailbox, folder, emails });
}
