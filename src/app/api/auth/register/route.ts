import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: "Use the passkey registration flow instead of password signup.",
    },
    { status: 410 },
  );
}
