import { z } from "zod";

export const consultationDateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format");

export const consultationTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use the HH:MM time format");

export const consultationContactSchema = z.object({
  attendeeName: z.string().trim().min(2).max(120),
  attendeeEmail: z.string().trim().email(),
  attendeePhone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const createConsultationSchema = consultationContactSchema.extend({
  scheduledDate: consultationDateKeySchema,
  scheduledTime: consultationTimeSchema,
});

export const updateConsultationStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
});

export const consultationAvailabilitySchema = z.object({
  availability: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        enabled: z.boolean(),
        startTime: consultationTimeSchema,
        endTime: consultationTimeSchema,
      }),
    )
    .length(7),
  blockedDates: z.array(
    z.object({
      dateKey: consultationDateKeySchema,
      label: z.string().trim().max(120).optional().or(z.literal("")),
    }),
  ),
});

export const createPublicBookingSchema = consultationContactSchema.extend({
  scheduledAt: z.string().datetime(),
});

export const consultationMeetingRoleSchema = z.enum(["HOST", "GUEST"]);
export const consultationMeetingEventTypeSchema = z.enum([
  "presence",
  "request-offer",
  "offer",
  "answer",
  "ice-candidate",
  "screen-share-started",
  "screen-share-stopped",
  "leave",
]);

export const consultationMeetingEventsQuerySchema = z.object({
  role: consultationMeetingRoleSchema,
  clientId: z.string().trim().min(8).max(120),
  after: z.string().datetime().optional(),
});

export const consultationMeetingEventSchema = z.object({
  role: consultationMeetingRoleSchema,
  clientId: z.string().trim().min(8).max(120),
  targetRole: consultationMeetingRoleSchema.optional(),
  targetClientId: z.string().trim().min(8).max(120).optional(),
  eventType: consultationMeetingEventTypeSchema,
  payload: z.unknown().optional(),
});
