import {
  CalendarIcon,
  CalendarDaysIcon,
  InboxIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { stripHtml } from "@/lib/email-helpers";

export type DashboardTab =
  | "inboxes"
  | "users"
  | "consultations"
  | "callendar"
  | "activity"
  | "settings";
export type MailFolder = "inbox" | "sent";
export type UsersStatusFilter = "all" | "active" | "inactive";

export interface Mailbox {
  id: string;
  passportId: string;
  emailAddress: string;
  label: string | null;
  isActive: boolean;
  inboxCount: number;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailAttachment {
  id: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  hasDownload: boolean;
  downloadPath: string;
}

export interface EmailRecord {
  id: string;
  kind: "inbound" | "sent";
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  preview: string;
  textBody: string | null;
  htmlBody: string | null;
  createdAt: string;
  status?: string;
  isRead: boolean;
  attachments: EmailAttachment[];
}

export const MAILBOX_EMAIL_DOMAIN = "jatts.ca";
export const USERS_PAGE_SIZE = 8;

export const workspaceOptions = [
  {
    id: "primary",
    title: "Primary Workspace",
    description: "Default account context",
  },
  {
    id: "ops",
    title: "Operations Workspace",
    description: "High-priority queue routing",
  },
  {
    id: "audit",
    title: "Audit Workspace",
    description: "Compliance review mode",
  },
] as const;

export const navTabs: Array<{
  id: DashboardTab;
  title: string;
  icon: typeof InboxIcon;
  href: string;
}> = [
  {
    id: "inboxes",
    title: "Inboxes",
    icon: InboxIcon,
    href: "/dashboard",
  },
  {
    id: "users",
    title: "Users",
    icon: UsersIcon,
    href: "/dashboard/users",
  },
  {
    id: "consultations",
    title: "Consultations",
    icon: CalendarDaysIcon,
    href: "/dashboard/consultations",
  },
  {
    id: "callendar",
    title: "Callendar",
    icon: CalendarIcon,
    href: "/dashboard/callendar",
  },
  {
    id: "activity",
    title: "Activity",
    icon: WorkflowIcon,
    href: "/dashboard/activity",
  },
];

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatBytes(sizeBytes: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return "0 B";
  }

  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(sizeBytes) / Math.log(1024)),
  );
  const value = sizeBytes / 1024 ** index;

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[index]}`;
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeThreadSubject(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/g, "")
    .trim();
}

export function getEmailParticipants(email: EmailRecord): Set<string> {
  return new Set(
    [email.from, ...email.to, ...email.cc, ...email.bcc]
      .map(normalizeAddress)
      .filter(Boolean),
  );
}

export function getChatMessageBody(email: EmailRecord): string {
  const textBody = email.textBody?.trim();
  if (textBody) {
    return textBody;
  }

  const htmlText = stripHtml(email.htmlBody || "").trim();
  if (htmlText) {
    return htmlText;
  }

  return email.preview || "(No message body)";
}

export function isLikelySameThread(
  anchor: EmailRecord,
  candidate: EmailRecord,
): boolean {
  if (anchor.id === candidate.id) {
    return true;
  }

  const anchorSubject = normalizeThreadSubject(anchor.subject || "");
  const candidateSubject = normalizeThreadSubject(candidate.subject || "");

  if (anchorSubject && candidateSubject && anchorSubject === candidateSubject) {
    return true;
  }

  const anchorParticipants = getEmailParticipants(anchor);
  const candidateParticipants = getEmailParticipants(candidate);

  let overlap = 0;
  for (const participant of candidateParticipants) {
    if (anchorParticipants.has(participant)) {
      overlap += 1;
    }

    if (overlap >= 2) {
      return true;
    }
  }

  return false;
}

function slugMailboxPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export function buildMailboxEmailFromIdentity(
  name: string,
  passportId: string,
): string {
  const namePart = slugMailboxPart(name) || "mailbox";
  const passportPart = slugMailboxPart(passportId) || "user";
  return `${namePart}.${passportPart}@${MAILBOX_EMAIL_DOMAIN}`;
}
