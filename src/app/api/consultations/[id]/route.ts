import { NextResponse } from "next/server";

import { updateConsultationStatusForHost } from "@/features/consultations/lib/server";
import { updateConsultationStatusSchema } from "@/features/consultations/lib/validation";
import { getSessionUser } from "@/lib/session-user";

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

  const body = await request.json().catch(() => null);
  const parsed = updateConsultationStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid status payload",
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const consultation = await updateConsultationStatusForHost({
    hostId: sessionUser.id,
    consultationId: id,
    status: parsed.data.status,
    baseUrl: new URL(request.url).origin,
  });

  if (!consultation) {
    return NextResponse.json(
      { ok: false, error: "Consultation not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, consultation });
}
