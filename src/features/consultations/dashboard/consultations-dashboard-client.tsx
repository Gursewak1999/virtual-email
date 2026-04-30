"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  CheckCheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  UserRoundIcon,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const PAGE_SIZE = 8;

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

function matchesConsultationSearch(
  consultation: ConsultationRecord,
  searchTerm: string,
): boolean {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    consultation.attendeeName,
    consultation.attendeeEmail,
    consultation.attendeePhone || "",
    consultation.meetingCode,
    consultation.status,
    formatDateTimeLabel(consultation.scheduledAt),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
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
  const [consultationForm, setConsultationForm] = useState(
    emptyConsultationForm,
  );
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Loading consultations...",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [othersPage, setOthersPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [availabilitySheetOpen, setAvailabilitySheetOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] =
    useState<ConsultationRecord | null>(null);

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

  useEffect(() => {
    setUpcomingPage(1);
    setOthersPage(1);
  }, [searchTerm]);

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

  const filteredConsultations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return consultations.filter((consultation) =>
      matchesConsultationSearch(consultation, normalizedSearch),
    );
  }, [consultations, searchTerm]);

  const { upcomingConsultations, otherConsultations } = useMemo(() => {
    const now = Date.now();

    const upcoming = filteredConsultations.filter(
      (consultation) =>
        consultation.status === "PENDING" &&
        new Date(consultation.scheduledAt).getTime() >= now,
    );

    const others = filteredConsultations.filter(
      (consultation) => !upcoming.some((entry) => entry.id === consultation.id),
    );

    return {
      upcomingConsultations: upcoming,
      otherConsultations: others,
    };
  }, [filteredConsultations]);

  const upcomingPageCount = Math.max(
    1,
    Math.ceil(upcomingConsultations.length / PAGE_SIZE),
  );
  const othersPageCount = Math.max(
    1,
    Math.ceil(otherConsultations.length / PAGE_SIZE),
  );

  const upcomingVisible = useMemo(() => {
    const start = (upcomingPage - 1) * PAGE_SIZE;
    return upcomingConsultations.slice(start, start + PAGE_SIZE);
  }, [upcomingConsultations, upcomingPage]);

  const othersVisible = useMemo(() => {
    const start = (othersPage - 1) * PAGE_SIZE;
    return otherConsultations.slice(start, start + PAGE_SIZE);
  }, [otherConsultations, othersPage]);

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
      if (
        current.some((blockedDate) => blockedDate.dateKey === newBlockedDate)
      ) {
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
    setStatusMessage(
      "Blocked date added locally. Save availability to publish it.",
    );
    setErrorMessage(null);
  }

  function removeBlockedDate(dateKey: string): void {
    setBlockedDates((current) =>
      current.filter((blockedDate) => blockedDate.dateKey !== dateKey),
    );
    setStatusMessage(
      "Blocked date removed locally. Save availability to publish it.",
    );
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
      setCreateDialogOpen(false);
      setStatusMessage("Consultation created and meeting link generated.");
      await loadConsultations();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create consultation",
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
      setAvailabilitySheetOpen(false);
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

      if (selectedConsultation?.id === consultationId) {
        setSelectedConsultation(payload.consultation);
      }

      setStatusMessage(
        status === "COMPLETED"
          ? "Consultation marked as completed."
          : "Consultation cancelled.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update consultation",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700">
              <VideoIcon className="size-3.5" />
              Consultations
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Consultation Management
            </h1>
            <p className="max-w-2xl text-sm text-zinc-600">
              Default view shows upcoming consultations first with separate
              history, searchable results, and paginated records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <PlusIcon />
              Add Consultation
            </Button>
            <Button
              variant="outline"
              onClick={() => setAvailabilitySheetOpen(true)}
            >
              <Settings2Icon />
              Availability Settings
            </Button>
            {hostProfile?.bookingUrl ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyToClipboard(
                      hostProfile.bookingUrl || "",
                      "Booking link",
                    )
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
          <Card
            size="sm"
            className="rounded-none bg-sky-50/80 shadow-none ring-sky-100"
          >
            <CardHeader>
              <CardDescription>Pending</CardDescription>
              <CardTitle>{metrics.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            size="sm"
            className="rounded-none bg-emerald-50/80 shadow-none ring-emerald-100"
          >
            <CardHeader>
              <CardDescription>Completed</CardDescription>
              <CardTitle>{metrics.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            size="sm"
            className="rounded-none bg-amber-50/80 shadow-none ring-amber-100"
          >
            <CardHeader>
              <CardDescription>Expired / Cancelled</CardDescription>
              <CardTitle>{metrics.expired}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            size="sm"
            className="rounded-none bg-zinc-50 shadow-none ring-zinc-200"
          >
            <CardHeader>
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-sm">{statusMessage}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Card className="rounded-none shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="size-4 text-violet-600" />
                Consultation Records
              </CardTitle>
              <CardDescription>
                Click any consultation to view details. Upcoming consultations
                are separated for quick access.
              </CardDescription>
            </div>

            <div className="w-full max-w-sm">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                  placeholder="Search name, email, status, code..."
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <p className="border border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-600">
              Loading consultation records...
            </p>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Upcoming Consultations ({upcomingConsultations.length})
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Page {upcomingPage} of {upcomingPageCount}
                  </p>
                </div>

                {upcomingVisible.length === 0 ? (
                  <p className="border border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-600">
                    No upcoming consultations found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingVisible.map((consultation) => {
                      const actionKey = consultation.id;

                      return (
                        <article
                          key={consultation.id}
                          className="cursor-pointer border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
                          onClick={() => setSelectedConsultation(consultation)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-zinc-900">
                                  {consultation.attendeeName}
                                </h3>
                                <Badge
                                  variant={getStatusBadgeVariant(
                                    consultation.status,
                                  )}
                                >
                                  {formatConsultationStatus(
                                    consultation.status,
                                  )}
                                </Badge>
                              </div>
                              <p className="text-sm text-zinc-600">
                                {consultation.attendeeEmail}
                                {consultation.attendeePhone
                                  ? ` · ${consultation.attendeePhone}`
                                  : ""}
                              </p>
                              <p className="text-sm font-medium text-zinc-800">
                                {formatDateTimeLabel(consultation.scheduledAt)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void copyToClipboard(
                                    consultation.meetingUrl,
                                    "Meeting link",
                                  );
                                }}
                              >
                                <CopyIcon />
                                Copy Link
                              </Button>
                              <Button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleStatusUpdate(
                                    actionKey,
                                    "COMPLETED",
                                  );
                                }}
                                disabled={
                                  busyAction === `completed-${actionKey}`
                                }
                              >
                                <CheckCheckIcon />
                                Complete
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setUpcomingPage((current) => Math.max(1, current - 1))
                    }
                    disabled={upcomingPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setUpcomingPage((current) =>
                        Math.min(upcomingPageCount, current + 1),
                      )
                    }
                    disabled={upcomingPage >= upcomingPageCount}
                  >
                    Next
                  </Button>
                </div>
              </section>

              <section className="space-y-3 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    Other Consultations ({otherConsultations.length})
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Page {othersPage} of {othersPageCount}
                  </p>
                </div>

                {othersVisible.length === 0 ? (
                  <p className="border border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-600">
                    No other consultations found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {othersVisible.map((consultation) => {
                      const actionKey = consultation.id;

                      return (
                        <article
                          key={consultation.id}
                          className="cursor-pointer border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
                          onClick={() => setSelectedConsultation(consultation)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-zinc-900">
                                  {consultation.attendeeName}
                                </h3>
                                <Badge
                                  variant={getStatusBadgeVariant(
                                    consultation.status,
                                  )}
                                >
                                  {formatConsultationStatus(
                                    consultation.status,
                                  )}
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
                              <a
                                className={cn(
                                  buttonVariants({ variant: "outline" }),
                                )}
                                href={consultation.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ExternalLinkIcon />
                                Open Meeting
                              </a>
                              {consultation.status === "PENDING" ? (
                                <Button
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleStatusUpdate(
                                      actionKey,
                                      "CANCELLED",
                                    );
                                  }}
                                  disabled={
                                    busyAction === `cancelled-${actionKey}`
                                  }
                                >
                                  Cancel
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setOthersPage((current) => Math.max(1, current - 1))
                    }
                    disabled={othersPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setOthersPage((current) =>
                        Math.min(othersPageCount, current + 1),
                      )
                    }
                    disabled={othersPage >= othersPageCount}
                  >
                    Next
                  </Button>
                </div>
              </section>
            </>
          )}
        </CardContent>
      </Card>

      <Drawer open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-sky-600" />
              Add Consultation
            </DrawerTitle>
            <DrawerDescription>
              Create a consultation record and generate a private meeting room.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 p-4 pt-0">
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

              <Button
                type="submit"
                disabled={busyAction === "create-consultation"}
              >
                {busyAction === "create-consultation"
                  ? "Creating..."
                  : "Create Consultation"}
              </Button>
            </form>
          </div>
        </DrawerContent>
      </Drawer>

      <Sheet
        open={availabilitySheetOpen}
        onOpenChange={setAvailabilitySheetOpen}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Availability Settings</SheetTitle>
            <SheetDescription>
              Configure booking availability and blocked dates. Hidden by
              default and opened from the settings button.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 overflow-y-auto p-4">
            <div className="space-y-3">
              {availability.map((day) => {
                const dayLabel =
                  DAY_OPTIONS.find((item) => item.dayOfWeek === day.dayOfWeek)
                    ?.longLabel || `Day ${day.dayOfWeek}`;

                return (
                  <div
                    key={day.dayOfWeek}
                    className="border border-zinc-200 bg-white px-3 py-3"
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

            <div className="border border-zinc-200 bg-white p-4">
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
                <div className="min-w-55 flex-1 space-y-1.5">
                  <Label htmlFor="blocked-label">Reason</Label>
                  <Input
                    id="blocked-label"
                    value={newBlockedLabel}
                    onChange={(event) => setNewBlockedLabel(event.target.value)}
                    placeholder="Vacation, holiday, conference..."
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddBlockedDate}
                >
                  Add Blocked Date
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {blockedDates.length === 0 ? (
                  <p className="text-sm text-zinc-500">No blocked dates yet.</p>
                ) : (
                  blockedDates.map((blockedDate) => (
                    <div
                      key={blockedDate.dateKey}
                      className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700"
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
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(selectedConsultation)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConsultation(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedConsultation ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <UserRoundIcon className="size-4" />
                  Consultation Details
                </SheetTitle>
                <SheetDescription>
                  Detailed view for {selectedConsultation.attendeeName}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 p-4">
                <div className="border border-zinc-200 bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-900">
                    {selectedConsultation.attendeeName}
                  </p>
                  <p className="text-zinc-700">
                    {selectedConsultation.attendeeEmail}
                  </p>
                  <p className="text-zinc-600">
                    {selectedConsultation.attendeePhone || "No phone"}
                  </p>
                </div>

                <div className="space-y-1 text-sm text-zinc-700">
                  <p>
                    <strong>Status:</strong>{" "}
                    {formatConsultationStatus(selectedConsultation.status)}
                  </p>
                  <p>
                    <strong>Scheduled:</strong>{" "}
                    {formatDateTimeLabel(selectedConsultation.scheduledAt)}
                  </p>
                  <p>
                    <strong>Ends:</strong>{" "}
                    {formatDateTimeLabel(selectedConsultation.endsAt)}
                  </p>
                  <p>
                    <strong>Meeting code:</strong>{" "}
                    {selectedConsultation.meetingCode}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void copyToClipboard(
                        selectedConsultation.meetingUrl,
                        "Meeting link",
                      )
                    }
                  >
                    <CopyIcon />
                    Copy Link
                  </Button>
                  <a
                    className={cn(buttonVariants({ variant: "outline" }))}
                    href={selectedConsultation.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLinkIcon />
                    Open Meeting
                  </a>
                </div>

                {selectedConsultation.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        void handleStatusUpdate(
                          selectedConsultation.id,
                          "COMPLETED",
                        )
                      }
                      disabled={
                        busyAction === `completed-${selectedConsultation.id}`
                      }
                    >
                      <CheckCheckIcon />
                      Mark Complete
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void handleStatusUpdate(
                          selectedConsultation.id,
                          "CANCELLED",
                        )
                      }
                      disabled={
                        busyAction === `cancelled-${selectedConsultation.id}`
                      }
                    >
                      Cancel Consultation
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
