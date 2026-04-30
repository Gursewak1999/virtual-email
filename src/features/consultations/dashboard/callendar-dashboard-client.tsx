"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatConsultationStatus,
  formatDateTimeLabel,
  type ConsultationHostProfilePayload,
  type ConsultationRecord,
} from "@/features/consultations/lib/shared";
import { cn } from "@/lib/utils";

interface ConsultationsResponse {
  ok: boolean;
  error?: string;
  hostProfile?: ConsultationHostProfilePayload;
  consultations?: ConsultationRecord[];
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toDateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CallendarDashboardClient() {
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [viewedYear, setViewedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadConsultations() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/consultations", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ConsultationsResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load consultations");
        }

        setConsultations(payload.consultations || []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load consultations",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadConsultations();
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ConsultationRecord[]>();

    for (const consultation of consultations) {
      const key = toDateKey(consultation.scheduledAt);
      const current = map.get(key) || [];
      current.push(consultation);
      map.set(key, current);
    }

    return map;
  }, [consultations]);

  const upcoming = useMemo(() => {
    const now = Date.now();

    return consultations
      .filter(
        (consultation) =>
          consultation.status === "PENDING" &&
          new Date(consultation.scheduledAt).getTime() >= now,
      )
      .sort(
        (left, right) =>
          new Date(left.scheduledAt).getTime() -
          new Date(right.scheduledAt).getTime(),
      );
  }, [consultations]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const key = toDateKey(selectedDate.toISOString());
    return eventsByDate.get(key) || [];
  }, [eventsByDate, selectedDate]);

  const eventDates = useMemo(
    () =>
      Array.from(eventsByDate.keys()).map((key) => new Date(`${key}T12:00:00`)),
    [eventsByDate],
  );

  const eventCountByDate = useMemo(() => {
    const map = new Map<string, number>();

    for (const [key, events] of eventsByDate.entries()) {
      map.set(key, events.length);
    }

    return map;
  }, [eventsByDate]);

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const firstDay = new Date(viewedYear, monthIndex, 1);
      const firstWeekday = firstDay.getDay();
      const daysInMonth = new Date(viewedYear, monthIndex + 1, 0).getDate();
      const cells: Array<{ day: number | null; dateKey: string | null }> = [];

      for (let i = 0; i < firstWeekday; i += 1) {
        cells.push({ day: null, dateKey: null });
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(viewedYear, monthIndex, day);
        cells.push({ day, dateKey: toDateKey(date.toISOString()) });
      }

      while (cells.length % 7 !== 0) {
        cells.push({ day: null, dateKey: null });
      }

      return {
        monthIndex,
        monthLabel: MONTH_LABELS[monthIndex],
        cells,
      };
    });
  }, [viewedYear]);

  const selectedDateKey = useMemo(
    () => (selectedDate ? toDateKey(selectedDate.toISOString()) : null),
    [selectedDate],
  );

  const todayDateKey = useMemo(() => toDateKey(new Date().toISOString()), []);

  return (
    <div className="space-y-6">
      <Card className="rounded-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDaysIcon className="size-5 text-sky-600" />
            Callendar
          </CardTitle>
          <CardDescription>
            Full-size consultation calendar with Month, Day, and Upcoming views.
          </CardDescription>
        </CardHeader>
      </Card>

      {errorMessage ? (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <Tabs defaultValue="year" className="w-full">
        <TabsList>
          <TabsTrigger value="year">Year</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>

        <TabsContent value="year">
          <Card className="rounded-none shadow-none">
            <CardContent className="p-0">
              <div className="flex h-[calc(100vh-13rem)] min-h-[40rem] w-full flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-base font-semibold text-zinc-900">
                    {viewedYear} Year Planner
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewedYear((current) => current - 1)}
                      className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 bg-white"
                      aria-label="Previous year"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewedYear(new Date().getFullYear())}
                      className="h-8 border border-zinc-200 px-3 text-sm"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewedYear((current) => current + 1)}
                      className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 bg-white"
                      aria-label="Next year"
                    >
                      <ChevronRightIcon className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-px overflow-auto bg-zinc-200 md:grid-cols-2 xl:grid-cols-3">
                  {yearMonths.map((month) => (
                    <section
                      key={month.monthIndex}
                      className="bg-white p-3"
                      aria-label={month.monthLabel}
                    >
                      <h4 className="mb-2 text-sm font-semibold text-zinc-900">
                        {month.monthLabel}
                      </h4>

                      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500">
                        {WEEKDAY_LABELS.map((label, index) => (
                          <div key={`${month.monthLabel}-${index}`}>
                            {label}
                          </div>
                        ))}
                      </div>

                      <div className="mt-1 grid grid-cols-7 gap-1">
                        {month.cells.map((cell, index) => {
                          if (!cell.day || !cell.dateKey) {
                            return (
                              <div
                                key={`${month.monthLabel}-empty-${index}`}
                                className="h-8"
                              />
                            );
                          }

                          const eventCount =
                            eventCountByDate.get(cell.dateKey) || 0;
                          const isSelected = selectedDateKey === cell.dateKey;
                          const isToday = todayDateKey === cell.dateKey;

                          return (
                            <button
                              key={cell.dateKey}
                              type="button"
                              onClick={() =>
                                setSelectedDate(
                                  new Date(`${cell.dateKey}T12:00:00`),
                                )
                              }
                              className={cn(
                                "relative h-8 border text-xs",
                                isSelected
                                  ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                                  : "border-zinc-200 bg-white text-zinc-700",
                                isToday ? "font-semibold" : "font-normal",
                              )}
                            >
                              {cell.day}
                              {eventCount > 0 ? (
                                <span className="absolute bottom-0.5 right-0.5 inline-flex min-w-4 items-center justify-center border border-sky-300 bg-sky-50 px-1 text-[10px] leading-none text-sky-700">
                                  {eventCount}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month">
          <Card className="rounded-none shadow-none">
            <CardContent className="p-0">
              {loading ? (
                <p className="p-4 text-sm text-zinc-600">
                  Loading calendar events...
                </p>
              ) : (
                <div className="grid h-[calc(100vh-13rem)] min-h-[40rem] gap-0 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="border-r border-zinc-200 bg-white p-4">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="h-full w-full"
                      modifiers={{
                        hasEvent: eventDates,
                      }}
                      modifiersClassNames={{
                        hasEvent:
                          "[&_button]:relative [&_button]:after:absolute [&_button]:after:bottom-1 [&_button]:after:left-1/2 [&_button]:after:size-1.5 [&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full [&_button]:after:bg-sky-500",
                      }}
                    />
                  </div>

                  <div className="bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
                      Events on{" "}
                      {selectedDate
                        ? selectedDate.toDateString()
                        : "Selected Day"}
                    </h3>
                    {selectedDateEvents.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No events on this date.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDateEvents.map((consultation) => (
                          <article
                            key={consultation.id}
                            className="border border-zinc-200 bg-white p-3"
                          >
                            <p className="font-medium text-zinc-900">
                              {consultation.attendeeName}
                            </p>
                            <p className="text-sm text-zinc-600">
                              {formatDateTimeLabel(consultation.scheduledAt)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {formatConsultationStatus(consultation.status)}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day">
          <Card className="rounded-none shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClockIcon className="size-4 text-emerald-600" />
                Daily Agenda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No consultations on the selected day.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((consultation) => (
                    <article
                      key={consultation.id}
                      className="border border-zinc-200 bg-white p-3"
                    >
                      <p className="font-medium text-zinc-900">
                        {consultation.attendeeName}
                      </p>
                      <p className="text-sm text-zinc-600">
                        {consultation.attendeeEmail}
                      </p>
                      <p className="text-sm text-zinc-700">
                        {formatDateTimeLabel(consultation.scheduledAt)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card className="rounded-none shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3Icon className="size-4 text-violet-600" />
                Upcoming Consultations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No upcoming consultations.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((consultation) => (
                    <article
                      key={consultation.id}
                      className="border border-zinc-200 bg-white p-3"
                    >
                      <p className="font-medium text-zinc-900">
                        {consultation.attendeeName}
                      </p>
                      <p className="text-sm text-zinc-700">
                        {formatDateTimeLabel(consultation.scheduledAt)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {consultation.attendeeEmail}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
