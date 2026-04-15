import { NextResponse } from "next/server";

import { decryptMailboxPassword } from "@/lib/password-vault";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  const { id } = await params;

  const mailbox = await prisma.virtualMailbox.findFirst({
    where: {
      id,
      ownerId: sessionUser.id,
    },
    select: {
      id: true,
      passwordCiphertext: true,
      passwordIv: true,
      passwordTag: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json(
      { ok: false, error: "Mailbox not found" },
      { status: 404 },
    );
  }

  const password = decryptMailboxPassword({
    ciphertext: mailbox.passwordCiphertext,
    iv: mailbox.passwordIv,
    tag: mailbox.passwordTag,
  });

  return NextResponse.json({ ok: true, password });
}
