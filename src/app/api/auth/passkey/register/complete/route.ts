import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAndStoreRegistration } from "@/lib/passkey-auth";

const schema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  registrationResponse: z.any(),
  vault: z.object({
    publicKeyJwk: z.string().min(1),
    encryptedPrivateKey: z.string().min(1),
    encryptedPrivateKeyIv: z.string().min(1),
    encryptedPrivateKeySalt: z.string().min(1),
    encryptedPrivateKeyRounds: z.number().int().positive(),
  }),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const challenge = cookieStore.get("ircc_passkey_challenge")?.value;

  if (!challenge) {
    return NextResponse.json(
      { ok: false, error: "Registration challenge expired" },
      { status: 400 },
    );
  }

  const result = await verifyAndStoreRegistration(request, {
    registrationResponse: parsed.data.registrationResponse,
    user: {
      userId: parsed.data.userId,
      email: parsed.data.email,
      name: parsed.data.name,
    },
    vault: parsed.data.vault,
    challenge,
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Passkey registration failed" },
      { status: 400 },
    );
  }

  cookieStore.delete("ircc_passkey_challenge");

  return NextResponse.json({
    ok: true,
    user: result.user,
    recoveryCodes: result.recoveryCodes,
  });
}
