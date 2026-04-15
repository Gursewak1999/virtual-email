import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeEmailAddress } from "@/lib/email-helpers";
import { encryptMailboxPassword } from "@/lib/password-vault";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

const updateMailboxSchema = z
  .object({
    passportId: z.string().trim().min(3).max(80).optional(),
    emailAddress: z.string().trim().email().optional(),
    label: z.string().trim().max(80).optional().or(z.literal("")),
    password: z.string().min(8).max(128).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
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
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const existingMailbox = await prisma.virtualMailbox.findFirst({
    where: {
      id,
      ownerId: sessionUser.id,
    },
  });

  if (!existingMailbox) {
    return NextResponse.json(
      { ok: false, error: "Mailbox not found" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMailboxSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid update payload",
      },
      { status: 400 },
    );
  }

  const updateData: Prisma.VirtualMailboxUpdateInput = {};

  if (parsed.data.passportId) {
    updateData.passportId = parsed.data.passportId.trim().toUpperCase();
  }

  if (parsed.data.emailAddress) {
    updateData.emailAddress = normalizeEmailAddress(parsed.data.emailAddress);
  }

  if (parsed.data.label !== undefined) {
    updateData.label = parsed.data.label.trim() || null;
  }

  if (parsed.data.isActive !== undefined) {
    updateData.isActive = parsed.data.isActive;
  }

  if (parsed.data.password && parsed.data.password.trim()) {
    const encrypted = encryptMailboxPassword(parsed.data.password.trim());
    updateData.passwordCiphertext = encrypted.ciphertext;
    updateData.passwordIv = encrypted.iv;
    updateData.passwordTag = encrypted.tag;
  }

  try {
    const mailbox = await prisma.virtualMailbox.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ ok: true, mailbox });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Mailbox update violates uniqueness constraints",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to update mailbox",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    },
  });

  if (!mailbox) {
    return NextResponse.json(
      { ok: false, error: "Mailbox not found" },
      { status: 404 },
    );
  }

  await prisma.virtualMailbox.delete({
    where: {
      id: mailbox.id,
    },
  });

  return NextResponse.json({ ok: true, deletedId: mailbox.id });
}
