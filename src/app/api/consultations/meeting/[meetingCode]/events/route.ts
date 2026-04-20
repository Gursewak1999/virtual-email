import { NextResponse } from "next/server";

import {
  createConsultationMeetingEvent,
  getConsultationMeetingAccess,
  listConsultationMeetingEvents,
} from "@/features/consultations/lib/server";
import {
  consultationMeetingEventSchema,
  consultationMeetingEventsQuerySchema,
} from "@/features/consultations/lib/validation";
import { getSessionUser } from "@/lib/session-user";

interface RouteParams {
  params: Promise<{ meetingCode: string }>;
}

async function assertMeetingRoleAccess(
  meetingCode: string,
  role: "HOST" | "GUEST",
) {
  const consultation = await getConsultationMeetingAccess(meetingCode);

  if (!consultation) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Consultation room not found" },
        { status: 404 },
      ),
      consultation: null,
    };
  }

  if (role === "HOST") {
    const sessionUser = await getSessionUser();

    if (!sessionUser || sessionUser.id !== consultation.hostId) {
      return {
        error: NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        ),
        consultation: null,
      };
    }
  }

  return {
    error: null,
    consultation,
  };
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { meetingCode } = await params;
  const url = new URL(request.url);
  const parsed = consultationMeetingEventsQuerySchema.safeParse({
    role: url.searchParams.get("role"),
    clientId: url.searchParams.get("clientId"),
    after: url.searchParams.get("after") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid events query",
      },
      { status: 400 },
    );
  }

  const access = await assertMeetingRoleAccess(meetingCode, parsed.data.role);

  if (access.error) {
    return access.error;
  }

  const result = await listConsultationMeetingEvents({
    meetingCode,
    role: parsed.data.role,
    clientId: parsed.data.clientId,
    after: parsed.data.after,
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Consultation room not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    consultationStatus: result.consultationStatus,
    events: result.events,
    cursor: result.cursor,
    activeParticipantCount: result.activeParticipantCount,
    peerLimit: result.peerLimit,
  });
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { meetingCode } = await params;
  const body = await request.json().catch(() => null);
  const parsed = consultationMeetingEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid meeting event payload",
      },
      { status: 400 },
    );
  }

  const access = await assertMeetingRoleAccess(meetingCode, parsed.data.role);

  if (access.error) {
    return access.error;
  }

  try {
    const event = await createConsultationMeetingEvent({
      meetingCode,
      senderRole: parsed.data.role,
      senderClientId: parsed.data.clientId,
      targetRole: parsed.data.targetRole,
      targetClientId: parsed.data.targetClientId,
      eventType: parsed.data.eventType,
      payload: parsed.data.payload,
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Consultation room not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish meeting event",
      },
      { status: 409 },
    );
  }
}
