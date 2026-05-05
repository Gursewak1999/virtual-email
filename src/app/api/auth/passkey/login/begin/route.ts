import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildAuthenticationOptions,
  getChallengeCookieOptions,
} from "@/lib/passkey-auth";

const schema = z.object({
  email: z.string().email(),
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

  const options = await buildAuthenticationOptions(request, parsed.data.email);

  if (!options) {
    return NextResponse.json(
      { ok: false, error: "No passkeys are registered for this account" },
      { status: 404 },
    );
  }

  const response = NextResponse.json({ ok: true, options }, { status: 200 });
  response.cookies.set(
    "ircc_passkey_challenge",
    options.challenge,
    getChallengeCookieOptions(),
  );

  return response;
}
