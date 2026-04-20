import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeEmailAddress } from "@/lib/email-helpers";
import {
  generateMailboxPassword,
  encryptMailboxPassword,
} from "@/lib/password-vault";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

const createMailboxSchema = z.object({
  passportId: z.string().trim().min(3).max(80),
  emailAddress: z.string().trim().email(),
  label: z.string().trim().max(80).optional().or(z.literal("")),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
});

export async function GET(): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const mailboxes = await prisma.virtualMailbox.findMany({
    where: {
      ownerId: sessionUser.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      passportId: true,
      emailAddress: true,
      label: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const withCounts = await Promise.all(
    mailboxes.map(async (mailbox) => {
      const [inboxCount, readCount, sentCount] = await Promise.all([
        prisma.inboundEmail.count({
          where: {
            toAddresses: {
              has: mailbox.emailAddress,
            },
          },
        }),
        prisma.inboundEmailRead.count({
          where: {
            mailboxId: mailbox.id,
            email: {
              toAddresses: {
                has: mailbox.emailAddress,
              },
            },
          },
        }),
        prisma.sentEmail.count({
          where: {
            mailboxId: mailbox.id,
          },
        }),
      ]);

      return {
        ...mailbox,
        inboxCount: Math.max(0, inboxCount - readCount),
        sentCount,
      };
    }),
  );

  return NextResponse.json({ ok: true, mailboxes: withCounts });
}

export async function POST(request: Request): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createMailboxSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid mailbox payload",
      },
      { status: 400 },
    );
  }

  const normalizedEmail = normalizeEmailAddress(parsed.data.emailAddress);
  const clearPassword =
    parsed.data.password?.trim() || generateMailboxPassword();
  const encryptedPassword = encryptMailboxPassword(clearPassword);

  try {
    const mailbox = await prisma.virtualMailbox.create({
      data: {
        ownerId: sessionUser.id,
        passportId: parsed.data.passportId.trim().toUpperCase(),
        emailAddress: normalizedEmail,
        label: parsed.data.label?.trim() || null,
        passwordCiphertext: encryptedPassword.ciphertext,
        passwordIv: encryptedPassword.iv,
        passwordTag: encryptedPassword.tag,
      },
      select: {
        id: true,
        passportId: true,
        emailAddress: true,
        label: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        mailbox,
        createdPassword: clearPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A mailbox already exists for this passport ID or email address",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to create mailbox",
      },
      { status: 500 },
    );
  }
}
