export const DEFAULT_CONSULTATION_TIMEZONE = "America/Toronto";
export const DEFAULT_CONSULTATION_DURATION_MINUTES = 30;
export const DEFAULT_CONSULTATION_MEETING_PEER_LIMIT = 4;
export const CONSULTATION_MEETING_PRESENCE_TTL_MS = 20_000;

export const DAY_OPTIONS = [
  { dayOfWeek: 0, shortLabel: "Sun", longLabel: "Sunday" },
  { dayOfWeek: 1, shortLabel: "Mon", longLabel: "Monday" },
  { dayOfWeek: 2, shortLabel: "Tue", longLabel: "Tuesday" },
  { dayOfWeek: 3, shortLabel: "Wed", longLabel: "Wednesday" },
  { dayOfWeek: 4, shortLabel: "Thu", longLabel: "Thursday" },
  { dayOfWeek: 5, shortLabel: "Fri", longLabel: "Friday" },
  { dayOfWeek: 6, shortLabel: "Sat", longLabel: "Saturday" },
] as const;

export type ConsultationStatus =
  | "PENDING"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type ConsultationMeetingRole = "HOST" | "GUEST";
export type ConsultationMeetingEventType =
  | "presence"
  | "request-offer"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "leave";

export interface ConsultationAvailabilityDay {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface ConsultationBlockedDateRecord {
  id?: string;
  dateKey: string;
  label?: string | null;
}

export interface ConsultationHostProfilePayload {
  bookingSlug: string;
  bookingPath: string;
  bookingUrl?: string;
  timezone: string;
  defaultDurationMinutes: number;
  availability: ConsultationAvailabilityDay[];
  blockedDates: ConsultationBlockedDateRecord[];
}

export interface ConsultationRecord {
  id: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  scheduledAt: string;
  endsAt: string;
  status: ConsultationStatus;
  completedAt: string | null;
  meetingCode: string;
  meetingPath: string;
  meetingUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationSlot {
  startAt: string;
  endAt: string;
  timeLabel: string;
}

export interface ConsultationSlotDay {
  dateKey: string;
  dateLabel: string;
  slots: ConsultationSlot[];
}

export interface PublicBookingPayload {
  hostName: string;
  bookingSlug: string;
  timezone: string;
  defaultDurationMinutes: number;
  slotDays: ConsultationSlotDay[];
}

export interface ConsultationMeetingPayload {
  id: string;
  hostId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  scheduledAt: string;
  endsAt: string;
  status: ConsultationStatus;
  meetingCode: string;
  meetingPath: string;
  meetingUrl: string;
  hostName: string;
  hostEmail: string | null;
  meetingPeerLimit: number;
}

export interface ConsultationMeetingEventRecord {
  id: string;
  senderRole: ConsultationMeetingRole;
  senderClientId: string;
  targetRole: ConsultationMeetingRole | null;
  targetClientId: string | null;
  eventType: ConsultationMeetingEventType;
  payload: unknown;
  createdAt: string;
}

export const DEFAULT_AVAILABILITY = DAY_OPTIONS.map((day) => ({
  dayOfWeek: day.dayOfWeek,
  enabled: day.dayOfWeek >= 1 && day.dayOfWeek <= 5,
  startTime: "09:00",
  endTime: "17:00",
})) satisfies ConsultationAvailabilityDay[];

export function formatConsultationStatus(status: ConsultationStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "COMPLETED":
      return "Completed";
    case "EXPIRED":
      return "Expired";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function getMeetingPath(meetingCode: string): string {
  return `/consultations/meeting/${meetingCode}`;
}

export function getBookingPath(bookingSlug: string): string {
  return `/book/${bookingSlug}`;
}

export function minutesToTimeValue(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function timeValueToMinutes(value: string): number {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return hours * 60 + minutes;
}

export function formatDateTimeLabel(value: string): string {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
