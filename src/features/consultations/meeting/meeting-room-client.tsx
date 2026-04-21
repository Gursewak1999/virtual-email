"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  BadgeCheckIcon,
  Clock3Icon,
  ShieldCheckIcon,
  UserRoundIcon,
  VideoIcon,
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
  formatConsultationStatus,
  formatDateTimeLabel,
  type ConsultationMeetingPayload,
  type ConsultationStatus,
} from "@/features/consultations/lib/shared";
import { WebrtcMeetingPanel } from "@/features/consultations/meeting/webrtc-meeting-panel";
import { cn } from "@/lib/utils";

interface MeetingRoomClientProps {
  consultation: ConsultationMeetingPayload;
  isHost: boolean;
}

function getStatusVariant(status: ConsultationStatus) {
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

export function MeetingRoomClient({
  consultation,
  isHost,
}: MeetingRoomClientProps) {
  const [guestName, setGuestName] = useState(consultation.attendeeName);
  const [joinedName, setJoinedName] = useState<string | null>(
    isHost ? consultation.hostName : null,
  );
  const [status, setStatus] = useState<ConsultationStatus>(consultation.status);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    isHost
      ? "You are recognized as the host for this consultation."
      : "Enter your name to join as the guest.",
  );

  useEffect(() => {
    if (isHost) {
      return;
    }

    const storedName = window.localStorage.getItem(
      `consultation-guest-${consultation.id}`,
    );

    if (storedName) {
      setGuestName(storedName);
    }
  }, [consultation.id, isHost]);

  const canJoin = status === "PENDING";

  function handleGuestJoin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!guestName.trim()) {
      setErrorMessage("Please enter your name before joining.");
      return;
    }

    const normalizedName = guestName.trim();
    window.localStorage.setItem(
      `consultation-guest-${consultation.id}`,
      normalizedName,
    );
    setJoinedName(normalizedName);
    setStatusMessage("Joining your consultation room...");
    setErrorMessage(null);
  }

  async function handleMarkCompleted(): Promise<void> {
    setBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "COMPLETED",
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "Failed to mark consultation complete",
        );
      }

      setStatus("COMPLETED");
      setStatusMessage("Consultation marked as completed.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to mark consultation complete",
      );
    } finally {
      setBusy(false);
    }
  }

  if (canJoin && joinedName) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.2),transparent_38%),linear-gradient(180deg,#06080f_0%,#0b1020_100%)] px-3 py-3 text-zinc-100 sm:px-4 sm:py-4">
        <div className="mx-auto max-w-450">
          <WebrtcMeetingPanel
            consultation={consultation}
            isHost={isHost}
            displayName={joinedName}
            onStatusChange={setStatus}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#f9fbff_0%,#eef4fb_100%)] px-4 py-8 text-zinc-900">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white/90 shadow-xl shadow-zinc-200/40">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusVariant(status)}>
                  {formatConsultationStatus(status)}
                </Badge>
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
                  <VideoIcon className="size-3.5" />
                  {isHost ? "Host View" : "Guest View"}
                </div>
              </div>
              <CardTitle className="text-2xl">
                {consultation.attendeeName} Consultation Room
              </CardTitle>
              <CardDescription>{statusMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage ? (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <div className="grid gap-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Scheduled
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {formatDateTimeLabel(consultation.scheduledAt)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Ends at {formatDateTimeLabel(consultation.endsAt)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheckIcon className="mt-0.5 size-4 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {consultation.hostName}
                      </p>
                      <p className="text-sm text-zinc-600">
                        {consultation.hostEmail || "Host"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <UserRoundIcon className="mt-0.5 size-4 text-sky-600" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {consultation.attendeeName}
                      </p>
                      <p className="text-sm text-zinc-600">
                        {consultation.attendeeEmail}
                        {consultation.attendeePhone
                          ? ` · ${consultation.attendeePhone}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {isHost && canJoin ? (
                <Button
                  onClick={() => void handleMarkCompleted()}
                  disabled={busy}
                >
                  <BadgeCheckIcon />
                  {busy ? "Saving..." : "Mark Completed"}
                </Button>
              ) : null}

              <a
                href={consultation.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                <Clock3Icon />
                Open Meeting in New Tab
              </a>
            </CardContent>
          </Card>

          {!isHost && !joinedName && canJoin ? (
            <Card className="border-zinc-200 bg-white/90 shadow-xl shadow-zinc-200/40">
              <CardHeader>
                <CardTitle>Join as Guest</CardTitle>
                <CardDescription>
                  Enter the name you want shown inside the meeting room.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleGuestJoin}>
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-display-name">Display Name</Label>
                    <Input
                      id="guest-display-name"
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <Button type="submit">Join Meeting</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div>
          <div className="flex min-h-[70vh] items-center justify-center rounded-[1.75rem] border border-zinc-200 bg-white/90 p-8 text-center shadow-xl shadow-zinc-200/40">
            <div className="max-w-md space-y-3">
              <div className="inline-flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                <VideoIcon className="size-6" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-900">
                {status === "COMPLETED"
                  ? "This consultation has been completed."
                  : status === "EXPIRED"
                    ? "This consultation has expired."
                    : status === "CANCELLED"
                      ? "This consultation has been cancelled."
                      : "Waiting to join the meeting."}
              </h2>
              <p className="text-sm text-zinc-600">
                {status === "PENDING"
                  ? "Enter your guest name on the left to join."
                  : "If you need a new time, please contact the host for another booking link."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
