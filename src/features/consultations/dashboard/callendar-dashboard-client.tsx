"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  LinkIcon,
  MailIcon,
  PhoneIcon,
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
const HOUR_ROW_HEIGHT = 72;
const EVENT_TONES = [
  {
    soft: "border-[#5fa8ff]/35 bg-[#5fa8ff]/18 text-white",
    muted: "bg-[#5fa8ff]/14 text-[#bfdbfe]",
  },
  {
    soft: "border-[#4ade80]/35 bg-[#4ade80]/18 text-white",
    muted: "bg-[#4ade80]/14 text-[#bbf7d0]",
  },
  {
    soft: "border-[#8b5cf6]/35 bg-[#8b5cf6]/18 text-white",
    muted: "bg-[#8b5cf6]/14 text-[#ddd6fe]",
  },
  {
    soft: "border-[#fb7185]/35 bg-[#fb7185]/18 text-white",
    muted: "bg-[#fb7185]/14 text-[#fecdd3]",
  },
] as const;
type CalendarView = "week" | "month" | "day" | "year" | "upcoming";

function toDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitials(value: string): string {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "GU"
  );
}

function startOfWeek(value: Date): Date {
  const next = new Date(value);
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatMonthYear(value: Date): string {
  return value.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: Date): string {
  return value.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatDayLabel(value: Date): string {
  return value.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
  });
}

