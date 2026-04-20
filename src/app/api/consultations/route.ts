import { NextResponse } from "next/server";

import { combineDateAndTime } from "@/features/consultations/lib/scheduling";
import {
  createConsultationForHost,
  getConsultationHostProfilePayload,
  listConsultationsForHost,
} from "@/features/consultations/lib/server";
import { createConsultationSchema } from "@/features/consultations/lib/validation";
import { getSessionUser } from "@/lib/session-user";

export async function GET(request: Request): Promise<NextResponse> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const baseUrl = new URL(request.url).origin;
  const [hostProfile, consultations] = await Promise.all([
    getConsultationHostProfilePayload(sessionUser.id, baseUrl),
    listConsultationsForHost(sessionUser.id, baseUrl),
  ]);

  return NextResponse.json({
    ok: true,
    hostProfile,
    consultations,
  });
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
  const parsed = createConsultationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Invalid consultation payload",
      },
      { status: 400 },
    );
  }

  const scheduledAt = combineDateAndTime(
    parsed.data.scheduledDate,
    parsed.data.scheduledTime,
  );

  if (scheduledAt <= new Date()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Consultations must be scheduled for a future time.",
      },
      { status: 400 },
    );
  }

  try {
    const consultation = await createConsultationForHost({
      hostId: sessionUser.id,
      attendeeName: parsed.data.attendeeName,
      attendeeEmail: parsed.data.attendeeEmail,
      attendeePhone: parsed.data.attendeePhone,
      scheduledAt,
      baseUrl: new URL(request.url).origin,
    });

    return NextResponse.json(
      {
        ok: true,
        consultation,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create consultation",
      },
      { status: 409 },
    );
  }
}
