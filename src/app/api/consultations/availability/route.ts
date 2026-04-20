import { NextResponse } from "next/server";

import { updateConsultationAvailabilityForHost } from "@/features/consultations/lib/server";
import { consultationAvailabilitySchema } from "@/features/consultations/lib/validation";
import { getConsultationHostProfilePayload } from "@/features/consultations/lib/server";
import { getSessionUser } from "@/lib/session-user";

export async function GET(request: Request): Promise<NextResponse> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const hostProfile = await getConsultationHostProfilePayload(
    sessionUser.id,
    new URL(request.url).origin,
  );

  return NextResponse.json({ ok: true, hostProfile });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = consultationAvailabilitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Invalid availability payload",
      },
      { status: 400 },
    );
  }

  const invalidTimeRange = parsed.data.availability.find(
    (window) => window.enabled && window.startTime >= window.endTime,
  );

  if (invalidTimeRange) {
    return NextResponse.json(
      {
        ok: false,
        error: "Each enabled day needs an end time after its start time.",
      },
      { status: 400 },
    );
  }

  const hostProfile = await updateConsultationAvailabilityForHost({
    userId: sessionUser.id,
    availability: parsed.data.availability,
    blockedDates: parsed.data.blockedDates,
    baseUrl: new URL(request.url).origin,
  });

  return NextResponse.json({ ok: true, hostProfile });
}
