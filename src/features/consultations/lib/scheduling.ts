import type {
  ConsultationAvailabilityDay,
  ConsultationSlotDay,
  ConsultationStatus,
} from "@/features/consultations/lib/shared";

export interface ConsultationRangeLike {
  scheduledAt: string | Date;
  endsAt: string | Date;
  status: ConsultationStatus;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function combineDateAndTime(dateKey: string, timeValue: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function rangesOverlap(
  rangeStart: Date,
  rangeEnd: Date,
  otherStart: Date,
  otherEnd: Date,
): boolean {
  return rangeStart < otherEnd && rangeEnd > otherStart;
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function normalizeAvailabilityDays(
  availability: ConsultationAvailabilityDay[],
): ConsultationAvailabilityDay[] {
  return [...availability].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}

export function generateAvailableSlotDays({
  availability,
  blockedDateKeys,
  consultations,
  durationMinutes,
  daysAhead = 14,
  now = new Date(),
}: {
  availability: ConsultationAvailabilityDay[];
  blockedDateKeys: string[];
  consultations: ConsultationRangeLike[];
  durationMinutes: number;
  daysAhead?: number;
  now?: Date;
}): ConsultationSlotDay[] {
  const blockedDays = new Set(blockedDateKeys);
  const activeWindows = normalizeAvailabilityDays(availability).filter(
    (window) => window.enabled,
  );

  const busyRanges = consultations
    .filter(
      (consultation) =>
        consultation.status !== "CANCELLED" &&
        consultation.status !== "EXPIRED",
    )
    .map((consultation) => ({
      start: new Date(consultation.scheduledAt),
      end: new Date(consultation.endsAt),
    }));

  const slotDays: ConsultationSlotDay[] = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const current = new Date(now);
    current.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + offset);

    const dateKey = toDateKey(current);
    const window = activeWindows.find(
      (item) => item.dayOfWeek === current.getDay(),
    );

    if (!window || blockedDays.has(dateKey)) {
      continue;
    }

    const startTime = window.startTime;
    const endTime = window.endTime;
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const openingMinutes = startHour * 60 + startMinute;
    const closingMinutes = endHour * 60 + endMinute;

    const slots = [];

    for (
      let minuteMark = openingMinutes;
      minuteMark + durationMinutes <= closingMinutes;
      minuteMark += durationMinutes
    ) {
      const slotStart = new Date(current);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(minuteMark);

      const slotEnd = addMinutes(slotStart, durationMinutes);

      if (slotStart <= now) {
        continue;
      }

      const overlapsBusyRange = busyRanges.some((busyRange) =>
        rangesOverlap(slotStart, slotEnd, busyRange.start, busyRange.end),
      );

      if (overlapsBusyRange) {
        continue;
      }

      slots.push({
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        timeLabel: formatTimeLabel(slotStart),
      });
    }

    if (slots.length > 0) {
      slotDays.push({
        dateKey,
        dateLabel: current.toLocaleDateString([], {
          weekday: "long",
          month: "short",
          day: "numeric",
        }),
        slots,
      });
    }
  }

  return slotDays;
}
