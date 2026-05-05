import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptDataForUser } from "@/lib/e2ee";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

const createVaultRecordSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10000),
});

export async function GET(): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const records = await prisma.vaultRecord.findMany({
    where: { userId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      titleHint: true,
      encryptedPayload: true,
      encryptedPayloadIv: true,
      wrappedKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, records });
}

export async function POST(request: Request): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!sessionUser.encryptionPublicKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing encryption public key for this account",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createVaultRecordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid vault payload",
      },
      { status: 400 },
    );
  }

  const encrypted = await encryptDataForUser(
    JSON.stringify({
      title: parsed.data.title,
      body: parsed.data.body,
    }),
    sessionUser.encryptionPublicKey,
  );

  const record = await prisma.vaultRecord.create({
    data: {
      userId: sessionUser.id,
      titleHint: parsed.data.title.slice(0, 24),
      encryptedPayload: encrypted.ciphertext,
      encryptedPayloadIv: encrypted.iv,
      wrappedKey: encrypted.wrappedKey,
    },
    select: {
      id: true,
      titleHint: true,
      encryptedPayload: true,
      encryptedPayloadIv: true,
      wrappedKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, record }, { status: 201 });
}
