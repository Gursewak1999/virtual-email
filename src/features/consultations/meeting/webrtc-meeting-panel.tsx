"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CameraIcon,
  CameraOffIcon,
  MicIcon,
  MicOffIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UsersIcon,
  UserRoundIcon,
  VideoIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CONSULTATION_MEETING_PRESENCE_TTL_MS,
  formatConsultationStatus,
  type ConsultationMeetingPayload,
  type ConsultationMeetingRole,
  type ConsultationStatus,
} from "@/features/consultations/lib/shared";

const EVENT_POLL_INTERVAL_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 8000;
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302"] },
  { urls: ["stun:stun1.l.google.com:19302"] },
  { urls: ["stun:stun2.l.google.com:19302"] },
  { urls: ["stun:stun3.l.google.com:19302"] },
];

type AggregateConnectionState =
  | "starting"
  | "waiting"
  | "connecting"
  | "connected"
  | "failed";

interface RemoteParticipantState {
  clientId: string;
  displayName: string;
  role: ConsultationMeetingRole;
  audioEnabled: boolean;
  videoEnabled: boolean;
  lastSeenAt: number;
  connectionState: RTCPeerConnectionState | "waiting";
}

interface MeetingEventPayload {
  id: string;
  senderRole: ConsultationMeetingRole;
  senderClientId: string;
  targetClientId: string | null;
  eventType: string;
  payload: unknown;
}

interface WebrtcMeetingPanelProps {
  consultation: ConsultationMeetingPayload;
  isHost: boolean;
  displayName: string;
  onStatusChange: (status: ConsultationStatus) => void;
}

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `client-${Math.random().toString(36).slice(2, 12)}`;
}