function formatTimeLabel(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(startAt: string, endAt: string): string {
  return `${formatTimeLabel(startAt)} - ${formatTimeLabel(endAt)}`;
}

function getWeekRangeLabel(days: Date[]): string {
  if (days.length === 0) {
    return "";
  }

  return `${formatShortDate(days[0])} - ${days[days.length - 1].toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function getEventTone(seed: string) {
  const hash = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return EVENT_TONES[hash % EVENT_TONES.length];
}

export function CallendarDashboardClient() {
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [hostProfile, setHostProfile] =
    useState<ConsultationHostProfilePayload | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null);
  const [activeView, setActiveView] = useState<CalendarView>("week");
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
        setHostProfile(payload.hostProfile || null);
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

  const metrics = useMemo(() => {
    const pending = consultations.filter(
      (consultation) => consultation.status === "PENDING",
    ).length;
    const completed = consultations.filter(
      (consultation) => consultation.status === "COMPLETED",
    ).length;
    const inactive = consultations.filter(
      (consultation) =>
        consultation.status === "EXPIRED" ||
        consultation.status === "CANCELLED",
    ).length;

    return {
      pending,
      completed,
      inactive,
      total: consultations.length,
    };
  }, [consultations]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const key = toDateKey(selectedDate);
    return eventsByDate.get(key) || [];
  }, [eventsByDate, selectedDate]);

  const eventDates = useMemo(
    () =>
      Array.from(eventsByDate.keys()).map(
        (key) => new Date(`${key}T12:00:00`),
      ),
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
        cells.push({ day, dateKey: toDateKey(date) });
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
    () => (selectedDate ? toDateKey(selectedDate) : null),
    [selectedDate],
  );

  const todayDateKey = useMemo(() => toDateKey(new Date()), []);
  const selectedWeekDays = useMemo(() => {
    const anchor = selectedDate || new Date();
    const weekStart = startOfWeek(anchor);

    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [selectedDate]);

  const weekColumns = useMemo(
    () =>
      selectedWeekDays.map((day) => ({
        day,
        dateKey: toDateKey(day),
        events: [...(eventsByDate.get(toDateKey(day)) || [])].sort(
          (left, right) =>
            new Date(left.scheduledAt).getTime() -
            new Date(right.scheduledAt).getTime(),
        ),
      })),
    [eventsByDate, selectedWeekDays],
  );

  const timeline = useMemo(() => {
    let startHour = 8;
    let endHour = 18;

    for (const column of weekColumns) {
      for (const consultation of column.events) {
        const start = new Date(consultation.scheduledAt);
        const end = new Date(consultation.endsAt);
        startHour = Math.min(startHour, start.getHours());
        endHour = Math.max(
          endHour,
          end.getHours() + (end.getMinutes() > 0 ? 1 : 0),
        );
      }
    }

    if (endHour <= startHour) {
      endHour = startHour + 10;
    }

    return {
      startHour,
      endHour,
      height: Math.max((endHour - startHour) * HOUR_ROW_HEIGHT, 480),
      labels: Array.from(
        { length: endHour - startHour + 1 },
        (_, index) => startHour + index,
      ),
    };
  }, [weekColumns]);

  const selectedConsultation = useMemo(
    () =>
      consultations.find(
        (consultation) => consultation.id === selectedConsultationId,
      ) ||
      selectedDateEvents[0] ||
      upcoming[0] ||
      null,
    [consultations, selectedConsultationId, selectedDateEvents, upcoming],
  );

  const enabledAvailability = useMemo(
    () =>
      hostProfile?.availability
        .filter((entry) => entry.enabled)
        .map(
          (entry) =>
            `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][entry.dayOfWeek]} ${entry.startTime} - ${entry.endTime}`,
        ) || [],
    [hostProfile],
  );

  useEffect(() => {
    if (
      selectedConsultationId &&
      consultations.some(
        (consultation) => consultation.id === selectedConsultationId,
      )
    ) {
      return;
    }

    const fallbackId = selectedDateEvents[0]?.id || upcoming[0]?.id || null;
    if (fallbackId !== selectedConsultationId) {
      setSelectedConsultationId(fallbackId);
    }
  }, [consultations, selectedConsultationId, selectedDateEvents, upcoming]);

  function shiftSelectedDate(days: number): void {
    setSelectedDate((current) => addDays(current || new Date(), days));
  }

  const panelClassName =
    "border-white/10 bg-[#11141d] text-white shadow-[0_24px_70px_-36px_rgba(0,0,0,0.85)]";
  const softPanelClassName =
    "rounded-[1.5rem] border border-white/10 bg-[#0b0e16] text-white";
  const calendarClassNames = {
    months: "w-full",
    month: "w-full space-y-4",
    month_caption: "mb-3 flex items-center justify-between",
    caption_label: "text-left text-lg font-semibold tracking-tight text-white",
    nav: "flex items-center gap-2",
    button_previous:
      "inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]",
    button_next:
      "inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]",
    month_grid: "w-full border-collapse",
    weekdays: "grid grid-cols-7 gap-2",
    weekday:
      "text-center text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/35",
    week: "mt-2 grid grid-cols-7 gap-2",
    day: "flex justify-center",
    day_button:
      "flex size-11 items-center justify-center rounded-2xl border border-transparent text-sm text-white/78 transition hover:bg-white/[0.08]",
    selected:
      "!border-transparent !bg-white !text-[#0b101a] shadow-[0_12px_30px_-18px_rgba(255,255,255,0.95)]",
    today: "border border-white/15 bg-white/[0.06] text-white",
    outside: "text-white/20",
    hidden: "invisible",
  };

  return (
    <div className="space-y-6 text-white">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.32fr))]">
        <Card className={cn(panelClassName, "xl:col-span-1")}>
          <CardHeader className="border-b border-white/10">
            <Badge className="w-fit border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.06]">
              Consultation Calendar
            </Badge>
            <CardTitle className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Simple scheduling, redesigned around the week.
            </CardTitle>
            <CardDescription className="max-w-2xl text-white/58">
              Monitor booked calls, spot open windows, and jump into meeting
              details from one dashboard view.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className={cn(panelClassName, "justify-center")}>
          <CardContent className="flex h-full flex-col justify-center py-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/38">
              Pending
            </p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {metrics.pending}
            </p>
            <p className="mt-1 text-sm text-white/48">Upcoming consultations</p>
          </CardContent>
        </Card>

        <Card className={cn(panelClassName, "justify-center")}>
          <CardContent className="flex h-full flex-col justify-center py-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/38">
              Completed
            </p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {metrics.completed}
            </p>
            <p className="mt-1 text-sm text-white/48">Finished successfully</p>
          </CardContent>
        </Card>

        <Card className={cn(panelClassName, "justify-center")}>
          <CardContent className="flex h-full flex-col justify-center py-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/38">
              Total
            </p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {metrics.total}
            </p>
            <p className="mt-1 text-sm text-white/48">Calendar records loaded</p>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <Tabs
        value={activeView}
        onValueChange={(value) => setActiveView(value as CalendarView)}
        className="w-full"
      >
        <TabsList className="h-11 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <TabsTrigger
            value="week"
            className="rounded-full px-4 text-white/64 data-active:bg-white data-active:text-[#0b101a]"
          >
            Week
          </TabsTrigger>
          <TabsTrigger
            value="month"
            className="rounded-full px-4 text-white/64 data-active:bg-white data-active:text-[#0b101a]"
          >
            Month
          </TabsTrigger>
          <TabsTrigger
            value="day"
            className="rounded-full px-4 text-white/64 data-active:bg-white data-active:text-[#0b101a]"
          >
            Day
          </TabsTrigger>
          <TabsTrigger
            value="year"
            className="rounded-full px-4 text-white/64 data-active:bg-white data-active:text-[#0b101a]"
          >
            Year
          </TabsTrigger>
          <TabsTrigger
            value="upcoming"
            className="rounded-full px-4 text-white/64 data-active:bg-white data-active:text-[#0b101a]"
          >
            Upcoming
          </TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-0">
          <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <Card className={panelClassName}>
                <CardHeader className="border-b border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/38">
                        Month
                      </p>
                      <CardTitle className="mt-2 text-2xl font-semibold text-white">
                        {formatMonthYear(selectedDate || new Date())}
                      </CardTitle>
                    </div>
                    <Badge className="border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.06]">
                      {hostProfile?.timezone || "America/Toronto"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className={cn(softPanelClassName, "p-2")}>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="w-full"
                      classNames={calendarClassNames}
                      modifiers={{
                        hasEvent: eventDates,
                      }}
                      modifiersClassNames={{
                        hasEvent:
                          "[&_button]:relative [&_button]:after:absolute [&_button]:after:bottom-1.5 [&_button]:after:left-1/2 [&_button]:after:size-1.5 [&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full [&_button]:after:bg-white",
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className={panelClassName}>
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-base text-white">
                    Upcoming
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    Next consultations in the queue.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {upcoming.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                      No upcoming consultations scheduled yet.
                    </p>
                  ) : (
                    upcoming.slice(0, 4).map((consultation) => {
                      const tone = getEventTone(consultation.id);

                      return (
                        <button
                          key={consultation.id}
                          type="button"
                          onClick={() => {
                            setSelectedDate(new Date(consultation.scheduledAt));
                            setSelectedConsultationId(consultation.id);
                          }}
                          className={cn(
                            "w-full rounded-[1.25rem] border px-3 py-3 text-left transition hover:bg-white/[0.08]",
                            tone.soft,
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium text-white">
                              {consultation.attendeeName}
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                tone.muted,
                              )}
                            >
                              {formatConsultationStatus(consultation.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-white/72">
                            {formatTimeRange(
                              consultation.scheduledAt,
                              consultation.endsAt,
                            )}
                          </p>
                          <p className="mt-1 truncate text-xs text-white/45">
                            {consultation.attendeeEmail}
                          </p>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className={panelClassName}>
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-base text-white">
                    Status breakdown
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    Quick view of the current booking mix.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {[
                    {
                      label: "Pending",
                      count: metrics.pending,
                      color: "bg-[#5fa8ff]",
                    },
                    {
                      label: "Completed",
                      count: metrics.completed,
                      color: "bg-[#4ade80]",
                    },
                    {
                      label: "Inactive",
                      count: metrics.inactive,
                      color: "bg-[#8b5cf6]",
                    },
                  ].map((item) => {
                    const width =
                      metrics.total === 0
                        ? 0
                        : Math.max(10, (item.count / metrics.total) * 100);

                    return (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/68">{item.label}</span>
                          <span className="font-medium text-white">
                            {item.count}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.06]">
                          <div
                            className={cn("h-2 rounded-full", item.color)}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card className={panelClassName}>
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/38">
                      Week view
                    </p>
                    <CardTitle className="mt-2 text-3xl font-semibold text-white">
                      {formatMonthYear(selectedDate || new Date())}
                    </CardTitle>
                    <CardDescription className="mt-1 text-white/55">
                      {getWeekRangeLabel(selectedWeekDays)}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                      onClick={() => shiftSelectedDate(-7)}
                      aria-label="Previous week"
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                      onClick={() => shiftSelectedDate(7)}
                      aria-label="Next week"
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {weekColumns.map((column) => {
                    const isSelected = selectedDateKey === column.dateKey;

                    return (
                      <button
                        key={column.dateKey}
                        type="button"
                        onClick={() => setSelectedDate(column.day)}
                        className={cn(
                          "min-w-[88px] rounded-[1.25rem] border px-3 py-2 text-left transition",
                          isSelected
                            ? "border-white bg-white text-[#09101a]"
                            : "border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.08]",
                        )}
                      >
                        <p className="text-xs uppercase tracking-[0.16em]">
                          {column.day.toLocaleDateString([], {
                            weekday: "short",
                          })}
                        </p>
                        <p className="mt-1 text-base font-semibold">
                          {column.day.getDate()}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            isSelected ? "text-[#09101a]/70" : "text-white/45",
                          )}
                        >
                          {column.events.length} event
                          {column.events.length === 1 ? "" : "s"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardHeader>

              <CardContent className="overflow-x-auto pb-5 pt-5">
                {loading ? (
                  <p className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                    Loading calendar events...
                  </p>
                ) : (
                  <div className="min-w-[840px]">
                    <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] gap-3">
                      <div />
                      {weekColumns.map((column) => (
                        <div
                          key={`${column.dateKey}-header`}
                          className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-3 py-3"
                        >
                          <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                            {column.day.toLocaleDateString([], {
                              weekday: "short",
                            })}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {column.day.getDate()}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-[88px_repeat(7,minmax(0,1fr))] gap-3">
                      <div className="relative" style={{ height: timeline.height }}>
                        {timeline.labels.map((hour) => (
                          <div
                            key={hour}
                            className="absolute left-0 text-xs text-white/38"
                            style={{
                              top:
                                (hour - timeline.startHour) * HOUR_ROW_HEIGHT -
                                8,
                            }}
                          >
                            {new Date(
                              2025,
                              0,
                              1,
                              hour,
                              0,
                            ).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        ))}
                      </div>

                      {weekColumns.map((column) => (
                        <div
                          key={column.dateKey}
                          className="relative rounded-[1.5rem] border border-white/10 bg-[#0b0e16]"
                          style={{ height: timeline.height }}
                        >
                          {timeline.labels.map((hour) => (
                            <div
                              key={`${column.dateKey}-${hour}`}
                              className="absolute inset-x-0 border-t border-white/8"
                              style={{
                                top:
                                  (hour - timeline.startHour) *
                                  HOUR_ROW_HEIGHT,
                              }}
                            />
                          ))}

                          {column.events.length === 0 ? (
                            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl border border-dashed border-white/8 px-3 py-4 text-center text-xs text-white/35">
                              Open schedule
                            </div>
                          ) : null}

                          {column.events.map((consultation) => {
                            const tone = getEventTone(consultation.id);
                            const start = new Date(consultation.scheduledAt);
                            const end = new Date(consultation.endsAt);
                            const minutesFromStart =
                              (start.getHours() - timeline.startHour) * 60 +
                              start.getMinutes();
                            const durationMinutes = Math.max(
                              45,
                              Math.round(
                                (end.getTime() - start.getTime()) / 60_000,
                              ),
                            );

                            return (
                              <button
                                key={consultation.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDate(column.day);
                                  setSelectedConsultationId(consultation.id);
                                }}
                                className={cn(
                                  "absolute left-2 right-2 rounded-[1.25rem] border p-3 text-left shadow-[0_18px_40px_-28px_rgba(0,0,0,0.95)] transition hover:scale-[1.01]",
                                  tone.soft,
                                  selectedConsultation?.id === consultation.id
                                    ? "ring-2 ring-white/35"
                                    : "",
                                )}
                                style={{
                                  top:
                                    (minutesFromStart / 60) * HOUR_ROW_HEIGHT +
                                    6,
                                  height:
                                    (durationMinutes / 60) * HOUR_ROW_HEIGHT -
                                    8,
                                }}
                              >
                                <p className="line-clamp-2 text-sm font-semibold text-white">
                                  {consultation.attendeeName}
                                </p>
                                <p className="mt-1 text-xs text-white/78">
                                  {formatTimeRange(
                                    consultation.scheduledAt,
                                    consultation.endsAt,
                                  )}
                                </p>
                                <p className="mt-2 line-clamp-2 text-[11px] text-white/58">
                                  {consultation.attendeeEmail}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className={panelClassName}>
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-base text-white">
                    {selectedConsultation
                      ? selectedConsultation.attendeeName
                      : "Meeting details"}
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    {selectedConsultation
                      ? "Selected consultation summary"
                      : "Select an event to inspect it here."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {selectedConsultation ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.08] text-base font-semibold text-white">
                          {getInitials(selectedConsultation.attendeeName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {selectedConsultation.attendeeName}
                          </p>
                          <p className="truncate text-sm text-white/52">
                            {selectedConsultation.attendeeEmail}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-sm text-white/72">
                          <CalendarClockIcon className="size-4 text-white/62" />
                          <span>
                            {formatDateTimeLabel(
                              selectedConsultation.scheduledAt,
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm text-white/72">
                          <Clock3Icon className="size-4 text-white/62" />
                          <span>
                            {formatTimeRange(
                              selectedConsultation.scheduledAt,
                              selectedConsultation.endsAt,
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm text-white/72">
                          <MailIcon className="size-4 text-white/62" />
                          <span className="truncate">
                            {selectedConsultation.attendeeEmail}
                          </span>
                        </div>
                        {selectedConsultation.attendeePhone ? (
                          <div className="mt-2 flex items-center gap-2 text-sm text-white/72">
                            <PhoneIcon className="size-4 text-white/62" />
                            <span>{selectedConsultation.attendeePhone}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="border-white/10 bg-white/[0.06] text-white/82 hover:bg-white/[0.06]">
                          {formatConsultationStatus(
                            selectedConsultation.status,
                          )}
                        </Badge>
                        <Badge className="border-white/10 bg-white/[0.06] text-white/82 hover:bg-white/[0.06]">
                          Code {selectedConsultation.meetingCode}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={selectedConsultation.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "rounded-full bg-white text-[#0b101a] hover:bg-white/90",
                          )}
                        >
                          Join meeting
                          <ArrowUpRightIcon className="size-4" />
                        </a>
                        <Link
                          href={selectedConsultation.meetingPath}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "rounded-full border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          View route
                          <LinkIcon className="size-4" />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-5 text-sm text-white/55">
                      Select a consultation to see details, timing, and direct
                      meeting links.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className={panelClassName}>
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-base text-white">
                    Daily agenda
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    {selectedDate
                      ? `Events for ${formatDayLabel(selectedDate)}`
                      : "Choose a date to inspect the agenda."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {selectedDateEvents.length === 0 ? (
                    <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                      No consultations on this day.
                    </p>
                  ) : (
                    selectedDateEvents.map((consultation) => {
                      const tone = getEventTone(consultation.id);

                      return (
                        <button
                          key={consultation.id}
                          type="button"
                          onClick={() => setSelectedConsultationId(consultation.id)}
                          className={cn(
                            "w-full rounded-[1.25rem] border px-3 py-3 text-left transition hover:bg-white/[0.08]",
                            tone.soft,
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">
                                {consultation.attendeeName}
                              </p>
                              <p className="mt-1 text-sm text-white/72">
                                {formatTimeRange(
                                  consultation.scheduledAt,
                                  consultation.endsAt,
                                )}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                tone.muted,
                              )}
                            >
                              {formatConsultationStatus(consultation.status)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className={panelClassName}>
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-base text-white">
                    Availability
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    Host schedule and booking setup.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                      Default duration
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {hostProfile?.defaultDurationMinutes || 30} min
                    </p>
                  </div>

                  <div className="space-y-2">
                    {enabledAvailability.length === 0 ? (
                      <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                        Availability has not been configured yet.
                      </p>
                    ) : (
                      enabledAvailability.map((entry) => (
                        <div
                          key={entry}
                          className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/72"
                        >
                          {entry}
                        </div>
                      ))
                    )}
                  </div>

                  {hostProfile?.bookingPath ? (
                    <a
                      href={hostProfile.bookingUrl || hostProfile.bookingPath}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "w-full rounded-full border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:text-white",
                      )}
                    >
                      Open booking page
                      <ArrowUpRightIcon className="size-4" />
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="month">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className={panelClassName}>
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <CalendarDaysIcon className="size-5 text-white/72" />
                  Monthly calendar
                </CardTitle>
                <CardDescription className="text-white/55">
                  Pick a date to review scheduled consultations.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className={cn(softPanelClassName, "p-3")}>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="w-full"
                    classNames={calendarClassNames}
                    modifiers={{
                      hasEvent: eventDates,
                    }}
                    modifiersClassNames={{
                      hasEvent:
                        "[&_button]:relative [&_button]:after:absolute [&_button]:after:bottom-1.5 [&_button]:after:left-1/2 [&_button]:after:size-1.5 [&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full [&_button]:after:bg-white",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={panelClassName}>
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-base text-white">
                  Events on{" "}
                  {selectedDate
                    ? selectedDate.toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : "selected day"}
                </CardTitle>
                <CardDescription className="text-white/55">
                  Focused list for the date you clicked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {loading ? (
                  <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                    Loading calendar events...
                  </p>
                ) : selectedDateEvents.length === 0 ? (
                  <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                    No events on this date.
                  </p>
                ) : (
                  selectedDateEvents.map((consultation) => {
                    const tone = getEventTone(consultation.id);

                    return (
                      <button
                        key={consultation.id}
                        type="button"
                        onClick={() => setSelectedConsultationId(consultation.id)}
                        className={cn(
                          "w-full rounded-[1.25rem] border px-3 py-3 text-left transition hover:bg-white/[0.08]",
                          tone.soft,
                        )}
                      >
                        <p className="font-medium text-white">
                          {consultation.attendeeName}
                        </p>
                        <p className="mt-1 text-sm text-white/72">
                          {formatDateTimeLabel(consultation.scheduledAt)}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {formatConsultationStatus(consultation.status)}
                        </p>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="day">
          <Card className={panelClassName}>
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <CalendarClockIcon className="size-4 text-white/72" />
                Daily agenda
              </CardTitle>
              <CardDescription className="text-white/55">
                Detailed entries for the currently selected date.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {selectedDateEvents.length === 0 ? (
                <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                  No consultations on the selected day.
                </p>
              ) : (
                selectedDateEvents.map((consultation) => {
                  const tone = getEventTone(consultation.id);

                  return (
                    <article
                      key={consultation.id}
                      className={cn(
                        "rounded-[1.25rem] border px-4 py-4",
                        tone.soft,
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {consultation.attendeeName}
                          </p>
                          <p className="mt-1 text-sm text-white/72">
                            {consultation.attendeeEmail}
                          </p>
                        </div>
                        <Badge className="border-white/10 bg-white/[0.06] text-white/82 hover:bg-white/[0.06]">
                          {formatConsultationStatus(consultation.status)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-white/68">
                        {formatTimeRange(
                          consultation.scheduledAt,
                          consultation.endsAt,
                        )}
                      </p>
                    </article>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="year">
          <Card className={panelClassName}>
            <CardHeader className="border-b border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-white">
                    {viewedYear} year planner
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    Scan the full year and jump directly to active dates.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                    onClick={() => setViewedYear((current) => current - 1)}
                    aria-label="Previous year"
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                    onClick={() => setViewedYear(new Date().getFullYear())}
                  >
                    Today
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                    onClick={() => setViewedYear((current) => current + 1)}
                    aria-label="Next year"
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-[1.5rem] bg-white/8 md:grid-cols-2 xl:grid-cols-3">
                {yearMonths.map((month) => (
                  <section
                    key={month.monthIndex}
                    className="bg-[#0b0e16] p-4"
                    aria-label={month.monthLabel}
                  >
                    <h4 className="mb-3 text-sm font-semibold text-white">
                      {month.monthLabel}
                    </h4>

                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/35">
                      {WEEKDAY_LABELS.map((label, index) => (
                        <div key={`${month.monthLabel}-${index}`}>{label}</div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {month.cells.map((cell, index) => {
                        if (!cell.day || !cell.dateKey) {
                          return (
                            <div
                              key={`${month.monthLabel}-empty-${index}`}
                              className="h-9"
                            />
                          );
                        }

                        const eventCount = eventCountByDate.get(cell.dateKey) || 0;
                        const isSelected = selectedDateKey === cell.dateKey;
                        const isToday = todayDateKey === cell.dateKey;

                        return (
                          <button
                            key={cell.dateKey}
                            type="button"
                            onClick={() =>
                              setSelectedDate(new Date(`${cell.dateKey}T12:00:00`))
                            }
                            className={cn(
                              "relative h-9 rounded-xl border text-xs transition",
                              isSelected
                                ? "border-white bg-white text-[#0b101a]"
                                : "border-white/8 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]",
                              isToday ? "font-semibold" : "font-normal",
                            )}
                          >
                            {cell.day}
                            {eventCount > 0 ? (
                              <span className="absolute bottom-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-white/14 px-1 text-[10px] text-white">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card className={panelClassName}>
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Clock3Icon className="size-4 text-white/72" />
                Upcoming consultations
              </CardTitle>
              <CardDescription className="text-white/55">
                Complete forward-looking list across the schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {upcoming.length === 0 ? (
                <p className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/55">
                  No upcoming consultations.
                </p>
              ) : (
                upcoming.map((consultation) => {
                  const tone = getEventTone(consultation.id);

                  return (
                    <article
                      key={consultation.id}
                      className={cn(
                        "rounded-[1.25rem] border px-4 py-4",
                        tone.soft,
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {consultation.attendeeName}
                          </p>
                          <p className="mt-1 text-sm text-white/72">
                            {formatDateTimeLabel(consultation.scheduledAt)}
                          </p>
                        </div>
                        <a
                          href={consultation.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "rounded-full border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          Open
                          <ArrowUpRightIcon className="size-4" />
                        </a>
                      </div>
                      <p className="mt-2 text-xs text-white/45">
                        {consultation.attendeeEmail}
                      </p>
                    </article>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
