import { NextResponse } from "next/server";

import {
  createConsultationFromBooking,
  getPublicBookingPayload,
} from "@/features/consultations/lib/server";
import { createPublicBookingSchema } from "@/features/consultations/lib/validation";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { slug } = await params;
  const booking = await getPublicBookingPayload(slug);

  if (!booking) {
    return NextResponse.json(
      { ok: false, error: "Booking page not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, booking });
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createPublicBookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid booking payload",
      },
      { status: 400 },
    );
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please choose a valid future time slot.",
      },
      { status: 400 },
    );
  }

  try {
    const consultation = await createConsultationFromBooking({
      bookingSlug: slug,
      attendeeName: parsed.data.attendeeName,
      attendeeEmail: parsed.data.attendeeEmail,
      attendeePhone: parsed.data.attendeePhone,
      scheduledAt,
      baseUrl: new URL(request.url).origin,
    });

    if (!consultation) {
      return NextResponse.json(
        { ok: false, error: "Booking page not found" },
        { status: 404 },
      );
    }

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
          error instanceof Error ? error.message : "Unable to book this slot",
      },
      { status: 409 },
    );
  }
}