function getIceServers(): RTCIceServer[] {
  const rawValue = process.env.NEXT_PUBLIC_CONSULTATION_ICE_SERVERS;

  if (!rawValue) {
    return DEFAULT_ICE_SERVERS;
  }

  try {
    const parsed = JSON.parse(rawValue) as RTCIceServer[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_ICE_SERVERS;
    }

    return parsed;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

function shouldInitiateOffer(localClientId: string, remoteClientId: string): boolean {
  return localClientId.localeCompare(remoteClientId) < 0;
}

function sortParticipants(
  participants: Iterable<RemoteParticipantState>,
): RemoteParticipantState[] {
  return [...participants].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "HOST" ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function getAggregateConnectionBadgeVariant(state: AggregateConnectionState) {
  if (state === "connected") {
    return "secondary" as const;
  }

  if (state === "failed") {
    return "destructive" as const;
  }

  return "outline" as const;
}

function getParticipantConnectionLabel(
  connectionState: RTCPeerConnectionState | "waiting",
): string {
  if (connectionState === "new") {
    return "waiting";
  }

  return connectionState;
}

export function WebrtcMeetingPanel({
  consultation,
  isHost,
  displayName,
  onStatusChange,
}: WebrtcMeetingPanelProps) {
  const role: ConsultationMeetingRole = isHost ? "HOST" : "GUEST";
  const clientIdRef = useRef(createClientId());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const participantsRef = useRef<Map<string, RemoteParticipantState>>(new Map());
  const pendingIceCandidatesRef = useRef<
    Map<string, RTCIceCandidateInit[]>
  >(new Map());
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const latestCursorRef = useRef<string | null>(null);
  const displayNameRef = useRef(displayName);
  const audioEnabledRef = useRef(true);
  const videoEnabledRef = useRef(true);

  const [remoteParticipants, setRemoteParticipants] = useState<
    RemoteParticipantState[]
  >([]);
  const [aggregateConnectionState, setAggregateConnectionState] =
    useState<AggregateConnectionState>("starting");
  const [roomPopulation, setRoomPopulation] = useState(1);
  const [roomPeerLimit, setRoomPeerLimit] = useState(
    consultation.meetingPeerLimit,
  );
  const [statusMessage, setStatusMessage] = useState(
    "Preparing your in-app consultation room...",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [microphoneAvailable, setMicrophoneAvailable] = useState(true);
  const [restarting, setRestarting] = useState(false);

  displayNameRef.current = displayName;
  audioEnabledRef.current = audioEnabled;
  videoEnabledRef.current = videoEnabled;

  function syncRemoteParticipantsState(): void {
    setRemoteParticipants(sortParticipants(participantsRef.current.values()));
  }

  function syncAggregateConnectionState(): void {
    const participants = [...participantsRef.current.values()];

    if (participants.length === 0) {
      setAggregateConnectionState("waiting");
      setStatusMessage(
        isHost
          ? "Waiting for guests to join the room..."
          : "Waiting for the host or other guests to join...",
      );
      return;
    }

    const connectionStates = participants.map(
      (participant) => participant.connectionState,
    );

    if (connectionStates.some((state) => state === "failed")) {
      setAggregateConnectionState("failed");
      setStatusMessage("One or more peer connections failed. Try reconnecting.");
      return;
    }

    if (connectionStates.some((state) => state === "connected")) {
      setAggregateConnectionState("connected");
      setStatusMessage(
        `${participants.length + 1} participant(s) are connected in this room.`,
      );
      return;
    }

    if (
      connectionStates.some(
        (state) => state === "connecting" || state === "new",
      )
    ) {
      setAggregateConnectionState("connecting");
      setStatusMessage("Connecting peers inside the in-app meeting room...");
      return;
    }

    setAggregateConnectionState("waiting");
    setStatusMessage(
      isHost
        ? "Waiting for guests to join the room..."
        : "Waiting for the host or other guests to join...",
    );
  }

  function attachLocalStream(stream: MediaStream | null): void {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }

  function setRemoteVideoElement(
    clientId: string,
    element: HTMLVideoElement | null,
  ): void {
    if (element) {
      remoteVideoRefs.current.set(clientId, element);
      element.srcObject = remoteStreamsRef.current.get(clientId) ?? null;
      return;
    }

    remoteVideoRefs.current.delete(clientId);
  }

  function attachRemoteStream(clientId: string, stream: MediaStream | null): void {
    const element = remoteVideoRefs.current.get(clientId);

    if (element) {
      element.srcObject = stream;
    }
  }

  async function postMeetingEvent(input: {
    eventType:
      | "presence"
      | "request-offer"
      | "offer"
      | "answer"
      | "ice-candidate"
      | "leave";
    targetRole?: ConsultationMeetingRole;
    targetClientId?: string;
    payload?: unknown;
  }): Promise<void> {
    const response = await fetch(
      `/api/consultations/meeting/${consultation.meetingCode}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          clientId: clientIdRef.current,
          targetRole: input.targetRole,
          targetClientId: input.targetClientId,
          eventType: input.eventType,
          payload: input.payload,
        }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
          }
        | null;

      throw new Error(payload?.error || "Unable to reach the meeting server.");
    }
  }

  function buildPresencePayload() {
    return {
      displayName: displayNameRef.current,
      audioEnabled: audioEnabledRef.current,
      videoEnabled: videoEnabledRef.current,
    };
  }

  async function publishPresence(): Promise<void> {
    await postMeetingEvent({
      eventType: "presence",
      payload: buildPresencePayload(),
    });
  }

  function getOrCreateRemoteStream(clientId: string): MediaStream {
    const existing = remoteStreamsRef.current.get(clientId);

    if (existing) {
      return existing;
    }

    const stream = new MediaStream();
    remoteStreamsRef.current.set(clientId, stream);
    attachRemoteStream(clientId, stream);
    return stream;
  }

  function closePeerConnection(clientId: string, removeMedia = false): void {
    const peerConnection = peerConnectionsRef.current.get(clientId);

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peerConnectionsRef.current.delete(clientId);
    }

    pendingIceCandidatesRef.current.delete(clientId);

    if (removeMedia) {
      remoteStreamsRef.current.delete(clientId);
      attachRemoteStream(clientId, null);
    }
  }

  function closeAllPeerConnections(): void {
    for (const clientId of peerConnectionsRef.current.keys()) {
      closePeerConnection(clientId, true);
    }
  }

  function updateParticipant(
    clientId: string,
    patch: Partial<RemoteParticipantState>,
  ): void {
    const currentParticipant = participantsRef.current.get(clientId);

    if (!currentParticipant) {
      return;
    }

    participantsRef.current.set(clientId, {
      ...currentParticipant,
      ...patch,
    });
    syncRemoteParticipantsState();
    syncAggregateConnectionState();
  }

  function createPeerConnection(clientId: string): RTCPeerConnection {
    const existing = peerConnectionsRef.current.get(clientId);

    if (existing) {
      return existing;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: getIceServers(),
    });
    const remoteStream = getOrCreateRemoteStream(clientId);
    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          if (
            !remoteStream
              .getTracks()
              .some((existingTrack) => existingTrack.id === track.id)
          ) {
            remoteStream.addTrack(track);
          }
        });
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void postMeetingEvent({
        eventType: "ice-candidate",
        targetClientId: clientId,
        targetRole: participantsRef.current.get(clientId)?.role,
        payload: event.candidate.toJSON(),
      }).catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to exchange ICE candidates.",
        );
      });
    };

    peerConnection.onconnectionstatechange = () => {
      updateParticipant(clientId, {
        connectionState:
          peerConnection.connectionState === "new"
            ? "waiting"
            : peerConnection.connectionState,
      });
    };

    peerConnectionsRef.current.set(clientId, peerConnection);
    updateParticipant(clientId, {
      connectionState: "new",
    });

    return peerConnection;
  }

  async function flushPendingIceCandidates(clientId: string): Promise<void> {
    const peerConnection = peerConnectionsRef.current.get(clientId);

    if (!peerConnection?.remoteDescription) {
      return;
    }

    const queue = pendingIceCandidatesRef.current.get(clientId) || [];

    while (queue.length > 0) {
      const candidate = queue.shift();

      if (!candidate) {
        continue;
      }

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    if (queue.length === 0) {
      pendingIceCandidatesRef.current.delete(clientId);
    } else {
      pendingIceCandidatesRef.current.set(clientId, queue);
    }
  }

  async function maybeCreateOffer(clientId: string): Promise<void> {
    if (!shouldInitiateOffer(clientIdRef.current, clientId)) {
      return;
    }

    const peerConnection = createPeerConnection(clientId);

    if (
      peerConnection.connectionState === "connected" ||
      (peerConnection.currentLocalDescription &&
        peerConnection.currentRemoteDescription)
    ) {
      return;
    }

    if (peerConnection.signalingState !== "stable") {
      return;
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    updateParticipant(clientId, {
      connectionState: "connecting",
    });

    await postMeetingEvent({
      eventType: "offer",
      targetClientId: clientId,
      targetRole: participantsRef.current.get(clientId)?.role,
      payload: offer,
    });
  }

  function upsertPresenceParticipant(event: MeetingEventPayload): void {
    if (event.senderClientId === clientIdRef.current) {
      return;
    }

    const payload =
      event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? (event.payload as {
            displayName?: string;
            audioEnabled?: boolean;
            videoEnabled?: boolean;
          })
        : {};
    const currentParticipant = participantsRef.current.get(event.senderClientId);

    participantsRef.current.set(event.senderClientId, {
      clientId: event.senderClientId,
      displayName:
        payload.displayName?.trim() ||
        currentParticipant?.displayName ||
        (event.senderRole === "HOST"
          ? consultation.hostName
          : consultation.attendeeName),
      role: event.senderRole,
      audioEnabled: payload.audioEnabled ?? currentParticipant?.audioEnabled ?? true,
      videoEnabled: payload.videoEnabled ?? currentParticipant?.videoEnabled ?? true,
      lastSeenAt: Date.now(),
      connectionState: currentParticipant?.connectionState ?? "waiting",
    });

    syncRemoteParticipantsState();
    syncAggregateConnectionState();
  }

  function removeParticipant(clientId: string): void {
    participantsRef.current.delete(clientId);
    closePeerConnection(clientId, true);
    syncRemoteParticipantsState();
    syncAggregateConnectionState();
  }

  async function handleIncomingOffer(event: MeetingEventPayload): Promise<void> {
    if (!event.payload || typeof event.payload !== "object") {
      return;
    }

    let peerConnection = createPeerConnection(event.senderClientId);

    if (peerConnection.signalingState !== "stable") {
      closePeerConnection(event.senderClientId, false);
      peerConnection = createPeerConnection(event.senderClientId);
    }

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(event.payload as RTCSessionDescriptionInit),
    );
    await flushPendingIceCandidates(event.senderClientId);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    updateParticipant(event.senderClientId, {
      connectionState: "connecting",
    });

    await postMeetingEvent({
      eventType: "answer",
      targetClientId: event.senderClientId,
      targetRole: event.senderRole,
      payload: answer,
    });
  }

  async function handleIncomingAnswer(event: MeetingEventPayload): Promise<void> {
    const peerConnection = peerConnectionsRef.current.get(event.senderClientId);

    if (!peerConnection || !event.payload || typeof event.payload !== "object") {
      return;
    }

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(event.payload as RTCSessionDescriptionInit),
    );
    await flushPendingIceCandidates(event.senderClientId);
  }

  async function handleIncomingIceCandidate(
    event: MeetingEventPayload,
  ): Promise<void> {
    if (!event.payload || typeof event.payload !== "object") {
      return;
    }

    const candidate = event.payload as RTCIceCandidateInit;
    const peerConnection = peerConnectionsRef.current.get(event.senderClientId);

    if (!peerConnection?.remoteDescription) {
      const queue =
        pendingIceCandidatesRef.current.get(event.senderClientId) || [];
      queue.push(candidate);
      pendingIceCandidatesRef.current.set(event.senderClientId, queue);
      return;
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async function processIncomingEvents(events: MeetingEventPayload[]): Promise<void> {
    for (const event of events) {
      if (processedEventIdsRef.current.has(event.id)) {
        continue;
      }

      processedEventIdsRef.current.add(event.id);

      if (event.eventType === "presence" || event.eventType === "request-offer") {
        upsertPresenceParticipant(event);
        await maybeCreateOffer(event.senderClientId);
        continue;
      }

      if (event.eventType === "offer") {
        upsertPresenceParticipant(event);
        await handleIncomingOffer(event);
        continue;
      }

      if (event.eventType === "answer") {
        await handleIncomingAnswer(event);
        continue;
      }

      if (event.eventType === "ice-candidate") {
        await handleIncomingIceCandidate(event);
        continue;
      }

      if (event.eventType === "leave") {
        removeParticipant(event.senderClientId);
      }
    }

    if (processedEventIdsRef.current.size > 500) {
      processedEventIdsRef.current = new Set(
        Array.from(processedEventIdsRef.current).slice(-300),
      );
    }
  }

  function pruneStaleParticipants(): void {
    let removedAny = false;

    for (const participant of participantsRef.current.values()) {
      if (
        Date.now() - participant.lastSeenAt >
        CONSULTATION_MEETING_PRESENCE_TTL_MS
      ) {
        participantsRef.current.delete(participant.clientId);
        closePeerConnection(participant.clientId, true);
        removedAny = true;
      }
    }

    if (removedAny) {
      syncRemoteParticipantsState();
      syncAggregateConnectionState();
    }
  }

  async function ensureMeshConnections(): Promise<void> {
    for (const participant of participantsRef.current.values()) {
      await maybeCreateOffer(participant.clientId);
    }
  }

  async function restartMeetingRoom(): Promise<void> {
    setRestarting(true);
    setErrorMessage(null);

    try {
      closeAllPeerConnections();
      await publishPresence();
      await ensureMeshConnections();
      setStatusMessage("Meeting room restarted.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to restart the meeting room.",
      );
    } finally {
      setRestarting(false);
    }
  }

  function toggleTrack(kind: "audio" | "video"): void {
    const localStream = localStreamRef.current;

    if (!localStream) {
      return;
    }

    const tracks =
      kind === "audio"
        ? localStream.getAudioTracks()
        : localStream.getVideoTracks();

    if (tracks.length === 0) {
      return;
    }

    const nextEnabled = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    if (kind === "audio") {
      audioEnabledRef.current = nextEnabled;
      setAudioEnabled(nextEnabled);
    } else {
      videoEnabledRef.current = nextEnabled;
      setVideoEnabled(nextEnabled);
    }

    void publishPresence().catch((error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refresh presence.",
      );
    });
  }

  const publishPresenceEvent = useEffectEvent(async () => publishPresence());
  const processIncomingEventsEvent = useEffectEvent(
    async (events: MeetingEventPayload[]) => processIncomingEvents(events),
  );
  const pruneStaleParticipantsEvent = useEffectEvent(() => pruneStaleParticipants());
  const ensureMeshConnectionsEvent = useEffectEvent(async () =>
    ensureMeshConnections(),
  );
  const closeAllPeerConnectionsEvent = useEffectEvent(() =>
    closeAllPeerConnections(),
  );
  const postMeetingEventEvent = useEffectEvent(
    async (input: Parameters<typeof postMeetingEvent>[0]) =>
      postMeetingEvent(input),
  );

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let heartbeatTimer: number | null = null;
    let staleParticipantTimer: number | null = null;
    const remoteStreams = remoteStreamsRef.current;
    const participants = participantsRef.current;
    const pendingIceCandidates = pendingIceCandidatesRef.current;
    const remoteVideoElements = remoteVideoRefs.current;

    async function startLocalMedia(): Promise<void> {
      setErrorMessage(null);
      setAggregateConnectionState("starting");
      setStatusMessage("Requesting camera and microphone access...");

      try {
        let localStream: MediaStream;

        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch (error) {
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          setStatusMessage(
            "Camera access was unavailable, so this meeting is joining with audio only.",
          );
          setCameraAvailable(false);
          videoEnabledRef.current = false;
          setVideoEnabled(false);

          if (!(error instanceof Error)) {
            throw new Error("Unable to access camera and microphone.");
          }
        }

        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = localStream;
        attachLocalStream(localStream);
        setMicrophoneAvailable(localStream.getAudioTracks().length > 0);
        setCameraAvailable(localStream.getVideoTracks().length > 0);
        audioEnabledRef.current = localStream
          .getAudioTracks()
          .every((track) => track.enabled);
        videoEnabledRef.current = localStream.getVideoTracks().length > 0;
        setAudioEnabled(audioEnabledRef.current);
        setVideoEnabled(videoEnabledRef.current);
        setAggregateConnectionState("waiting");
        await publishPresenceEvent();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAggregateConnectionState("failed");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Camera and microphone access is required to join this room.",
        );
      }
    }

    async function pollEvents(): Promise<void> {
      if (cancelled) {
        return;
      }

      try {
        const query = new URLSearchParams({
          role,
          clientId: clientIdRef.current,
        });

        if (latestCursorRef.current) {
          query.set("after", latestCursorRef.current);
        }

        const response = await fetch(
          `/api/consultations/meeting/${consultation.meetingCode}/events?${query.toString()}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          consultationStatus?: ConsultationStatus;
          events?: MeetingEventPayload[];
          cursor?: string | null;
          activeParticipantCount?: number;
          peerLimit?: number;
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to poll meeting events.");
        }

        if (
          payload.consultationStatus &&
          payload.consultationStatus !== consultation.status
        ) {
          onStatusChange(payload.consultationStatus);
        }

        if (payload.cursor) {
          latestCursorRef.current = payload.cursor;
        }

        if (typeof payload.activeParticipantCount === "number") {
          setRoomPopulation(payload.activeParticipantCount);
        }

        if (typeof payload.peerLimit === "number") {
          setRoomPeerLimit(payload.peerLimit);
        }

        await processIncomingEventsEvent(payload.events || []);
        pruneStaleParticipantsEvent();
        await ensureMeshConnectionsEvent();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to keep the meeting synchronized.",
          );
        }
      } finally {
        if (!cancelled) {
          pollTimer = window.setTimeout(() => {
            void pollEvents();
          }, EVENT_POLL_INTERVAL_MS);
        }
      }
    }

    void startLocalMedia();
    void pollEvents();

    heartbeatTimer = window.setInterval(() => {
      void publishPresenceEvent().catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to refresh presence in the meeting room.",
          );
        }
      });
    }, HEARTBEAT_INTERVAL_MS);

    staleParticipantTimer = window.setInterval(() => {
      pruneStaleParticipantsEvent();
    }, 3000);

    return () => {
      cancelled = true;

      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }

      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
      }

      if (staleParticipantTimer) {
        window.clearInterval(staleParticipantTimer);
      }

      void postMeetingEventEvent({
        eventType: "leave",
        payload: buildPresencePayload(),
      }).catch(() => undefined);

      closeAllPeerConnectionsEvent();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      attachLocalStream(null);
      remoteStreams.clear();
      participants.clear();
      pendingIceCandidates.clear();
      remoteVideoElements.clear();
      setRemoteParticipants([]);
    };
  }, [consultation.meetingCode, consultation.status, onStatusChange, role]);

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_0.34fr]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-zinc-950 shadow-xl shadow-zinc-300/30">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="text-xs text-white/65">
                  {isHost ? "You are the host" : "You joined as a guest"}
                </p>
              </div>
              <Badge variant="outline" className="border-white/20 text-white">
                Local
              </Badge>
            </div>
            <div className="relative aspect-video bg-zinc-900">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              {!videoEnabled ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-white">
                  <div className="text-center">
                    <CameraOffIcon className="mx-auto size-6" />
                    <p className="mt-2 text-sm">Camera is off</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {remoteParticipants.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3">
                <div className="flex min-h-64 items-center justify-center rounded-[1.75rem] border border-dashed border-zinc-300 bg-white/80 px-6 py-10 text-center shadow-sm">
                  <div>
                    <UserRoundIcon className="mx-auto size-7 text-zinc-400" />
                    <p className="mt-3 text-sm font-medium text-zinc-700">
                      No remote participants are connected yet
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Share the meeting link and this room will fill in as peers
                      join.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              remoteParticipants.map((participant) => (
                <article
                  key={participant.clientId}
                  className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-xl shadow-zinc-200/40"
                >
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {participant.displayName}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {participant.role === "HOST" ? "Host" : "Guest"} ·{" "}
                        {getParticipantConnectionLabel(participant.connectionState)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        participant.connectionState === "connected"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {participant.connectionState === "connected"
                        ? "Live"
                        : "Waiting"}
                    </Badge>
                  </div>
                  <div className="relative aspect-video bg-zinc-100">
                    <video
                      ref={(element) =>
                        setRemoteVideoElement(participant.clientId, element)
                      }
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    {!participant.videoEnabled ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/55 text-white">
                        <div className="text-center">
                          <CameraOffIcon className="mx-auto size-6" />
                          <p className="mt-2 text-sm">Camera is off</p>
                        </div>
                      </div>
                    ) : null}
                    {!remoteStreamsRef.current
                      .get(participant.clientId)
                      ?.getTracks()
                      .length ? (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                        <div className="text-center">
                          <VideoIcon className="mx-auto size-6" />
                          <p className="mt-2 text-sm">Connecting media...</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </section>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm">
            <Button
              variant={audioEnabled ? "default" : "outline"}
              onClick={() => toggleTrack("audio")}
              disabled={!microphoneAvailable}
            >
              {audioEnabled ? <MicIcon /> : <MicOffIcon />}
              {audioEnabled ? "Mute Mic" : "Unmute Mic"}
            </Button>
            <Button
              variant={videoEnabled ? "default" : "outline"}
              onClick={() => toggleTrack("video")}
              disabled={!cameraAvailable}
            >
              {videoEnabled ? <CameraIcon /> : <CameraOffIcon />}
              {videoEnabled ? "Turn Camera Off" : "Turn Camera On"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void restartMeetingRoom()}
              disabled={restarting}
            >
              <RefreshCwIcon className={restarting ? "animate-spin" : ""} />
              {restarting ? "Restarting..." : "Reconnect Room"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-xl shadow-zinc-200/40">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getAggregateConnectionBadgeVariant(aggregateConnectionState)}>
                {aggregateConnectionState}
              </Badge>
              <Badge variant="outline">
                {formatConsultationStatus(consultation.status)}
              </Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-zinc-900">
              In-house consultation room
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{statusMessage}</p>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-xl shadow-zinc-200/40">
            <div className="flex items-start gap-3">
              <UsersIcon className="mt-0.5 size-4 text-sky-600" />
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Room capacity
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {roomPopulation} of {roomPeerLimit} seats filled.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-xl shadow-zinc-200/40">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 size-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Google ICE defaults
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  This room now defaults to Google STUN servers unless
                  `NEXT_PUBLIC_CONSULTATION_ICE_SERVERS` overrides them.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-xl shadow-zinc-200/40">
            <div className="flex items-start gap-3">
              <VideoIcon className="mt-0.5 size-4 text-violet-600" />
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Your media status
                </p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                  <li>
                    You: {audioEnabled ? "Mic on" : "Mic off"} ·{" "}
                    {videoEnabled ? "Camera on" : "Camera off"}
                  </li>
                  <li>
                    Connected peers:{" "}
                    {
                      remoteParticipants.filter(
                        (participant) =>
                          participant.connectionState === "connected",
                      ).length
                    }
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
