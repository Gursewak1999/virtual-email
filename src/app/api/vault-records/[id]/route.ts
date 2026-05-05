import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptDataForUser } from "@/lib/e2ee";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

const updateVaultRecordSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
}).refine((data) => data.title !== undefined || data.body !== undefined, {
  message: "At least one field is required",
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
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

  const { id } = await params;
  const existingRecord = await prisma.vaultRecord.findFirst({
    where: { id, userId: sessionUser.id },
  });

  if (!existingRecord) {
    return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateVaultRecordSchema.safeParse(body);

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
      title: parsed.data.title ?? existingRecord.titleHint ?? "Untitled",
      body: parsed.data.body ?? "",
    }),
    sessionUser.encryptionPublicKey,
  );

  const record = await prisma.vaultRecord.update({
    where: { id },
    data: {
      titleHint: parsed.data.title?.slice(0, 24) ?? existingRecord.titleHint,
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

  return NextResponse.json({ ok: true, record });
}

export async function DELETE(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const record = await prisma.vaultRecord.findFirst({
    where: { id, userId: sessionUser.id },
    select: { id: true },
  });

  if (!record) {
    return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
  }

  await prisma.vaultRecord.delete({ where: { id: record.id } });

  return NextResponse.json({ ok: true, deletedId: record.id });
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const record = await prisma.vaultRecord.findFirst({
    where: { id, userId: sessionUser.id },
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

  if (!record) {
    return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, record });
}
