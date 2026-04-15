import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Please provide a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request payload",
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return NextResponse.json(
      {
        ok: false,
        error: "An account with this email already exists",
      },
      { status: 409 },
    );
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name?.trim() || null,
      email,
      passwordHash,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
      },
    },
    { status: 201 },
  );
}
