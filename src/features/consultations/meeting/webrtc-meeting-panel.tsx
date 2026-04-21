"use client";

import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  CameraIcon,
  CameraOffIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  MonitorOffIcon,
  PanelRightIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CONSULTATION_MEETING_PRESENCE_TTL_MS,
  formatConsultationStatus,
  type ConsultationMeetingPayload,
  type ConsultationMeetingRole,
  type ConsultationStatus,
} from "@/features/consultations/lib/shared";

const EVENT_POLL_INTERVAL_MS = 1500;
const IDLE_POLL_INTERVAL_MS = 3500;
const HIDDEN_POLL_INTERVAL_MS = 7000;
const HEARTBEAT_INTERVAL_MS = 8000;
const OFFER_THROTTLE_MS = 1200;
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
type LayoutMode = "grid" | "focus" | "sidebar";
type RightPanelMode = "participants" | "chat";
type StreamKind = "camera" | "screen";

interface RemoteParticipantState {
  clientId: string;
  displayName: string;
  role: ConsultationMeetingRole;
  audioEnabled: boolean;
  videoEnabled: boolean;
  lastSeenAt: number;
  connectionState: RTCPeerConnectionState | "waiting";
}

interface RemoteStreamEntry {
  stream: MediaStream;
  kind: StreamKind;
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

interface ChatMessage {
  id: string;
  senderClientId: string;
  senderName: string;
  senderRole: ConsultationMeetingRole;
  text: string;
  sentAt: number;
  self: boolean;
}

interface ChatControlPayload {
  type: "chat-message";
  id: string;
  senderClientId: string;
  senderName: string;
  senderRole: ConsultationMeetingRole;
  text: string;
  sentAt: number;
}

interface ScreenControlPayload {
  type: "screen-share";
  action: "start" | "stop";
  senderClientId: string;
  streamId: string;
}

type DataChannelPayload = ChatControlPayload | ScreenControlPayload;

interface MediaTile {
  tileId: string;
  ownerClientId: string;
  ownerName: string;
  ownerRole: ConsultationMeetingRole;
  isLocal: boolean;
  kind: StreamKind;
  stream: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionState: RTCPeerConnectionState | "waiting" | "connected";
}

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `client-${Math.random().toString(36).slice(2, 12)}`;
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `msg-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;
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

function getLayoutButtonVariant(active: boolean) {
  return active ? ("default" as const) : ("outline" as const);
}

function buildRemoteTileId(clientId: string, streamId: string): string {
  return `remote:${clientId}:${streamId}`;
}

function parseRemoteTileId(tileId: string): { clientId: string; streamId: string } | null {
  if (!tileId.startsWith("remote:")) {
    return null;
  }

  const parts = tileId.split(":");

  if (parts.length < 3) {
    return null;
  }

  return {
    clientId: parts[1] ?? "",
    streamId: parts.slice(2).join(":"),
  };
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
  const localScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamIdRef = useRef<string | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, Map<string, RemoteStreamEntry>>>(
    new Map(),
  );
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const participantsRef = useRef<Map<string, RemoteParticipantState>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const latestCursorRef = useRef<string | null>(null);
  const displayNameRef = useRef(displayName);
  const audioEnabledRef = useRef(true);
  const videoEnabledRef = useRef(true);
  const chatMessageIdsRef = useRef<Set<string>>(new Set());
  const offerThrottleByClientRef = useRef<Map<string, number>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const screenShareByClientRef = useRef<Map<string, string>>(new Map());
  const localScreenSendersRef = useRef<Map<string, RTCRtpSender[]>>(new Map());
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenParticipants, setRemoteScreenParticipants] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("participants");
  const [pinnedTileId, setPinnedTileId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  displayNameRef.current = displayName;
  audioEnabledRef.current = audioEnabled;
  videoEnabledRef.current = videoEnabled;

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  function syncRemoteParticipantsState(): void {
    const uniqueByClientId = new Map<string, RemoteParticipantState>();

    for (const participant of participantsRef.current.values()) {
      if (!uniqueByClientId.has(participant.clientId)) {
        uniqueByClientId.set(participant.clientId, participant);
      }
    }

    setRemoteParticipants(sortParticipants(uniqueByClientId.values()));
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
      connectionStates.some((state) => state === "connecting" || state === "new")
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

  function syncRemoteScreenParticipants(): void {
    setRemoteScreenParticipants(Array.from(screenShareByClientRef.current.keys()));
  }

  function attachLocalStream(stream: MediaStream | null): void {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }

  function setLocalVideoElement(element: HTMLVideoElement | null): void {
    localVideoRef.current = element;

    if (element) {
      element.srcObject = localStreamRef.current;
    }
  }

  function attachLocalScreenStream(stream: MediaStream | null): void {
    if (localScreenVideoRef.current) {
      localScreenVideoRef.current.srcObject = stream;
    }
  }

  function setLocalScreenVideoElement(element: HTMLVideoElement | null): void {
    localScreenVideoRef.current = element;

    if (element) {
      element.srcObject = localScreenStreamRef.current;
    }
  }

  function getStreamForTile(tileId: string): MediaStream | null {
    if (tileId === "local:camera") {
      return localStreamRef.current;
    }

    if (tileId === "local:screen") {
      return localScreenStreamRef.current;
    }

    const parsed = parseRemoteTileId(tileId);

    if (!parsed) {
      return null;
    }

    return remoteStreamsRef.current
      .get(parsed.clientId)
      ?.get(parsed.streamId)?.stream ?? null;
  }

  function setRemoteVideoElement(tileId: string, element: HTMLVideoElement | null): void {
    if (element) {
      remoteVideoRefs.current.set(tileId, element);
      element.srcObject = getStreamForTile(tileId);
      return;
    }

    remoteVideoRefs.current.delete(tileId);
  }

  function attachRemoteStream(tileId: string, stream: MediaStream | null): void {
    const element = remoteVideoRefs.current.get(tileId);

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
      | "screen-share-started"
      | "screen-share-stopped"
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
      screenSharing: Boolean(localScreenStreamRef.current),
      screenStreamId: localScreenStreamIdRef.current,
    };
  }

  async function publishPresence(): Promise<void> {
    await postMeetingEvent({
      eventType: "presence",
      payload: buildPresencePayload(),
    });
  }

  function getOrCreateRemoteStreamMap(clientId: string): Map<string, RemoteStreamEntry> {
    const existing = remoteStreamsRef.current.get(clientId);

    if (existing) {
      return existing;
    }

    const created = new Map<string, RemoteStreamEntry>();
    remoteStreamsRef.current.set(clientId, created);
    return created;
  }

  function syncRemoteMediaElements(clientId: string): void {
    const streamMap = remoteStreamsRef.current.get(clientId);

    if (!streamMap) {
      return;
    }

    for (const [streamId, entry] of streamMap.entries()) {
      attachRemoteStream(buildRemoteTileId(clientId, streamId), entry.stream);
    }
  }

  function upsertRemoteStream(
    clientId: string,
    stream: MediaStream,
    kind: StreamKind,
  ): void {
    const streamMap = getOrCreateRemoteStreamMap(clientId);
    const existing = streamMap.get(stream.id);

    if (!existing) {
      streamMap.set(stream.id, {
        stream,
        kind,
      });
      attachRemoteStream(buildRemoteTileId(clientId, stream.id), stream);
      return;
    }

    existing.kind = kind;
    existing.stream = stream;
    streamMap.set(stream.id, existing);
    attachRemoteStream(buildRemoteTileId(clientId, stream.id), stream);
  }

  function removeRemoteScreenStreams(clientId: string): void {
    const streamMap = remoteStreamsRef.current.get(clientId);

    if (!streamMap) {
      return;
    }

    for (const [streamId, entry] of streamMap.entries()) {
      if (entry.kind !== "screen") {
        continue;
      }

      streamMap.delete(streamId);
      attachRemoteStream(buildRemoteTileId(clientId, streamId), null);
      remoteVideoRefs.current.delete(buildRemoteTileId(clientId, streamId));
    }

    if (streamMap.size === 0) {
      remoteStreamsRef.current.delete(clientId);
    }
  }

  function closeDataChannel(clientId: string): void {
    const channel = dataChannelsRef.current.get(clientId);

    if (!channel) {
      return;
    }

    try {
      channel.onopen = null;
      channel.onclose = null;
      channel.onerror = null;
      channel.onmessage = null;
      channel.close();
    } catch {
      // Ignore close races.
    }

    dataChannelsRef.current.delete(clientId);
  }

  function closePeerConnection(clientId: string, removeMedia = false): void {
    const peerConnection = peerConnectionsRef.current.get(clientId);

    closeDataChannel(clientId);

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.ondatachannel = null;
      peerConnection.close();
      peerConnectionsRef.current.delete(clientId);
    }

    pendingIceCandidatesRef.current.delete(clientId);
    localScreenSendersRef.current.delete(clientId);

    if (removeMedia) {
      const streamMap = remoteStreamsRef.current.get(clientId);

      if (streamMap) {
        for (const streamId of streamMap.keys()) {
          attachRemoteStream(buildRemoteTileId(clientId, streamId), null);
        }
      }

      screenShareByClientRef.current.delete(clientId);
      remoteStreamsRef.current.delete(clientId);
      syncRemoteScreenParticipants();
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

  function applyIncomingDataMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as DataChannelPayload;

      if (parsed.type === "chat-message") {
        if (chatMessageIdsRef.current.has(parsed.id)) {
          return;
        }

        chatMessageIdsRef.current.add(parsed.id);
        setChatMessages((messages) =>
          [...messages, {
            id: parsed.id,
            senderClientId: parsed.senderClientId,
            senderName: parsed.senderName,
            senderRole: parsed.senderRole,
            text: parsed.text,
            sentAt: parsed.sentAt,
            self: parsed.senderClientId === clientIdRef.current,
          }].sort((left, right) => left.sentAt - right.sentAt),
        );
        return;
      }

      if (parsed.type === "screen-share") {
        if (parsed.action === "start") {
          screenShareByClientRef.current.set(parsed.senderClientId, parsed.streamId);
          syncRemoteScreenParticipants();
          return;
        }

        screenShareByClientRef.current.delete(parsed.senderClientId);
        removeRemoteScreenStreams(parsed.senderClientId);
        syncRemoteScreenParticipants();
      }
    } catch {
      // Ignore malformed datachannel messages from peers.
    }
  }

  function setupDataChannel(clientId: string, channel: RTCDataChannel): void {
    dataChannelsRef.current.set(clientId, channel);

    channel.onopen = () => {
      if (localScreenStreamRef.current && localScreenStreamIdRef.current) {
        const payload: ScreenControlPayload = {
          type: "screen-share",
          action: "start",
          senderClientId: clientIdRef.current,
          streamId: localScreenStreamIdRef.current,
        };

        channel.send(JSON.stringify(payload));
      }
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        applyIncomingDataMessage(event.data);
      }
    };

    channel.onclose = () => {
      dataChannelsRef.current.delete(clientId);
    };

    channel.onerror = () => {
      dataChannelsRef.current.delete(clientId);
    };
  }

  function createPeerConnection(clientId: string): RTCPeerConnection {
    const existing = peerConnectionsRef.current.get(clientId);

    if (existing) {
      return existing;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: getIceServers(),
    });
    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    const localScreenStream = localScreenStreamRef.current;

    if (localScreenStream) {
      const screenSenders = localScreenStream.getTracks().map((track) =>
        peerConnection.addTrack(track, localScreenStream),
      );
      localScreenSendersRef.current.set(clientId, screenSenders);
    }

    peerConnection.ontrack = (event) => {
      const participantScreenStreamId = screenShareByClientRef.current.get(clientId);

      event.streams.forEach((stream) => {
        const inferredKind: StreamKind =
          participantScreenStreamId && participantScreenStreamId === stream.id
            ? "screen"
            : "camera";
        upsertRemoteStream(clientId, stream, inferredKind);
      });
    };

    peerConnection.ondatachannel = (event) => {
      setupDataChannel(clientId, event.channel);
    };

    if (shouldInitiateOffer(clientIdRef.current, clientId)) {
      const outgoingChannel = peerConnection.createDataChannel("consultation-chat", {
        ordered: true,
      });
      setupDataChannel(clientId, outgoingChannel);
    }

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

  async function maybeCreateOffer(
    clientId: string,
    options?: { force?: boolean },
  ): Promise<void> {
    const force = options?.force ?? false;

    if (!shouldInitiateOffer(clientIdRef.current, clientId)) {
      return;
    }

    const peerConnection = createPeerConnection(clientId);

    if (
      !force &&
      (peerConnection.connectionState === "connected" ||
        (peerConnection.currentLocalDescription &&
          peerConnection.currentRemoteDescription))
    ) {
      return;
    }

    if (peerConnection.signalingState !== "stable") {
      return;
    }

    const now = Date.now();
    const lastOfferAt = offerThrottleByClientRef.current.get(clientId) ?? 0;

    if (now - lastOfferAt < OFFER_THROTTLE_MS) {
      return;
    }

    offerThrottleByClientRef.current.set(clientId, now);

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
            screenSharing?: boolean;
            screenStreamId?: string;
          })
        : {};
    const currentParticipant = participantsRef.current.get(event.senderClientId);

    if (payload.screenSharing && payload.screenStreamId) {
      screenShareByClientRef.current.set(event.senderClientId, payload.screenStreamId);
    }

    if (!payload.screenSharing) {
      screenShareByClientRef.current.delete(event.senderClientId);
      removeRemoteScreenStreams(event.senderClientId);
    }

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
    syncRemoteScreenParticipants();
  }

  function removeParticipant(clientId: string): void {
    participantsRef.current.delete(clientId);
    closePeerConnection(clientId, true);
    syncRemoteParticipantsState();
    syncAggregateConnectionState();
    syncRemoteScreenParticipants();

    setPinnedTileId((current) => {
      if (!current?.startsWith(`remote:${clientId}:`)) {
        return current;
      }

      return null;
    });
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
      const queue = pendingIceCandidatesRef.current.get(event.senderClientId) || [];
      queue.push(candidate);
      pendingIceCandidatesRef.current.set(event.senderClientId, queue);
      return;
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  function applyScreenShareStart(clientId: string, payload: unknown): void {
    const streamId =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { streamId?: string }).streamId
        : null;

    if (!streamId) {
      return;
    }

    screenShareByClientRef.current.set(clientId, streamId);
    const streamEntry = remoteStreamsRef.current.get(clientId)?.get(streamId);

    if (streamEntry) {
      streamEntry.kind = "screen";
      remoteStreamsRef.current.get(clientId)?.set(streamId, streamEntry);
      syncRemoteMediaElements(clientId);
    }

    syncRemoteScreenParticipants();
  }

  function applyScreenShareStop(clientId: string): void {
    screenShareByClientRef.current.delete(clientId);
    removeRemoteScreenStreams(clientId);
    syncRemoteScreenParticipants();
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

      if (event.eventType === "screen-share-started") {
        upsertPresenceParticipant(event);
        applyScreenShareStart(event.senderClientId, event.payload);
        continue;
      }

      if (event.eventType === "screen-share-stopped") {
        applyScreenShareStop(event.senderClientId);
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
      syncRemoteScreenParticipants();
    }
  }

  async function ensureMeshConnections(): Promise<void> {
    for (const participant of participantsRef.current.values()) {
      await maybeCreateOffer(participant.clientId, { force: false });
    }
  }

  function broadcastDataChannel(payload: DataChannelPayload): void {
    const serialized = JSON.stringify(payload);

    for (const channel of dataChannelsRef.current.values()) {
      if (channel.readyState !== "open") {
        continue;
      }

      channel.send(serialized);
    }
  }

  async function renegotiateAllPeers(): Promise<void> {
    for (const participant of participantsRef.current.values()) {
      await maybeCreateOffer(participant.clientId, { force: true });
    }
  }

  async function startScreenShare(): Promise<void> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setErrorMessage("Screen sharing is not supported in this browser.");
      return;
    }

    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Unable to start screen sharing.");
      }

      localScreenStreamRef.current = stream;
      localScreenStreamIdRef.current = stream.id;
      attachLocalScreenStream(stream);
      setIsScreenSharing(true);

      for (const [clientId, peerConnection] of peerConnectionsRef.current.entries()) {
        const senders = stream.getTracks().map((track) =>
          peerConnection.addTrack(track, stream),
        );
        localScreenSendersRef.current.set(clientId, senders);
      }

      videoTrack.onended = () => {
        void stopScreenShare();
      };

      await postMeetingEvent({
        eventType: "screen-share-started",
        payload: {
          streamId: stream.id,
        },
      });

      broadcastDataChannel({
        type: "screen-share",
        action: "start",
        senderClientId: clientIdRef.current,
        streamId: stream.id,
      });

      await publishPresence();
      await renegotiateAllPeers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start screen sharing.",
      );
    }
  }

  async function stopScreenShare(): Promise<void> {
    const localScreenStream = localScreenStreamRef.current;

    if (!localScreenStream) {
      return;
    }

    const screenId = localScreenStreamIdRef.current;

    for (const [clientId, peerConnection] of peerConnectionsRef.current.entries()) {
      const senders = localScreenSendersRef.current.get(clientId) || [];

      senders.forEach((sender) => {
        try {
          peerConnection.removeTrack(sender);
        } catch {
          // Ignore sender cleanup races.
        }
      });
    }

    localScreenSendersRef.current.clear();
    localScreenStream.getTracks().forEach((track) => track.stop());
    localScreenStreamRef.current = null;
    localScreenStreamIdRef.current = null;
    attachLocalScreenStream(null);
    setIsScreenSharing(false);

    if (screenId) {
      await postMeetingEvent({
        eventType: "screen-share-stopped",
        payload: {
          streamId: screenId,
        },
      }).catch(() => undefined);

      broadcastDataChannel({
        type: "screen-share",
        action: "stop",
        senderClientId: clientIdRef.current,
        streamId: screenId,
      });
    }

    await publishPresence().catch(() => undefined);
    await renegotiateAllPeers().catch(() => undefined);
  }

  async function toggleScreenShare(): Promise<void> {
    if (localScreenStreamRef.current) {
      await stopScreenShare();
      return;
    }

    await startScreenShare();
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

  function handleSendChat(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const value = chatInput.trim();

    if (!value) {
      return;
    }

    const message: ChatMessage = {
      id: createMessageId(),
      senderClientId: clientIdRef.current,
      senderName: displayNameRef.current,
      senderRole: role,
      text: value,
      sentAt: Date.now(),
      self: true,
    };

    chatMessageIdsRef.current.add(message.id);
    setChatMessages((messages) => [...messages, message]);
    setChatInput("");

    const payload: ChatControlPayload = {
      type: "chat-message",
      id: message.id,
      senderClientId: message.senderClientId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      text: message.text,
      sentAt: message.sentAt,
    };

    broadcastDataChannel(payload);
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
    const participants = participantsRef.current;
    const pendingIceCandidates = pendingIceCandidatesRef.current;
    const remoteVideoElements = remoteVideoRefs.current;
    const dataChannels = dataChannelsRef.current;
    const screenShareByClient = screenShareByClientRef.current;

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
          const hasActivePeers = participantsRef.current.size > 0;
          const nextPollInterval =
            document.visibilityState === "hidden"
              ? HIDDEN_POLL_INTERVAL_MS
              : hasActivePeers
                ? EVENT_POLL_INTERVAL_MS
                : IDLE_POLL_INTERVAL_MS;

          pollTimer = window.setTimeout(() => {
            void pollEvents();
          }, nextPollInterval);
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
      localScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
      localScreenStreamRef.current = null;
      localScreenStreamIdRef.current = null;
      attachLocalScreenStream(null);
      participants.clear();
      pendingIceCandidates.clear();
      remoteVideoElements.clear();
      dataChannels.clear();
      screenShareByClient.clear();
      setRemoteParticipants([]);
      setRemoteScreenParticipants([]);
      setIsScreenSharing(false);
    };
  }, [consultation.meetingCode, consultation.status, onStatusChange, role]);

  const mediaTiles = useMemo<MediaTile[]>(() => {
    const tiles: MediaTile[] = [];

    if (localStreamRef.current) {
      tiles.push({
        tileId: "local:camera",
        ownerClientId: clientIdRef.current,
        ownerName: displayName,
        ownerRole: role,
        isLocal: true,
        kind: "camera",
        stream: localStreamRef.current,
        audioEnabled,
        videoEnabled,
        connectionState: "connected",
      });
    }

    if (localScreenStreamRef.current) {
      tiles.push({
        tileId: "local:screen",
        ownerClientId: clientIdRef.current,
        ownerName: displayName,
        ownerRole: role,
        isLocal: true,
        kind: "screen",
        stream: localScreenStreamRef.current,
        audioEnabled,
        videoEnabled: true,
        connectionState: "connected",
      });
    }

    for (const participant of remoteParticipants) {
      const streamMap = remoteStreamsRef.current.get(participant.clientId);

      if (!streamMap) {
        continue;
      }

      for (const [streamId, entry] of streamMap.entries()) {
        tiles.push({
          tileId: buildRemoteTileId(participant.clientId, streamId),
          ownerClientId: participant.clientId,
          ownerName: participant.displayName,
          ownerRole: participant.role,
          isLocal: false,
          kind: entry.kind,
          stream: entry.stream,
          audioEnabled: participant.audioEnabled,
          videoEnabled: participant.videoEnabled,
          connectionState: participant.connectionState,
        });
      }
    }

    return tiles.sort((left, right) => {
      if (left.isLocal !== right.isLocal) {
        return left.isLocal ? -1 : 1;
      }

      if (left.ownerRole !== right.ownerRole) {
        return left.ownerRole === "HOST" ? -1 : 1;
      }

      if (left.kind !== right.kind) {
        return left.kind === "screen" ? -1 : 1;
      }

      return left.ownerName.localeCompare(right.ownerName);
    });
  }, [
    audioEnabled,
    displayName,
    isScreenSharing,
    remoteParticipants,
    role,
    videoEnabled,
  ]);

  const uniqueRemoteParticipants = useMemo(() => {
    const uniqueById = new Map<string, RemoteParticipantState>();

    for (const participant of remoteParticipants) {
      if (!uniqueById.has(participant.clientId)) {
        uniqueById.set(participant.clientId, participant);
      }
    }

    return Array.from(uniqueById.values());
  }, [remoteParticipants]);

  const activeTileId =
    pinnedTileId && mediaTiles.some((tile) => tile.tileId === pinnedTileId)
      ? pinnedTileId
      : mediaTiles.find((tile) => tile.kind === "screen")?.tileId ||
        mediaTiles[0]?.tileId ||
        null;

  function renderTile(tile: MediaTile, emphasize = false) {
    const isPinned = pinnedTileId === tile.tileId;
    const isCameraVisible = tile.kind === "screen" ? true : tile.videoEnabled;
    const showNoMediaOverlay = !tile.stream.getTracks().length;

    return (
      <article
        key={tile.tileId}
        className={[
          "overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/90 shadow-2xl shadow-black/30",
          emphasize ? "min-h-96" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{tile.ownerName}</p>
              {tile.ownerRole === "HOST" ? (
                <Badge className="border-emerald-400/40 bg-emerald-500/20 text-emerald-100">
                  Host
                </Badge>
              ) : null}
              {tile.kind === "screen" ? (
                <Badge variant="outline" className="border-white/25 text-white/90">
                  Screen Share
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-white/60">
              {tile.isLocal ? "You" : getParticipantConnectionLabel(tile.connectionState)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                tile.audioEnabled
                  ? "bg-emerald-500/20 text-emerald-100"
                  : "bg-red-500/20 text-red-100",
              ].join(" ")}
            >
              {tile.audioEnabled ? <MicIcon className="size-3" /> : <MicOffIcon className="size-3" />}
            </span>
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                tile.kind === "screen" || tile.videoEnabled
                  ? "bg-sky-500/20 text-sky-100"
                  : "bg-zinc-500/30 text-zinc-100",
              ].join(" ")}
            >
              {tile.kind === "screen" || tile.videoEnabled ? (
                <CameraIcon className="size-3" />
              ) : (
                <CameraOffIcon className="size-3" />
              )}
            </span>
            <Button
              variant="outline"
              className="h-8 border-white/20 bg-transparent px-2 text-white hover:bg-white/10"
              onClick={() => setPinnedTileId((current) => (current === tile.tileId ? null : tile.tileId))}
            >
              {isPinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
            </Button>
          </div>
        </div>
        <div className="relative aspect-video bg-zinc-950">
          {tile.isLocal ? (
            <video
              ref={
                tile.kind === "screen"
                  ? setLocalScreenVideoElement
                  : setLocalVideoElement
              }
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={(element) => setRemoteVideoElement(tile.tileId, element)}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          )}
          {!isCameraVisible ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/85 text-white">
              <div className="text-center">
                <CameraOffIcon className="mx-auto size-6" />
                <p className="mt-2 text-sm">Camera is off</p>
              </div>
            </div>
          ) : null}
          {showNoMediaOverlay ? (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <div className="text-center">
                <VideoIcon className="mx-auto size-6" />
                <p className="mt-2 text-sm">Connecting media...</p>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-950/95 text-zinc-100 shadow-2xl shadow-black/40">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={getAggregateConnectionBadgeVariant(aggregateConnectionState)}
            className="border-zinc-700 bg-zinc-900 text-zinc-200"
          >
            {aggregateConnectionState}
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-300">
            {formatConsultationStatus(consultation.status)}
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-300">
            {roomPopulation} / {roomPeerLimit} Participants
          </Badge>
          <p className="truncate text-sm text-zinc-400">{statusMessage}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={getLayoutButtonVariant(layoutMode === "grid")}
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => setLayoutMode("grid")}
          >
            <LayoutGridIcon className="size-4" />
            Grid
          </Button>
          <Button
            variant={getLayoutButtonVariant(layoutMode === "focus")}
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => setLayoutMode("focus")}
          >
            <PinIcon className="size-4" />
            Focus
          </Button>
          <Button
            variant={getLayoutButtonVariant(layoutMode === "sidebar")}
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => setLayoutMode("sidebar")}
          >
            <PanelRightIcon className="size-4" />
            Sidebar
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100 sm:mx-5">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_20rem] sm:p-4">
        <section className="min-h-0 overflow-auto rounded-2xl bg-zinc-900/55 p-2">
          {mediaTiles.length === 0 ? (
            <div className="flex min-h-112 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/80 px-6 py-10 text-center">
              <div>
                <UserRoundIcon className="mx-auto size-7 text-zinc-500" />
                <p className="mt-3 text-sm font-medium text-zinc-200">
                  No participants are connected yet
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Share the meeting link and this room will fill in as peers join.
                </p>
              </div>
            </div>
          ) : layoutMode === "focus" ? (
            <div className="space-y-3">
              {activeTileId
                ? renderTile(
                    mediaTiles.find((tile) => tile.tileId === activeTileId) ?? mediaTiles[0],
                    true,
                  )
                : null}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {mediaTiles
                  .filter((tile) => tile.tileId !== activeTileId)
                  .map((tile) => renderTile(tile))}
              </div>
            </div>
          ) : layoutMode === "sidebar" ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div>
                {activeTileId
                  ? renderTile(
                      mediaTiles.find((tile) => tile.tileId === activeTileId) ?? mediaTiles[0],
                      true,
                    )
                  : null}
              </div>
              <div className="space-y-3">
                {mediaTiles
                  .filter((tile) => tile.tileId !== activeTileId)
                  .map((tile) => renderTile(tile))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {mediaTiles.map((tile) => renderTile(tile))}
            </div>
          )}
        </section>

        <aside className="min-h-0 space-y-3 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/85 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Meeting Panel
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant={rightPanelMode === "participants" ? "default" : "outline"}
                size="sm"
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => setRightPanelMode("participants")}
              >
                <UsersIcon className="size-4" />
                People
              </Button>
              <Button
                variant={rightPanelMode === "chat" ? "default" : "outline"}
                size="sm"
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => setRightPanelMode("chat")}
              >
                <MessageSquareIcon className="size-4" />
                Chat
              </Button>
            </div>
          </div>

          {rightPanelMode === "participants" ? (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{displayName}</p>
                    <p className="text-xs text-zinc-500">You {isHost ? "(Host)" : "(Guest)"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHost ? (
                      <Badge className="border-emerald-500/40 bg-emerald-500/20 text-emerald-200">
                        Host
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                      You
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                  {audioEnabled ? <MicIcon className="size-3.5" /> : <MicOffIcon className="size-3.5" />}
                  {videoEnabled ? <CameraIcon className="size-3.5" /> : <CameraOffIcon className="size-3.5" />}
                  {isScreenSharing ? <MonitorIcon className="size-3.5" /> : <MonitorOffIcon className="size-3.5" />}
                </div>
              </div>

              {uniqueRemoteParticipants.length === 0 ? (
                <p className="text-sm text-zinc-400">No remote participants yet.</p>
              ) : (
                uniqueRemoteParticipants.map((participant) => (
                  <div
                    key={participant.clientId}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{participant.displayName}</p>
                        <p className="text-xs text-zinc-500">
                          {participant.role === "HOST" ? "Host" : "Guest"} · {getParticipantConnectionLabel(participant.connectionState)}
                        </p>
                      </div>
                      {participant.role === "HOST" ? (
                        <Badge className="border-emerald-500/40 bg-emerald-500/20 text-emerald-200">
                          Host
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                      {participant.audioEnabled ? <MicIcon className="size-3.5" /> : <MicOffIcon className="size-3.5" />}
                      {participant.videoEnabled ? <CameraIcon className="size-3.5" /> : <CameraOffIcon className="size-3.5" />}
                      {remoteScreenParticipants.includes(participant.clientId) ? (
                        <MonitorIcon className="size-3.5" />
                      ) : (
                        <MonitorOffIcon className="size-3.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-zinc-300">
                <MessageSquareIcon className="size-4" />
                <p className="text-sm font-medium">In-meeting chat (WebRTC only)</p>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/85 p-3">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-zinc-400">No messages yet.</p>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        "rounded-xl px-3 py-2 text-sm",
                        message.self
                          ? "ml-6 bg-sky-700 text-sky-50"
                          : "mr-6 border border-zinc-700 bg-zinc-900 text-zinc-100",
                      ].join(" ")}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] opacity-80">
                        <span>
                          {message.senderName}
                          {message.senderRole === "HOST" ? " (Host)" : ""}
                        </span>
                        <span>
                          {new Date(message.sentAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <form className="flex items-center gap-2" onSubmit={handleSendChat}>
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a message"
                  maxLength={1200}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-sky-700 text-white hover:bg-sky-600"
                >
                  <SendIcon className="size-4" />
                  Send
                </Button>
              </form>
              <p className="text-xs text-zinc-500">
                Chat messages stay in memory only and are not stored on the server.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 size-4 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-zinc-200">Signaling defaults</p>
                <p className="mt-1 text-sm text-zinc-500">
                  This room defaults to Google STUN servers unless
                  NEXT_PUBLIC_CONSULTATION_ICE_SERVERS overrides them.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="border-t border-zinc-800 px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2">
          <Button
            variant={audioEnabled ? "default" : "outline"}
            className={audioEnabled ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"}
            onClick={() => toggleTrack("audio")}
            disabled={!microphoneAvailable}
          >
            {audioEnabled ? <MicIcon /> : <MicOffIcon />}
            {audioEnabled ? "Mute" : "Unmute"}
          </Button>
          <Button
            variant={videoEnabled ? "default" : "outline"}
            className={videoEnabled ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"}
            onClick={() => toggleTrack("video")}
            disabled={!cameraAvailable}
          >
            {videoEnabled ? <CameraIcon /> : <CameraOffIcon />}
            {videoEnabled ? "Stop Video" : "Start Video"}
          </Button>
          <Button
            variant={isScreenSharing ? "default" : "outline"}
            className={isScreenSharing ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400" : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"}
            onClick={() => void toggleScreenShare()}
          >
            {isScreenSharing ? <MonitorOffIcon /> : <MonitorIcon />}
            {isScreenSharing ? "Stop Share" : "Share Screen"}
          </Button>
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => void restartMeetingRoom()}
            disabled={restarting}
          >
            <RefreshCwIcon className={restarting ? "animate-spin" : ""} />
            {restarting ? "Reconnecting..." : "Reconnect"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
