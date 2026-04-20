import { randomBytes } from "node:crypto";
import { ConsultationStatus as PrismaConsultationStatus, Prisma } from "@prisma/client";

import { normalizeEmailAddress } from "@/lib/email-helpers";
import { prisma } from "@/lib/prisma";
import { addMinutes, generateAvailableSlotDays } from "@/features/consultations/lib/scheduling";
import {
  CONSULTATION_MEETING_PRESENCE_TTL_MS,
  DEFAULT_AVAILABILITY,
  DEFAULT_CONSULTATION_DURATION_MINUTES,
  DEFAULT_CONSULTATION_MEETING_PEER_LIMIT,
  DEFAULT_CONSULTATION_TIMEZONE,
  getBookingPath,
  getMeetingPath,
  minutesToTimeValue,
  timeValueToMinutes,
  type ConsultationAvailabilityDay,
  type ConsultationBlockedDateRecord,
  type ConsultationMeetingEventRecord,
  type ConsultationMeetingEventType,
  type ConsultationHostProfilePayload,
  type ConsultationMeetingPayload,
  type ConsultationMeetingRole,
  type ConsultationRecord,
  type PublicBookingPayload,
} from "@/features/consultations/lib/shared";

function createRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

export function getConsultationMeetingPeerLimit(): number {
  const rawValue = process.env.CONSULTATION_MEETING_PEER_LIMIT;

  if (!rawValue) {
    return DEFAULT_CONSULTATION_MEETING_PEER_LIMIT;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (parsed === 3 || parsed === 4) {
    return parsed;
  }

  return DEFAULT_CONSULTATION_MEETING_PEER_LIMIT;
}

function buildAbsoluteUrl(pathOrUrl: string, baseUrl?: string): string {
  if (!baseUrl || /^https?:\/\//.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, baseUrl).toString();
}

function serializeConsultation(
  consultation: {
    id: string;
    attendeeName: string;
    attendeeEmail: string;
    attendeePhone: string | null;
    scheduledAt: Date;
    endsAt: Date;
    status: PrismaConsultationStatus;
    completedAt: Date | null;
    meetingCode: string;
    meetingPath: string;
    meetingUrl: string;
    createdAt: Date;
    updatedAt: Date;
  },
  baseUrl?: string,
): ConsultationRecord {
  return {
    id: consultation.id,
    attendeeName: consultation.attendeeName,
    attendeeEmail: consultation.attendeeEmail,
    attendeePhone: consultation.attendeePhone,
    scheduledAt: consultation.scheduledAt.toISOString(),
    endsAt: consultation.endsAt.toISOString(),
    status: consultation.status,
    completedAt: consultation.completedAt?.toISOString() ?? null,
    meetingCode: consultation.meetingCode,
    meetingPath: consultation.meetingPath,
    meetingUrl: buildAbsoluteUrl(
      consultation.meetingUrl || consultation.meetingPath,
      baseUrl,
    ),
    createdAt: consultation.createdAt.toISOString(),
    updatedAt: consultation.updatedAt.toISOString(),
  };
}

function serializeMeetingEvent(event: {
  id: string;
  senderRole: ConsultationMeetingRole;
  senderClientId: string;
  targetRole: ConsultationMeetingRole | null;
  targetClientId: string | null;
  eventType: string;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
}): ConsultationMeetingEventRecord {
  return {
    id: event.id,
    senderRole: event.senderRole,
    senderClientId: event.senderClientId,
    targetRole: event.targetRole,
    targetClientId: event.targetClientId,
    eventType: event.eventType as ConsultationMeetingEventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

function buildAvailabilityPayload(
  availabilityWindows: Array<{
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
  }>,
): ConsultationAvailabilityDay[] {
  const byDay = new Map(
    availabilityWindows.map((window) => [window.dayOfWeek, window]),
  );

  return DEFAULT_AVAILABILITY.map((defaultWindow) => {
    const savedWindow = byDay.get(defaultWindow.dayOfWeek);

    if (!savedWindow) {
      return { ...defaultWindow };
    }

    return {
      dayOfWeek: defaultWindow.dayOfWeek,
      enabled: true,
      startTime: minutesToTimeValue(savedWindow.startMinutes),
      endTime: minutesToTimeValue(savedWindow.endMinutes),
    };
  });
}

function buildBlockedDatePayload(
  blockedDates: Array<{
    id: string;
    dateKey: string;
    label: string | null;
  }>,
): ConsultationBlockedDateRecord[] {
  return blockedDates.map((blockedDate) => ({
    id: blockedDate.id,
    dateKey: blockedDate.dateKey,
    label: blockedDate.label,
  }));
}

function serializeHostProfile(
  profile: {
    bookingSlug: string;
    timezone: string;
    defaultDurationMinutes: number;
    availabilityWindows: Array<{
      dayOfWeek: number;
      startMinutes: number;
      endMinutes: number;
    }>;
    blockedDates: Array<{
      id: string;
      dateKey: string;
      label: string | null;
    }>;
  },
  baseUrl?: string,
): ConsultationHostProfilePayload {
  const bookingPath = getBookingPath(profile.bookingSlug);

  return {
    bookingSlug: profile.bookingSlug,
    bookingPath,
    bookingUrl: buildAbsoluteUrl(bookingPath, baseUrl),
    timezone: profile.timezone,
    defaultDurationMinutes: profile.defaultDurationMinutes,
    availability: buildAvailabilityPayload(profile.availabilityWindows),
    blockedDates: buildBlockedDatePayload(profile.blockedDates),
  };
}

function defaultAvailabilityCreateData() {
  return DEFAULT_AVAILABILITY.filter((window) => window.enabled).map((window) => ({
    dayOfWeek: window.dayOfWeek,
    startMinutes: timeValueToMinutes(window.startTime),
    endMinutes: timeValueToMinutes(window.endTime),
  }));
}

export async function syncExpiredConsultations(filters?: {
  hostId?: string;
  hostProfileId?: string;
  meetingCode?: string;
  id?: string;
}): Promise<void> {
  await prisma.consultation.updateMany({
    where: {
      status: "PENDING",
      endsAt: {
        lte: new Date(),
      },
      ...(filters?.hostId ? { hostId: filters.hostId } : {}),
      ...(filters?.hostProfileId ? { hostProfileId: filters.hostProfileId } : {}),
      ...(filters?.meetingCode ? { meetingCode: filters.meetingCode } : {}),
      ...(filters?.id ? { id: filters.id } : {}),
    },
    data: {
      status: "EXPIRED",
    },
  });
}

export async function ensureConsultationHostProfile(userId: string) {
  const existingProfile = await prisma.consultationHostProfile.findUnique({
    where: {
      userId,
    },
    include: {
      availabilityWindows: {
        orderBy: {
          dayOfWeek: "asc",
        },
      },
      blockedDates: {
        orderBy: {
          dateKey: "asc",
        },
      },
    },
  });

  if (existingProfile) {
    return existingProfile;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.consultationHostProfile.create({
        data: {
          userId,
          bookingSlug: createRandomHex(16),
          timezone: DEFAULT_CONSULTATION_TIMEZONE,
          defaultDurationMinutes: DEFAULT_CONSULTATION_DURATION_MINUTES,
          availabilityWindows: {
            create: defaultAvailabilityCreateData(),
          },
        },
        include: {
          availabilityWindows: {
            orderBy: {
              dayOfWeek: "asc",
            },
          },
          blockedDates: {
            orderBy: {
              dateKey: "asc",
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to create a unique consultation booking profile.");
}

export async function getConsultationHostProfilePayload(
  userId: string,
  baseUrl?: string,
): Promise<ConsultationHostProfilePayload> {
  const profile = await ensureConsultationHostProfile(userId);
  return serializeHostProfile(profile, baseUrl);
}

export async function listConsultationsForHost(
  hostId: string,
  baseUrl?: string,
): Promise<ConsultationRecord[]> {
  await syncExpiredConsultations({ hostId });

  const consultations = await prisma.consultation.findMany({
    where: {
      hostId,
    },
    orderBy: [
      {
        scheduledAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return consultations.map((consultation) =>
    serializeConsultation(consultation, baseUrl),
  );
}

export async function updateConsultationAvailabilityForHost({
  userId,
  availability,
  blockedDates,
  baseUrl,
}: {
  userId: string;
  availability: ConsultationAvailabilityDay[];
  blockedDates: ConsultationBlockedDateRecord[];
  baseUrl?: string;
}): Promise<ConsultationHostProfilePayload> {
  const profile = await ensureConsultationHostProfile(userId);

  const normalizedAvailability = [...availability]
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .filter((window, index, all) => all.findIndex((item) => item.dayOfWeek === window.dayOfWeek) === index)
    .filter((window) => window.enabled)
    .map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startMinutes: timeValueToMinutes(window.startTime),
      endMinutes: timeValueToMinutes(window.endTime),
    }));

  const normalizedBlockedDates = [...blockedDates]
    .map((blockedDate) => ({
      dateKey: blockedDate.dateKey,
      label: blockedDate.label?.trim() || null,
    }))
    .filter(
      (blockedDate, index, all) =>
        all.findIndex((item) => item.dateKey === blockedDate.dateKey) === index,
    )
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));

  const updatedProfile = await prisma.$transaction(async (tx) => {
    await tx.consultationAvailabilityWindow.deleteMany({
      where: {
        hostProfileId: profile.id,
      },
    });

    if (normalizedAvailability.length > 0) {
      await tx.consultationAvailabilityWindow.createMany({
        data: normalizedAvailability.map((window) => ({
          hostProfileId: profile.id,
          dayOfWeek: window.dayOfWeek,
          startMinutes: window.startMinutes,
          endMinutes: window.endMinutes,
        })),
      });
    }

    await tx.consultationBlockedDate.deleteMany({
      where: {
        hostProfileId: profile.id,
      },
    });

    if (normalizedBlockedDates.length > 0) {
      await tx.consultationBlockedDate.createMany({
        data: normalizedBlockedDates.map((blockedDate) => ({
          hostProfileId: profile.id,
          dateKey: blockedDate.dateKey,
          label: blockedDate.label,
        })),
      });
    }

    return tx.consultationHostProfile.findUniqueOrThrow({
      where: {
        id: profile.id,
      },
      include: {
        availabilityWindows: {
          orderBy: {
            dayOfWeek: "asc",
          },
        },
        blockedDates: {
          orderBy: {
            dateKey: "asc",
          },
        },
      },
    });
  });

  return serializeHostProfile(updatedProfile, baseUrl);
}

async function createConsultationRecord({
  hostId,
  hostProfileId,
  attendeeName,
  attendeeEmail,
  attendeePhone,
  scheduledAt,
  durationMinutes,
  baseUrl,
}: {
  hostId: string;
  hostProfileId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  baseUrl?: string;
}): Promise<ConsultationRecord> {
  const endsAt = addMinutes(scheduledAt, durationMinutes);

  const overlappingConsultation = await prisma.consultation.findFirst({
    where: {
      hostId,
      status: {
        in: ["PENDING", "COMPLETED"],
      },
      scheduledAt: {
        lt: endsAt,
      },
      endsAt: {
        gt: scheduledAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingConsultation) {
    throw new Error("This host already has another consultation at that time.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const meetingCode = createRandomHex(12);
    const meetingPath = getMeetingPath(meetingCode);
    const meetingUrl = buildAbsoluteUrl(meetingPath, baseUrl);

    try {
      const consultation = await prisma.consultation.create({
        data: {
          hostId,
          hostProfileId,
          attendeeName: attendeeName.trim(),
          attendeeEmail: normalizeEmailAddress(attendeeEmail),
          attendeePhone: attendeePhone?.trim() || null,
          scheduledAt,
          endsAt,
          meetingCode,
          meetingPath,
          meetingUrl,
        },
      });

      return serializeConsultation(consultation, baseUrl);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to create a unique meeting room for this consultation.");
}

export async function createConsultationForHost({
  hostId,
  attendeeName,
  attendeeEmail,
  attendeePhone,
  scheduledAt,
  baseUrl,
}: {
  hostId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string | null;
  scheduledAt: Date;
  baseUrl?: string;
}): Promise<ConsultationRecord> {
  const profile = await ensureConsultationHostProfile(hostId);
  await syncExpiredConsultations({ hostId });

  return createConsultationRecord({
    hostId,
    hostProfileId: profile.id,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    scheduledAt,
    durationMinutes: profile.defaultDurationMinutes,
    baseUrl,
  });
}

export async function getPublicBookingPayload(
  bookingSlug: string,
): Promise<PublicBookingPayload | null> {
  const profile = await prisma.consultationHostProfile.findUnique({
    where: {
      bookingSlug,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      availabilityWindows: {
        orderBy: {
          dayOfWeek: "asc",
        },
      },
      blockedDates: {
        orderBy: {
          dateKey: "asc",
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  await syncExpiredConsultations({ hostProfileId: profile.id });

  const futureConsultations = await prisma.consultation.findMany({
    where: {
      hostProfileId: profile.id,
      endsAt: {
        gt: new Date(),
      },
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      scheduledAt: true,
      endsAt: true,
      status: true,
    },
  });

  const slotDays = generateAvailableSlotDays({
    availability: buildAvailabilityPayload(profile.availabilityWindows),
    blockedDateKeys: profile.blockedDates.map((blockedDate) => blockedDate.dateKey),
    consultations: futureConsultations,
    durationMinutes: profile.defaultDurationMinutes,
  });

  return {
    hostName: profile.user.name || profile.user.email || "Consultation Host",
    bookingSlug: profile.bookingSlug,
    timezone: profile.timezone,
    defaultDurationMinutes: profile.defaultDurationMinutes,
    slotDays,
  };
}

export async function createConsultationFromBooking({
  bookingSlug,
  attendeeName,
  attendeeEmail,
  attendeePhone,
  scheduledAt,
  baseUrl,
}: {
  bookingSlug: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string | null;
  scheduledAt: Date;
  baseUrl?: string;
}): Promise<ConsultationRecord | null> {
  const profile = await prisma.consultationHostProfile.findUnique({
    where: {
      bookingSlug,
    },
    include: {
      availabilityWindows: {
        orderBy: {
          dayOfWeek: "asc",
        },
      },
      blockedDates: {
        orderBy: {
          dateKey: "asc",
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  await syncExpiredConsultations({ hostProfileId: profile.id });

  const futureConsultations = await prisma.consultation.findMany({
    where: {
      hostProfileId: profile.id,
      endsAt: {
        gt: new Date(),
      },
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      scheduledAt: true,
      endsAt: true,
      status: true,
    },
  });

  const slotDays = generateAvailableSlotDays({
    availability: buildAvailabilityPayload(profile.availabilityWindows),
    blockedDateKeys: profile.blockedDates.map((blockedDate) => blockedDate.dateKey),
    consultations: futureConsultations,
    durationMinutes: profile.defaultDurationMinutes,
  });

  const requestedStartAt = scheduledAt.toISOString();
  const isAvailable = slotDays.some((slotDay) =>
    slotDay.slots.some((slot) => slot.startAt === requestedStartAt),
  );

  if (!isAvailable) {
    throw new Error("That time slot is no longer available.");
  }

  return createConsultationRecord({
    hostId: profile.userId,
    hostProfileId: profile.id,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    scheduledAt,
    durationMinutes: profile.defaultDurationMinutes,
    baseUrl,
  });
}

export async function getConsultationMeetingPayload(
  meetingCode: string,
  baseUrl?: string,
): Promise<ConsultationMeetingPayload | null> {
  await syncExpiredConsultations({ meetingCode });

  const consultation = await prisma.consultation.findUnique({
    where: {
      meetingCode,
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!consultation) {
    return null;
  }

  const serialized = serializeConsultation(consultation, baseUrl);

  return {
    id: serialized.id,
    hostId: consultation.host.id,
    attendeeName: serialized.attendeeName,
    attendeeEmail: serialized.attendeeEmail,
    attendeePhone: serialized.attendeePhone,
    scheduledAt: serialized.scheduledAt,
    endsAt: serialized.endsAt,
    status: serialized.status,
    meetingCode: serialized.meetingCode,
    meetingPath: serialized.meetingPath,
    meetingUrl: serialized.meetingUrl,
    hostName: consultation.host.name || consultation.host.email || "Host",
    hostEmail: consultation.host.email,
    meetingPeerLimit: getConsultationMeetingPeerLimit(),
  };
}

export async function getActiveConsultationMeetingParticipants(
  consultationId: string,
): Promise<
  Array<{
    clientId: string;
    role: ConsultationMeetingRole;
    lastSeenAt: string;
    displayName: string | null;
  }>
> {
  const ttlStart = new Date(Date.now() - CONSULTATION_MEETING_PRESENCE_TTL_MS);
  const historyStart = new Date(
    Date.now() - CONSULTATION_MEETING_PRESENCE_TTL_MS * 2,
  );

  const recentPresenceEvents = await prisma.consultationMeetingEvent.findMany({
    where: {
      consultationId,
      createdAt: {
        gte: historyStart,
      },
      eventType: {
        in: ["presence", "leave"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const latestByClient = new Map<
    string,
    {
      senderClientId: string;
      senderRole: ConsultationMeetingRole;
      eventType: string;
      payload: Prisma.JsonValue | null;
      createdAt: Date;
    }
  >();

  for (const event of recentPresenceEvents) {
    if (!latestByClient.has(event.senderClientId)) {
      latestByClient.set(event.senderClientId, event);
    }
  }

  return Array.from(latestByClient.values())
    .filter(
      (event) =>
        event.eventType !== "leave" && event.createdAt.getTime() >= ttlStart.getTime(),
    )
    .map((event) => ({
      clientId: event.senderClientId,
      role: event.senderRole,
      lastSeenAt: event.createdAt.toISOString(),
      displayName:
        event.payload &&
        typeof event.payload === "object" &&
        !Array.isArray(event.payload) &&
        typeof event.payload.displayName === "string"
          ? event.payload.displayName
          : null,
    }));
}

export async function getConsultationMeetingAccess(meetingCode: string) {
  await syncExpiredConsultations({ meetingCode });

  return prisma.consultation.findUnique({
    where: {
      meetingCode,
    },
    select: {
      id: true,
      hostId: true,
      status: true,
      scheduledAt: true,
      endsAt: true,
      meetingCode: true,
    },
  });
}

export async function listConsultationMeetingEvents({
  meetingCode,
  role,
  clientId,
  after,
}: {
  meetingCode: string;
  role: ConsultationMeetingRole;
  clientId: string;
  after?: string;
}): Promise<
  | {
      consultationStatus: PrismaConsultationStatus;
      events: ConsultationMeetingEventRecord[];
      cursor: string | null;
      activeParticipantCount: number;
      peerLimit: number;
    }
  | null
> {
  const consultation = await getConsultationMeetingAccess(meetingCode);

  if (!consultation) {
    return null;
  }

  const events = await prisma.consultationMeetingEvent.findMany({
    where: {
      consultationId: consultation.id,
      ...(after
        ? {
            createdAt: {
              gt: new Date(after),
            },
          }
        : {}),
      senderClientId: {
        not: clientId,
      },
      OR: [
        {
          targetRole: null,
          targetClientId: null,
        },
        {
          targetRole: role,
          targetClientId: null,
        },
        {
          targetRole: role,
          targetClientId: clientId,
        },
        {
          targetRole: null,
          targetClientId: clientId,
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    take: after ? 120 : 80,
  });

  const activeParticipants = await getActiveConsultationMeetingParticipants(
    consultation.id,
  );

  return {
    consultationStatus: consultation.status,
    events: events.map((event) => serializeMeetingEvent(event)),
    cursor: events.at(-1)?.createdAt.toISOString() ?? after ?? null,
    activeParticipantCount: activeParticipants.length,
    peerLimit: getConsultationMeetingPeerLimit(),
  };
}

export async function createConsultationMeetingEvent({
  meetingCode,
  senderRole,
  senderClientId,
  targetRole,
  targetClientId,
  eventType,
  payload,
}: {
  meetingCode: string;
  senderRole: ConsultationMeetingRole;
  senderClientId: string;
  targetRole?: ConsultationMeetingRole;
  targetClientId?: string;
  eventType: ConsultationMeetingEventType;
  payload?: unknown;
}): Promise<ConsultationMeetingEventRecord | null> {
  const consultation = await getConsultationMeetingAccess(meetingCode);

  if (!consultation) {
    return null;
  }

  if (consultation.status !== "PENDING") {
    throw new Error("This consultation room is no longer active.");
  }

  if (eventType === "presence") {
    const activeParticipants = await getActiveConsultationMeetingParticipants(
      consultation.id,
    );
    const alreadyActive = activeParticipants.some(
      (participant) => participant.clientId === senderClientId,
    );

    if (
      !alreadyActive &&
      activeParticipants.length >= getConsultationMeetingPeerLimit()
    ) {
      throw new Error("This consultation room has reached its participant limit.");
    }
  }

  const createdEvent = await prisma.consultationMeetingEvent.create({
    data: {
      consultationId: consultation.id,
      senderRole,
      senderClientId,
      targetRole: targetRole ?? null,
      targetClientId: targetClientId ?? null,
      eventType,
      ...(payload !== undefined
        ? {
            payload: payload as Prisma.InputJsonValue,
          }
        : {}),
    },
  });

  await prisma.consultationMeetingEvent.deleteMany({
    where: {
      consultationId: consultation.id,
      createdAt: {
        lt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
    },
  });

  return serializeMeetingEvent(createdEvent);
}

export async function updateConsultationStatusForHost({
  hostId,
  consultationId,
  status,
  baseUrl,
}: {
  hostId: string;
  consultationId: string;
  status: "COMPLETED" | "CANCELLED";
  baseUrl?: string;
}): Promise<ConsultationRecord | null> {
  await syncExpiredConsultations({ id: consultationId });

  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      hostId,
    },
  });

  if (!consultation) {
    return null;
  }

  const updatedConsultation = await prisma.consultation.update({
    where: {
      id: consultation.id,
    },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  return serializeConsultation(updatedConsultation, baseUrl);
}
