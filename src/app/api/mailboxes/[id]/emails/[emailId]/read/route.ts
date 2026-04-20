import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

interface RouteParams {
  params: Promise<{ id: string; emailId: string }>;
}

export async function POST(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id, emailId } = await params;

  const mailbox = await prisma.virtualMailbox.findFirst({
    where: {
      id,
      ownerId: sessionUser.id,
    },
    select: {
      id: true,
      emailAddress: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json(
      { ok: false, error: "Mailbox not found" },
      { status: 404 },
    );
  }

  const inboundEmail = await prisma.inboundEmail.findFirst({
    where: {
      id: emailId,
      toAddresses: {
        has: mailbox.emailAddress,
      },
    },
    select: {
      id: true,
    },
  });

  if (!inboundEmail) {
    return NextResponse.json(
      { ok: false, error: "Inbound email not found" },
      { status: 404 },
    );
  }

  await prisma.inboundEmailRead.upsert({
    where: {
      mailboxId_emailId: {
        mailboxId: mailbox.id,
        emailId: inboundEmail.id,
      },
    },
    update: {
      readAt: new Date(),
    },
    create: {
      mailboxId: mailbox.id,
      emailId: inboundEmail.id,
    },
  });

  return NextResponse.json({ ok: true });
}
