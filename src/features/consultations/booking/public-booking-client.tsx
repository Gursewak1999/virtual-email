"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  UserRoundIcon,
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
import { Calendar } from "@/components/ui/calendar";
import { DurationPicker } from "@/components/ui/duration-picker";
import {
  formatDateTimeLabel,
  type ConsultationRecord,
  type PublicBookingPayload,
} from "@/features/consultations/lib/shared";

interface PublicBookingClientProps {
  initialBooking: PublicBookingPayload;
}

function dateKeyToDate(dateKey: string): Date {
  // Noon avoids edge shifts when the browser timezone differs from UTC.
  return new Date(`${dateKey}T12:00:00`);
}

function dateToKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PublicBookingClient({
  initialBooking,
}: PublicBookingClientProps) {
  const [slotDays, setSlotDays] = useState(initialBooking.slotDays);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    initialBooking.slotDays[0]?.dateKey ?? null,
  );
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState<string | null>(
    initialBooking.slotDays[0]?.slots[0]?.startAt ?? null,
  );
  const [duration, setDuration] = useState<number>(
    initialBooking.defaultDurationMinutes || 30,
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

  const availableDateKeys = useMemo(
    () =>
      new Set(
        slotDays
          .filter((slotDay) => slotDay.slots.length > 0)
          .map((slotDay) => slotDay.dateKey),
      ),
    [slotDays],
  );

  const firstAvailableSlotStartAt = useMemo(
    () => slotDays[0]?.slots[0]?.startAt ?? null,
    [slotDays],
  );

  const firstAvailableDate = useMemo(
    () =>
      slotDays[0]?.dateKey ? dateKeyToDate(slotDays[0].dateKey) : undefined,
    [slotDays],
  );

  const selectedDate = useMemo(
    () => (selectedDateKey ? dateKeyToDate(selectedDateKey) : undefined),
    [selectedDateKey],
  );

  const todayStart = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  const calendarEndMonth = useMemo(() => {
    const minimum = new Date(todayStart);
    minimum.setMonth(minimum.getMonth() + 3);

    const latestAvailable = slotDays
      .map((slotDay) => dateKeyToDate(slotDay.dateKey))
      .sort((left, right) => right.getTime() - left.getTime())[0];

    return latestAvailable && latestAvailable > minimum
      ? latestAvailable
      : minimum;
  }, [slotDays, todayStart]);

  // Find slots for selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    const slotDay = slotDays.find((d) => d.dateKey === selectedDateKey);
    if (!slotDay) return [];
    return slotDay.slots;
  }, [selectedDateKey, slotDays, duration]);

  useEffect(() => {
    if (!slotDays.length) {
      setSelectedDateKey(null);
      setSelectedSlotStartAt(null);
      return;
    }

    if (!selectedDateKey && slotDays[0]?.dateKey) {
      setSelectedDateKey(slotDays[0].dateKey);
      setSelectedSlotStartAt(firstAvailableSlotStartAt);
      return;
    }

    if (!selectedDateKey) {
      return;
    }

    const currentDay = slotDays.find((day) => day.dateKey === selectedDateKey);

    if (!currentDay || currentDay.slots.length === 0) {
      setSelectedDateKey(slotDays[0]?.dateKey ?? null);
      setSelectedSlotStartAt(firstAvailableSlotStartAt);
      return;
    }

    if (
      !currentDay.slots.some((slot) => slot.startAt === selectedSlotStartAt)
    ) {
      setSelectedSlotStartAt(currentDay.slots[0]?.startAt ?? null);
    }
  }, [
    firstAvailableSlotStartAt,
    selectedDateKey,
    selectedSlotStartAt,
    slotDays,
  ]);

  function handleDateSelect(date: Date | undefined): void {
    if (!date) {
      return;
    }

    const dateKey = dateToKey(date);
    setSelectedDateKey(dateKey);

    const day = slotDays.find((slotDay) => slotDay.dateKey === dateKey);
    if (!day || day.slots.length === 0) {
      setSelectedSlotStartAt(null);
      return;
    }

    setSelectedSlotStartAt(day.slots[0]?.startAt ?? null);
  }

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
          durationMinutes: duration,
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
        error instanceof Error
          ? error.message
          : "Unable to book this consultation",
      );
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden border-emerald-200 bg-white/90 shadow-xl shadow-emerald-100/50">
            <CardHeader className="border-b border-emerald-100 bg-emerald-50/70">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2Icon className="size-3.5" />
                Booking Confirmed
              </div>
              <CardTitle className="text-2xl">
                You&apos;re booked for{" "}
                {formatDateTimeLabel(confirmation.scheduledAt)}
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#fcfeff_0%,#f3f7fb_100%)] px-4 py-8 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-zinc-200 bg-white/88 shadow-xl shadow-zinc-200/40">
            <CardHeader>
              <CardTitle>Reserve Your Slot</CardTitle>
              <CardDescription>
                Choose your duration and date. Calendar availability is loaded
                for at least 3 months.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMessage ? (
                <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-900">
                <div className="flex items-center gap-2 font-semibold text-sky-800">
                  <UserRoundIcon className="size-4" />
                  Host Details
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  <span>Host: {initialBooking.hostName}</span>
                  <span>Timezone: {initialBooking.timezone}</span>
                  <span>
                    Default duration: {initialBooking.defaultDurationMinutes}{" "}
                    min
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 mb-1">
                    Pick a Date
                  </p>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    className="w-full [&_.rdp-month]:w-full"
                    fromDate={new Date()}
                    startMonth={todayStart}
                    endMonth={calendarEndMonth}
                    modifiers={{
                      unavailable: (date) => {
                        const dayStart = new Date(date);
                        dayStart.setHours(0, 0, 0, 0);
                        if (dayStart < todayStart) {
                          return false;
                        }
                        return !availableDateKeys.has(dateToKey(date));
                      },
                    }}
                    modifiersClassNames={{
                      unavailable:
                        "text-zinc-500 opacity-75 [&_button]:line-through [&_button]:decoration-2 [&_button]:decoration-rose-500",
                    }}
                    disabled={(date) => {
                      const dayStart = new Date(date);
                      dayStart.setHours(0, 0, 0, 0);

                      if (dayStart < todayStart) {
                        return true;
                      }

                      return !availableDateKeys.has(dateToKey(date));
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/88 shadow-xl shadow-zinc-200/40">
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>{statusMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleBookingSubmit}>
                <div className="hidden" aria-hidden="true">
                  <DurationPicker
                    value={duration}
                    onChange={setDuration}
                    options={[30, 45, 60]}
                  />
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 mb-2">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 mb-1">
                    Available Times
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {slotsForSelectedDate.length === 0 ? (
                      <span className="text-zinc-400 italic">
                        No slots for this date/duration.
                      </span>
                    ) : (
                      slotsForSelectedDate.map((slot) => {
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
                      })
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Selected Slot
                  </p>
                  <p className="mt-2 text-base font-medium text-zinc-900">
                    {selectedSlot
                      ? formatDateTimeLabel(selectedSlot.startAt)
                      : "Choose a date and time"}
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
      </div>
    </main>
  );
}
