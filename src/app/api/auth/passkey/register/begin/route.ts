import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildRegistrationOptions,
  getChallengeCookieOptions,
} from "@/lib/passkey-auth";

const schema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
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

  const options = await buildRegistrationOptions(request, parsed.data);
  const response = NextResponse.json({ ok: true, options }, { status: 200 });

  response.cookies.set(
    "ircc_passkey_challenge",
    options.challenge,
    getChallengeCookieOptions(),
  );

  return response;
}
