"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  CalendarRangeIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  formatDateTimeLabel,
  type ConsultationRecord,
  type PublicBookingPayload,
} from "@/features/consultations/lib/shared";

interface PublicBookingClientProps {
  initialBooking: PublicBookingPayload;
}

export function PublicBookingClient({
  initialBooking,
}: PublicBookingClientProps) {
  const [slotDays, setSlotDays] = useState(initialBooking.slotDays);
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState<string | null>(
    initialBooking.slotDays[0]?.slots[0]?.startAt ?? null,
  );
  const [form, setForm] = useState({
    attendeeName: "",
    attendeeEmail: "",
    attendeePhone: "",
  });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Choose a time slot and add your details to book instantly.",
  );
  const [confirmation, setConfirmation] = useState<ConsultationRecord | null>(
    null,
  );

  const selectedSlot = useMemo(() => {
    for (const slotDay of slotDays) {
      for (const slot of slotDay.slots) {
        if (slot.startAt === selectedSlotStartAt) {
          return {
            ...slot,
            dateLabel: slotDay.dateLabel,
          };
        }
      }
    }

    return null;
  }, [selectedSlotStartAt, slotDays]);

  async function handleBookingSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedSlot) {
      setErrorMessage("Pick a time slot before booking.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/book/${initialBooking.bookingSlug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          scheduledAt: selectedSlot.startAt,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        consultation?: ConsultationRecord;
      };

      if (!response.ok || !payload.ok || !payload.consultation) {
        throw new Error(payload.error || "Unable to book this consultation");
      }

      setConfirmation(payload.consultation);
      setStatusMessage("Consultation booked. Your meeting link is ready.");
      setSlotDays((current) =>
        current
          .map((slotDay) => ({
            ...slotDay,
            slots: slotDay.slots.filter(
              (slot) => slot.startAt !== payload.consultation?.scheduledAt,
            ),
          }))
          .filter((slotDay) => slotDay.slots.length > 0),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to book this consultation",
      );
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#f8fbff_0%,_#eef6ff_100%)] px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden border-emerald-200 bg-white/90 shadow-xl shadow-emerald-100/50">
            <CardHeader className="border-b border-emerald-100 bg-emerald-50/70">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2Icon className="size-3.5" />
                Booking Confirmed
              </div>
              <CardTitle className="text-2xl">
                You&apos;re booked for {formatDateTimeLabel(confirmation.scheduledAt)}
              </CardTitle>
              <CardDescription className="max-w-2xl">
                Your consultation room is ready. Save the meeting link below and
                join from any modern browser when it&apos;s time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Meeting Link
                  </p>
                  <p className="mt-2 break-all text-sm text-zinc-700">
                    {confirmation.meetingUrl}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Guest Details
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    {confirmation.attendeeName}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {confirmation.attendeeEmail}
                    {confirmation.attendeePhone
                      ? ` · ${confirmation.attendeePhone}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={confirmation.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "default" }))}
                >
                  <VideoIcon />
                  Join Meeting Room
                </a>
                <a
                  href={confirmation.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <ExternalLinkIcon />
                  Open Link in New Tab
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#fcfeff_0%,_#f3f7fb_100%)] px-4 py-8 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-sky-100/50 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              <SparklesIcon className="size-3.5" />
              Public Booking
            </div>
            <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight text-zinc-950">
              Book a private consultation in a few clicks.
            </h1>
            <p className="mt-4 max-w-xl text-base text-zinc-600">
              Pick the time that works best, share your contact details, and
              receive an instant meeting link for your appointment.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4">
                <CalendarRangeIcon className="size-4 text-sky-600" />
                <p className="mt-3 text-sm font-medium text-zinc-900">
                  Flexible booking
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Live availability pulled directly from the host schedule.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4">
                <Clock3Icon className="size-4 text-emerald-600" />
                <p className="mt-3 text-sm font-medium text-zinc-900">
                  {initialBooking.defaultDurationMinutes}-minute sessions
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  All time slots are shown in {initialBooking.timezone}.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4">
                <VideoIcon className="size-4 text-violet-600" />
                <p className="mt-3 text-sm font-medium text-zinc-900">
                  Meeting link included
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Your private room is created automatically after booking.
                </p>
              </div>
            </div>
          </div>

          <Card className="border-zinc-200 bg-white/88 shadow-xl shadow-zinc-200/40">
            <CardHeader>
              <CardTitle>Reserve Your Slot</CardTitle>
              <CardDescription>{statusMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              {errorMessage ? (
                <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleBookingSubmit}>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Selected Slot
                  </p>
                  <p className="mt-2 text-base font-medium text-zinc-900">
                    {selectedSlot
                      ? formatDateTimeLabel(selectedSlot.startAt)
                      : "Choose a slot below"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="booking-name">Full Name</Label>
                  <Input
                    id="booking-name"
                    value={form.attendeeName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        attendeeName: event.target.value,
                      }))
                    }
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="booking-email">Email</Label>
                  <Input
                    id="booking-email"
                    type="email"
                    value={form.attendeeEmail}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        attendeeEmail: event.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="booking-phone">Phone</Label>
                  <Input
                    id="booking-phone"
                    value={form.attendeePhone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        attendeePhone: event.target.value,
                      }))
                    }
                    placeholder="+1 647 555 0199"
                  />
                </div>

                <Button type="submit" disabled={busy || !selectedSlot}>
                  {busy ? "Booking..." : "Book Consultation"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <Card className="border-zinc-200 bg-white/90 shadow-xl shadow-zinc-200/40">
          <CardHeader>
            <CardTitle>Available Time Slots</CardTitle>
            <CardDescription>
              Choose a day and time below. Booked or blocked times are hidden
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slotDays.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
                No booking slots are available right now. Please check back soon.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {slotDays.map((slotDay) => (
                  <div
                    key={slotDay.dateKey}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4"
                  >
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-zinc-900">
                        {slotDay.dateLabel}
                      </p>
                      <p className="text-xs text-zinc-500">{slotDay.dateKey}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {slotDay.slots.map((slot) => {
                        const selected = slot.startAt === selectedSlotStartAt;

                        return (
                          <button
                            key={slot.startAt}
                            type="button"
                            onClick={() => setSelectedSlotStartAt(slot.startAt)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition-colors",
                              selected
                                ? "border-sky-600 bg-sky-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:border-sky-300 hover:text-sky-700",
                            )}
                          >
                            {slot.timeLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
