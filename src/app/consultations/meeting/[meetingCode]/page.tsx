import { notFound } from "next/navigation";

import { getConsultationMeetingPayload } from "@/features/consultations/lib/server";
import { MeetingRoomClient } from "@/features/consultations/meeting/meeting-room-client";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

interface MeetingPageProps {
  params: Promise<{ meetingCode: string }>;
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const sessionUser = await getSessionUser();
  const { meetingCode } = await params;
  const consultation = await getConsultationMeetingPayload(meetingCode);

  if (!consultation) {
    notFound();
  }

  const isHost =
    !!sessionUser &&
    sessionUser.id === consultation.hostId;

  return <MeetingRoomClient consultation={consultation} isHost={isHost} />;
}
