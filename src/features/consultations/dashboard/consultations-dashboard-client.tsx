"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  CheckCheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  TimerResetIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  DAY_OPTIONS,
  DEFAULT_AVAILABILITY,
  formatConsultationStatus,
  formatDateTimeLabel,
  type ConsultationAvailabilityDay,
  type ConsultationBlockedDateRecord,
  type ConsultationHostProfilePayload,
  type ConsultationRecord,
  type ConsultationStatus,
} from "@/features/consultations/lib/shared";
import { cn } from "@/lib/utils";

interface ConsultationsResponse {
  ok: boolean;
  error?: string;
  hostProfile?: ConsultationHostProfilePayload;
  consultations?: ConsultationRecord[];
}

interface AvailabilityResponse {
  ok: boolean;
  error?: string;
  hostProfile?: ConsultationHostProfilePayload;
}

const emptyConsultationForm = {
  attendeeName: "",
  attendeeEmail: "",
  attendeePhone: "",
  scheduledDate: "",
  scheduledTime: "",
};

function getStatusBadgeVariant(status: ConsultationStatus) {
  switch (status) {
    case "PENDING":
      return "default" as const;
    case "COMPLETED":
      return "secondary" as const;
    case "EXPIRED":
    case "CANCELLED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

export function ConsultationsDashboardClient() {
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [hostProfile, setHostProfile] =
    useState<ConsultationHostProfilePayload | null>(null);
  const [availability, setAvailability] =
    useState<ConsultationAvailabilityDay[]>(DEFAULT_AVAILABILITY);
  const [blockedDates, setBlockedDates] = useState<
    ConsultationBlockedDateRecord[]
  >([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedLabel, setNewBlockedLabel] = useState("");
  const [consultationForm, setConsultationForm] = useState(emptyConsultationForm);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading consultations...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadConsultations(): Promise<void> {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/consultations", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ConsultationsResponse;

      if (!response.ok || !payload.ok || !payload.hostProfile) {
        throw new Error(payload.error || "Failed to load consultations");
      }

      setConsultations(payload.consultations || []);
      setHostProfile(payload.hostProfile);
      setAvailability(payload.hostProfile.availability);
      setBlockedDates(payload.hostProfile.blockedDates);
      setStatusMessage(
        `Loaded ${payload.consultations?.length || 0} consultation record(s).`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load consultations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConsultations();
  }, []);

  const metrics = useMemo(() => {
    const pending = consultations.filter(
      (consultation) => consultation.status === "PENDING",
    ).length;
    const completed = consultations.filter(
      (consultation) => consultation.status === "COMPLETED",
    ).length;
    const expired = consultations.filter(
      (consultation) =>
        consultation.status === "EXPIRED" ||
        consultation.status === "CANCELLED",
    ).length;

    return {
      pending,
      completed,
      expired,
    };
  }, [consultations]);

  async function copyToClipboard(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage(`${label} copied to clipboard.`);
      setErrorMessage(null);
    } catch {
      setErrorMessage(`Unable to copy ${label.toLowerCase()} right now.`);
    }
  }

  function updateAvailabilityDay(
    dayOfWeek: number,
    patch: Partial<ConsultationAvailabilityDay>,
  ): void {
    setAvailability((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              ...patch,
            }
          : day,
      ),
    );
  }

  function handleAddBlockedDate(): void {
    if (!newBlockedDate) {
      setErrorMessage("Choose a future date to block first.");
      return;
    }

    setBlockedDates((current) => {
      if (current.some((blockedDate) => blockedDate.dateKey === newBlockedDate)) {
        return current;
      }

      return [
        ...current,
        {
          dateKey: newBlockedDate,
          label: newBlockedLabel.trim() || null,
        },
      ].sort((left, right) => left.dateKey.localeCompare(right.dateKey));
    });
    setNewBlockedDate("");
    setNewBlockedLabel("");
    setStatusMessage("Blocked date added locally. Save availability to publish it.");
    setErrorMessage(null);
  }

  function removeBlockedDate(dateKey: string): void {
    setBlockedDates((current) =>
      current.filter((blockedDate) => blockedDate.dateKey !== dateKey),
    );
    setStatusMessage("Blocked date removed locally. Save availability to publish it.");
    setErrorMessage(null);
  }

  async function handleCreateConsultation(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setBusyAction("create-consultation");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(consultationForm),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        consultation?: ConsultationRecord;
      };

      if (!response.ok || !payload.ok || !payload.consultation) {
        throw new Error(payload.error || "Failed to create consultation");
      }

      setConsultationForm(emptyConsultationForm);
      setStatusMessage("Consultation created and meeting link generated.");
      await loadConsultations();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create consultation",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveAvailability(): Promise<void> {
    setBusyAction("save-availability");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/consultations/availability", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          availability,
          blockedDates,
        }),
      });
      const payload = (await response.json()) as AvailabilityResponse;

      if (!response.ok || !payload.ok || !payload.hostProfile) {
        throw new Error(payload.error || "Failed to save availability");
      }

      setHostProfile(payload.hostProfile);
      setAvailability(payload.hostProfile.availability);
      setBlockedDates(payload.hostProfile.blockedDates);
      setStatusMessage("Availability saved for the public booking page.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save availability",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStatusUpdate(
    consultationId: string,
    status: "COMPLETED" | "CANCELLED",
  ): Promise<void> {
    setBusyAction(`${status.toLowerCase()}-${consultationId}`);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/consultations/${consultationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        consultation?: ConsultationRecord;
      };

      if (!response.ok || !payload.ok || !payload.consultation) {
        throw new Error(payload.error || "Failed to update consultation");
      }

      setConsultations((current) =>
        current.map((consultation) =>
          consultation.id === consultationId
            ? payload.consultation || consultation
            : consultation,
        ),
      );
      setStatusMessage(
        status === "COMPLETED"
          ? "Consultation marked as completed."
          : "Consultation cancelled.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update consultation",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white/85 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              <VideoIcon className="size-3.5" />
              Consultations
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Meetings, availability, and public booking
            </h1>
            <p className="max-w-2xl text-sm text-zinc-600">
              Create consultation records, generate meeting links instantly, and
              manage the public booking page your guests can use on their own.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hostProfile?.bookingUrl ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyToClipboard(hostProfile.bookingUrl || "", "Booking link")
                  }
                >
                  <CopyIcon />
                  Copy Booking Link
                </Button>
                <a
                  className={cn(buttonVariants({ variant: "outline" }))}
                  href={hostProfile.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLinkIcon />
                  Open Booking Page
                </a>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Card size="sm" className="bg-sky-50/80 ring-sky-100">
            <CardHeader>
              <CardDescription>Pending</CardDescription>
              <CardTitle>{metrics.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="bg-emerald-50/80 ring-emerald-100">
            <CardHeader>
              <CardDescription>Completed</CardDescription>
              <CardTitle>{metrics.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="bg-amber-50/80 ring-amber-100">
            <CardHeader>
              <CardDescription>Expired / Cancelled</CardDescription>
              <CardTitle>{metrics.expired}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="bg-zinc-50 ring-zinc-200">
            <CardHeader>
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-sm">{statusMessage}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-sky-600" />
              Create Consultation
            </CardTitle>
            <CardDescription>
              Add a consultation manually and generate a private meeting room in
              the same step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateConsultation}>
              <div className="space-y-1.5">
                <Label htmlFor="consultation-name">Guest Name</Label>
                <Input
                  id="consultation-name"
                  value={consultationForm.attendeeName}
                  onChange={(event) =>
                    setConsultationForm((current) => ({
                      ...current,
                      attendeeName: event.target.value,
                    }))
                  }
                  placeholder="Aarav Singh"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="consultation-email">Email</Label>
                  <Input
                    id="consultation-email"
                    type="email"
                    value={consultationForm.attendeeEmail}
                    onChange={(event) =>
                      setConsultationForm((current) => ({
                        ...current,
                        attendeeEmail: event.target.value,
                      }))
                    }
                    placeholder="guest@example.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="consultation-phone">Phone</Label>
                  <Input
                    id="consultation-phone"
                    value={consultationForm.attendeePhone}
                    onChange={(event) =>
                      setConsultationForm((current) => ({
                        ...current,
                        attendeePhone: event.target.value,
                      }))
                    }
                    placeholder="+1 647 555 0104"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="consultation-date">Date</Label>
                  <Input
                    id="consultation-date"
                    type="date"
                    value={consultationForm.scheduledDate}
                    onChange={(event) =>
                      setConsultationForm((current) => ({
                        ...current,
                        scheduledDate: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="consultation-time">Time</Label>
                  <Input
                    id="consultation-time"
                    type="time"
                    value={consultationForm.scheduledTime}
                    onChange={(event) =>
                      setConsultationForm((current) => ({
                        ...current,
                        scheduledTime: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                Each consultation starts as <strong>Pending</strong>, gets a
                meeting link immediately, and moves to <strong>Expired</strong>{" "}
                automatically after its scheduled window ends unless you mark it
                completed first.
              </div>

              <Button
                type="submit"
                disabled={busyAction === "create-consultation"}
              >
                {busyAction === "create-consultation"
                  ? "Creating..."
                  : "Create Consultation"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TimerResetIcon className="size-4 text-emerald-600" />
              Availability and Blackout Dates
            </CardTitle>
            <CardDescription>
              These settings control which slots appear on your public booking
              page. Manual consultations can still be added outside them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {availability.map((day) => {
                const dayLabel =
                  DAY_OPTIONS.find((item) => item.dayOfWeek === day.dayOfWeek)
                    ?.longLabel || `Day ${day.dayOfWeek}`;

                return (
                  <div
                    key={day.dayOfWeek}
                    className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(event) =>
                            updateAvailabilityDay(day.dayOfWeek, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                        {dayLabel}
                      </label>

                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={day.startTime}
                          disabled={!day.enabled}
                          onChange={(event) =>
                            updateAvailabilityDay(day.dayOfWeek, {
                              startTime: event.target.value,
                            })
                          }
                          className="w-32"
                        />
                        <span className="text-sm text-zinc-500">to</span>
                        <Input
                          type="time"
                          value={day.endTime}
                          disabled={!day.enabled}
                          onChange={(event) =>
                            updateAvailabilityDay(day.dayOfWeek, {
                              endTime: event.target.value,
                            })
                          }
                          className="w-32"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="blocked-date">Blocked Date</Label>
                  <Input
                    id="blocked-date"
                    type="date"
                    value={newBlockedDate}
                    onChange={(event) => setNewBlockedDate(event.target.value)}
                  />
                </div>
                <div className="min-w-[220px] flex-1 space-y-1.5">
                  <Label htmlFor="blocked-label">Reason</Label>
                  <Input
                    id="blocked-label"
                    value={newBlockedLabel}
                    onChange={(event) => setNewBlockedLabel(event.target.value)}
                    placeholder="Vacation, holiday, conference..."
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddBlockedDate}>
                  Add Blocked Date
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {blockedDates.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No blocked dates yet.
                  </p>
                ) : (
                  blockedDates.map((blockedDate) => (
                    <div
                      key={blockedDate.dateKey}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700"
                    >
                      <span>
                        {blockedDate.dateKey}
                        {blockedDate.label ? ` · ${blockedDate.label}` : ""}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${blockedDate.dateKey}`}
                        onClick={() => removeBlockedDate(blockedDate.dateKey)}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void handleSaveAvailability()}
              disabled={busyAction === "save-availability"}
            >
              {busyAction === "save-availability"
                ? "Saving..."
                : "Save Availability"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="size-4 text-violet-600" />
                Consultation Records
              </CardTitle>
              <CardDescription>
                Manage current consultations, mark them complete, and jump into
                meeting rooms.
              </CardDescription>
            </div>

            {hostProfile?.bookingUrl ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Public booking page:{" "}
                <a
                  className="font-medium text-sky-700 underline"
                  href={hostProfile.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {hostProfile.bookingPath}
                </a>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
              Loading consultation records...
            </p>
          ) : consultations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
              No consultations yet. Create one above or share your booking page
              to start receiving meetings.
            </p>
          ) : (
            <div className="space-y-3">
              {consultations.map((consultation) => {
                const actionKey = consultation.id;

                return (
                  <article
                    key={consultation.id}
                    className="rounded-2xl border border-zinc-200 bg-white/85 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-zinc-900">
                            {consultation.attendeeName}
                          </h3>
                          <Badge
                            variant={getStatusBadgeVariant(consultation.status)}
                          >
                            {formatConsultationStatus(consultation.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-600">
                          {consultation.attendeeEmail}
                          {consultation.attendeePhone
                            ? ` · ${consultation.attendeePhone}`
                            : ""}
                        </p>
                        <p className="text-sm text-zinc-700">
                          {formatDateTimeLabel(consultation.scheduledAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            void copyToClipboard(
                              consultation.meetingUrl,
                              "Meeting link",
                            )
                          }
                        >
                          <CopyIcon />
                          Copy Meeting Link
                        </Button>
                        <a
                          className={cn(buttonVariants({ variant: "outline" }))}
                          href={consultation.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLinkIcon />
                          Open Meeting
                        </a>
                        {consultation.status === "PENDING" ? (
                          <>
                            <Button
                              onClick={() =>
                                void handleStatusUpdate(actionKey, "COMPLETED")
                              }
                              disabled={busyAction === `completed-${actionKey}`}
                            >
                              <CheckCheckIcon />
                              Complete
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                void handleStatusUpdate(actionKey, "CANCELLED")
                              }
                              disabled={busyAction === `cancelled-${actionKey}`}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
