"use client";

import {
  ArchiveIcon,
  AtSignIcon,
  CheckCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  InboxIcon,
  LogOutIcon,
  MailIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendHorizontalIcon,
  StarIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import {
  type DashboardTab,
  formatBytes,
  formatTimestamp,
  getChatMessageBody,
  getEmailParticipants,
  type Mailbox,
  USERS_PAGE_SIZE,
} from "@/components/dashboard/dashboard-shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildSnippet } from "@/lib/email-helpers";
import { cn } from "@/lib/utils";

interface DashboardClientProps {
  tab: DashboardTab;
}

const INBOX_AVATAR_TONES = [
  "bg-violet-500/85 text-white",
  "bg-sky-500/85 text-white",
  "bg-emerald-500/85 text-white",
  "bg-amber-500/85 text-[#101319]",
  "bg-rose-500/85 text-white",
  "bg-indigo-500/85 text-white",
] as const;

const MAIL_LABELS = [
  { label: "Projects", color: "bg-violet-500" },
  { label: "Clients", color: "bg-emerald-500" },
  { label: "Personal", color: "bg-orange-500" },
  { label: "Invoices", color: "bg-sky-500" },
  { label: "Travel", color: "bg-pink-500" },
] as const;

function getTone(seed: string): (typeof INBOX_AVATAR_TONES)[number] {
  const hash = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return INBOX_AVATAR_TONES[hash % INBOX_AVATAR_TONES.length];
}

function getInitials(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "IR";
  }

  if (normalized.includes("@")) {
    return normalized
      .split("@")[0]
      .split(/[._\-\s]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function splitAddress(value: string): { name: string; email: string | null } {
  const match = value.match(/^(.*?)<([^>]+)>$/);

  if (match) {
    const name = match[1]?.trim() || match[2]?.trim();
    return {
      name,
      email: match[2]?.trim() || null,
    };
  }

  return {
    name: value.trim(),
    email: value.includes("@") ? value.trim() : null,
  };
}

function getMailboxName(mailbox: Mailbox): string {
  return mailbox.label || mailbox.emailAddress;
}

function formatMessageTimestamp(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatTimeOnly(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DashboardClient({ tab }: DashboardClientProps) {
  const {
    user,
    folder,
    setFolder,
    inboxSidebarSearch,
    setInboxSidebarSearch,
    messagesSidebarSearch,
    setMessagesSidebarSearch,
    inboxesCollapsed,
    setInboxesCollapsed,
    messagesCollapsed,
    setMessagesCollapsed,
    mailboxes,
    selectedMailboxId,
    setSelectedMailboxId,
    selectedEmailId,
    setSelectedEmailId,
    selectedEmail,
    selectedMailbox,
    threadEmails,
    loadingThread,
    createUserSheetOpen,
    setCreateUserSheetOpen,
    createUserForm,
    setCreateUserForm,
    usersSearchQuery,
    setUsersSearchQuery,
    usersStatusFilter,
    setUsersStatusFilter,
    usersUnreadOnly,
    setUsersUnreadOnly,
    usersPage,
    setUsersPage,
    replyBody,
    setReplyBody,
    replyAll,
    setReplyAll,
    replyTargetEmail,
    setReplyTargetInboundId,
    setStatusMessage,
    errorMessage,
    loadingMailboxes,
    loadingEmails,
    busyAction,
    dashboardMetrics,
    filteredMailboxes,
    filteredEmails,
    recentActivity,
    filteredUsers,
    usersTotalPages,
    paginatedUsers,
    generatedMailboxEmail,
    inboxPaneGridStyle,
    loadEmails,
    handleCreateUserSubmit,
    handleDeleteMailbox,
    handleCopyPassword,
    handleReply,
    openCreateUserSheet,
    totalUnread,
  } = useDashboardState();
  const router = useRouter();

  const unreadEmailCount = filteredEmails.filter(
    (email) => !email.isRead,
  ).length;
  const attachmentEmailCount = filteredEmails.filter(
    (email) => email.attachments.length > 0,
  ).length;
  const mentionEmailCount = filteredEmails.filter((email) =>
    [email.subject, email.preview, email.textBody || "", email.htmlBody || ""]
      .join(" ")
      .includes("@"),
  ).length;
  const totalMessageCount =
    dashboardMetrics.totalInbox + dashboardMetrics.totalSent;
  const queueVolumePercent =
    totalMessageCount === 0
      ? 8
      : Math.min(100, Math.max(16, (totalMessageCount / 120) * 100));
  const selectedMailboxTitle = selectedMailbox
    ? getMailboxName(selectedMailbox)
    : "Choose a mailbox";
  const mailPanelClass =
    "overflow-hidden rounded-[1.4rem] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] text-[color:var(--dashboard-text)] shadow-[0_26px_70px_-42px_rgba(15,23,42,0.65)]";
  const mailInsetClass =
    "border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)]";
  const mailGhostButtonClass =
    "rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] text-[color:var(--dashboard-text-soft)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]";
  const mailInputClass =
    "h-9 rounded-xl border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] text-[color:var(--dashboard-text)] placeholder:text-[color:var(--dashboard-text-soft)] focus-visible:border-[color:var(--dashboard-border)] focus-visible:ring-2 focus-visible:ring-[color:var(--dashboard-hover)]";
  const mailPlaceholderClass =
    "rounded-[1rem] border border-dashed border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] px-3 py-4 text-sm text-[color:var(--dashboard-text-soft)]";
  const mailSoftTextClass = "text-[color:var(--dashboard-text-soft)]";
  const mailMutedTextClass = "text-[color:var(--dashboard-text-muted)]";
  const selectedSender = selectedEmail
    ? splitAddress(selectedEmail.from)
    : null;
  const selectedRecipients = selectedEmail
    ? [...selectedEmail.to, ...selectedEmail.cc].filter(Boolean)
    : [];
  const smartViews = [
    { label: "All Inboxes", count: mailboxes.length, icon: InboxIcon },
    { label: "Unread", count: totalUnread, icon: MailIcon },
    { label: "Mentions", count: mentionEmailCount, icon: AtSignIcon },
    {
      label: "Attachments",
      count: attachmentEmailCount,
      icon: PaperclipIcon,
    },
    { label: "Archived", count: dashboardMetrics.totalSent, icon: ArchiveIcon },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {errorMessage ? (
        <div className="rounded-[1rem] border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {tab === "inboxes" ? (
        <section
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[var(--inbox-col)_var(--messages-col)_minmax(0,1fr)]"
          style={inboxPaneGridStyle}
        >
          <aside className={mailPanelClass}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-[color:var(--dashboard-border)] p-3">
                <div
                  className={cn(
                    "flex items-center gap-2",
                    inboxesCollapsed ? "justify-center" : "justify-between",
                  )}
                >
                  <Button
                    className={cn(
                      "h-10 rounded-[1rem] border-0 bg-[linear-gradient(135deg,#8b5cf6,#6366f1)] text-white hover:opacity-95",
                      inboxesCollapsed
                        ? "size-10 px-0"
                        : "flex-1 justify-center",
                    )}
                    onClick={() => {
                      router.push("/dashboard/users");
                      openCreateUserSheet();
                    }}
                    title="Create new inbox"
                  >
                    <PlusIcon />
                    {!inboxesCollapsed ? "New Inbox" : null}
                  </Button>

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className={mailGhostButtonClass}
                    onClick={() => setInboxesCollapsed((previous) => !previous)}
                    aria-label={
                      inboxesCollapsed
                        ? "Expand inbox sidebar"
                        : "Collapse inbox sidebar"
                    }
                  >
                    {inboxesCollapsed ? (
                      <ChevronRightIcon />
                    ) : (
                      <ChevronLeftIcon />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-3">
                {!inboxesCollapsed ? (
                  <>
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--dashboard-text)]">
                            My Inboxes
                          </p>
                          <p className={cn("text-xs", mailSoftTextClass)}>
                            {mailboxes.length} connected mailbox
                            {mailboxes.length === 1 ? "" : "es"}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            mailInsetClass,
                            "text-[color:var(--dashboard-text-muted)] hover:bg-[color:var(--dashboard-panel-soft)]",
                          )}
                        >
                          {filteredMailboxes.length}
                        </Badge>
                      </div>

                      <div className="relative">
                        <SearchIcon
                          className={cn(
                            "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
                            mailSoftTextClass,
                          )}
                        />
                        <Input
                          value={inboxSidebarSearch}
                          onChange={(event) =>
                            setInboxSidebarSearch(event.target.value)
                          }
                          className={cn(mailInputClass, "pl-9")}
                          placeholder="Search inboxes"
                        />
                      </div>

                      {loadingMailboxes ? (
                        <p className={mailPlaceholderClass}>
                          Loading inboxes...
                        </p>
                      ) : mailboxes.length === 0 ? (
                        <div className={mailPlaceholderClass}>
                          <p>No inboxes created yet.</p>
                          <Button
                            size="sm"
                            className="mt-3 rounded-full bg-[color:var(--dashboard-button)] text-[color:var(--dashboard-button-text)] hover:bg-[color:var(--dashboard-button)]/90"
                            onClick={() => {
                              router.push("/dashboard/users");
                              openCreateUserSheet();
                            }}
                          >
                            Create New Inbox
                          </Button>
                        </div>
                      ) : filteredMailboxes.length === 0 ? (
                        <p className={mailPlaceholderClass}>
                          No inboxes match your search.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredMailboxes.map((mailbox) => {
                            const active = mailbox.id === selectedMailboxId;
                            const mailboxTone = getTone(mailbox.id);

                            return (
                              <button
                                key={mailbox.id}
                                type="button"
                                onClick={() => {
                                  setSelectedMailboxId(mailbox.id);
                                  setFolder("inbox");
                                }}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-[1.05rem] border px-2.5 py-2.5 text-left transition",
                                  active
                                    ? "border-transparent shadow-[0_20px_40px_-30px_rgba(139,92,246,0.55)]"
                                    : "border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] hover:bg-[color:var(--dashboard-hover)]",
                                )}
                                style={
                                  active
                                    ? {
                                        background: "var(--dashboard-selected)",
                                      }
                                    : undefined
                                }
                              >
                                <Avatar className="size-9 rounded-[1rem] after:hidden">
                                  <AvatarFallback
                                    className={cn(
                                      "rounded-[1rem] text-sm font-semibold",
                                      mailboxTone,
                                    )}
                                  >
                                    {getInitials(getMailboxName(mailbox))}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[color:var(--dashboard-text)]">
                                    {mailbox.emailAddress}
                                  </p>
                                  <p
                                    className={cn(
                                      "truncate text-xs",
                                      mailSoftTextClass,
                                    )}
                                  >
                                    {getMailboxName(mailbox)}
                                  </p>
                                </div>
                                <span className="rounded-full bg-[color:var(--dashboard-hover)] px-2 py-1 text-xs font-medium text-[color:var(--dashboard-text-muted)]">
                                  {mailbox.inboxCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          router.push("/dashboard/users");
                          openCreateUserSheet();
                        }}
                        className="inline-flex items-center gap-2 text-sm text-[color:var(--dashboard-accent)] transition hover:opacity-85"
                      >
                        <PlusIcon className="size-4" />
                        Add inbox
                      </button>
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--dashboard-text)]">
                          Smart Views
                        </p>
                        <span className={cn("text-xs", mailSoftTextClass)}>
                          Live
                        </span>
                      </div>

                      <div className="space-y-2">
                        {smartViews.map((item) => {
                          const Icon = item.icon;

                          return (
                            <div
                              key={item.label}
                              className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] px-3 py-2"
                            >
                              <span className="inline-flex size-7.5 items-center justify-center rounded-full bg-[color:var(--dashboard-hover)] text-[color:var(--dashboard-text-soft)]">
                                <Icon className="size-4" />
                              </span>
                              <span className="flex-1 text-sm text-[color:var(--dashboard-text-muted)]">
                                {item.label}
                              </span>
                              <span className="rounded-full bg-[color:var(--dashboard-hover)] px-2 py-1 text-xs text-[color:var(--dashboard-text-soft)]">
                                {item.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--dashboard-text)]">
                          Labels
                        </p>
                        <PlusIcon className={cn("size-4", mailSoftTextClass)} />
                      </div>

                      <div className="space-y-2">
                        {MAIL_LABELS.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] px-3 py-2"
                          >
                            <span
                              className={cn("size-3 rounded-full", item.color)}
                            />
                            <span className="text-sm text-[color:var(--dashboard-text-muted)]">
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    {filteredMailboxes.slice(0, 6).map((mailbox) => {
                      const active = mailbox.id === selectedMailboxId;
                      const mailboxTone = getTone(mailbox.id);

                      return (
                        <button
                          key={mailbox.id}
                          type="button"
                          onClick={() => {
                            setSelectedMailboxId(mailbox.id);
                            setFolder("inbox");
                          }}
                          title={getMailboxName(mailbox)}
                          className={cn(
                            "relative flex size-10 items-center justify-center rounded-[1rem] border transition",
                            active
                              ? "border-transparent"
                              : "border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] hover:bg-[color:var(--dashboard-hover)]",
                          )}
                          style={
                            active
                              ? { background: "var(--dashboard-selected)" }
                              : undefined
                          }
                        >
                          <span
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-xl text-xs font-semibold",
                              mailboxTone,
                            )}
                          >
                            {getInitials(getMailboxName(mailbox))}
                          </span>
                          {mailbox.inboxCount > 0 ? (
                            <span className="absolute -right-1 -top-1 rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {mailbox.inboxCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-[color:var(--dashboard-border)] p-3">
                <div className="rounded-[1rem] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] p-3">
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      inboxesCollapsed ? "justify-center" : "justify-between",
                    )}
                  >
                    {!inboxesCollapsed ? (
                      <>
                        <div>
                          <p className="text-sm font-medium text-[color:var(--dashboard-text)]">
                            Queue volume
                          </p>
                          <p className={cn("text-xs", mailSoftTextClass)}>
                            {totalMessageCount} synced message
                            {totalMessageCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className={cn("text-xs", mailSoftTextClass)}>
                          {Math.round(queueVolumePercent)}%
                        </span>
                      </>
                    ) : (
                      <InboxIcon className={cn("size-4", mailSoftTextClass)} />
                    )}
                  </div>

                  {!inboxesCollapsed ? (
                    <div className="mt-3 h-2 rounded-full bg-[color:var(--dashboard-hover)]">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6366f1)]"
                        style={{ width: `${queueVolumePercent}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          <section className={mailPanelClass}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-[color:var(--dashboard-border)] p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {messagesCollapsed ? (
                      <div className="flex justify-center">
                        <MailIcon className={cn("size-4", mailSoftTextClass)} />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-[color:var(--dashboard-text)]">
                              {selectedMailboxTitle}
                            </p>
                            <p
                              className={cn(
                                "truncate text-xs",
                                mailSoftTextClass,
                              )}
                            >
                              {selectedMailbox?.emailAddress ||
                                "Select an inbox to view messages"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[color:var(--dashboard-accent)]">
                              {folder === "inbox"
                                ? `${selectedMailbox?.inboxCount || unreadEmailCount} unread`
                                : `${selectedMailbox?.sentCount || filteredEmails.length} sent`}
                            </span>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className={mailGhostButtonClass}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <div className="relative flex-1">
                            <SearchIcon
                              className={cn(
                                "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
                                mailSoftTextClass,
                              )}
                            />
                            <Input
                              value={messagesSidebarSearch}
                              onChange={(event) =>
                                setMessagesSidebarSearch(event.target.value)
                              }
                              className={cn(mailInputClass, "pl-9")}
                              placeholder="Search emails"
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                              mailGhostButtonClass,
                              "rounded-[1rem]",
                            )}
                            onClick={() =>
                              selectedMailboxId
                                ? void loadEmails(selectedMailboxId, folder)
                                : undefined
                            }
                            disabled={!selectedMailboxId || loadingEmails}
                          >
                            <RefreshCwIcon
                              className={cn(
                                loadingEmails ? "animate-spin" : "",
                              )}
                            />
                          </Button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                          <button
                            type="button"
                            onClick={() => setFolder("inbox")}
                            className={cn(
                              "rounded-full border px-3 py-1.5 transition",
                              folder === "inbox"
                                ? "border-transparent text-[color:var(--dashboard-text)]"
                                : "border-[color:var(--dashboard-border)] bg-transparent text-[color:var(--dashboard-text-soft)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]",
                            )}
                            style={
                              folder === "inbox"
                                ? { background: "var(--dashboard-selected)" }
                                : undefined
                            }
                          >
                            Inbox
                          </button>
                          <button
                            type="button"
                            onClick={() => setFolder("sent")}
                            className={cn(
                              "rounded-full border px-3 py-1.5 transition",
                              folder === "sent"
                                ? "border-transparent text-[color:var(--dashboard-text)]"
                                : "border-[color:var(--dashboard-border)] bg-transparent text-[color:var(--dashboard-text-soft)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]",
                            )}
                            style={
                              folder === "sent"
                                ? { background: "var(--dashboard-selected)" }
                                : undefined
                            }
                          >
                            Sent
                          </button>
                          <span className="rounded-full bg-[color:var(--dashboard-panel-soft)] px-3 py-1.5 text-[color:var(--dashboard-text-soft)]">
                            Unread {unreadEmailCount}
                          </span>
                          <span className="rounded-full bg-[color:var(--dashboard-panel-soft)] px-3 py-1.5 text-[color:var(--dashboard-text-soft)]">
                            Attachments {attachmentEmailCount}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className={mailGhostButtonClass}
                    onClick={() =>
                      setMessagesCollapsed((previous) => !previous)
                    }
                    aria-label={
                      messagesCollapsed
                        ? "Expand messages sidebar"
                        : "Collapse messages sidebar"
                    }
                  >
                    {messagesCollapsed ? (
                      <ChevronRightIcon />
                    ) : (
                      <ChevronLeftIcon />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5">
                {!selectedMailbox ? (
                  <p className={mailPlaceholderClass}>
                    Choose an inbox from the left column to load messages.
                  </p>
                ) : loadingEmails ? (
                  <p className={mailPlaceholderClass}>Loading messages...</p>
                ) : filteredEmails.length === 0 ? (
                  <p className={mailPlaceholderClass}>
                    No messages for this view.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredEmails.map((email) => {
                      const active = email.id === selectedEmailId;
                      const sender = splitAddress(email.from);
                      const tone = getTone(email.id);

                      return (
                        <button
                          key={email.id}
                          type="button"
                          onClick={() => setSelectedEmailId(email.id)}
                          title={messagesCollapsed ? email.subject : undefined}
                          className={cn(
                            "w-full rounded-[1.05rem] border transition",
                            active
                              ? "border-transparent shadow-[0_20px_40px_-30px_rgba(139,92,246,0.55)]"
                              : "border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] hover:bg-[color:var(--dashboard-hover)]",
                            messagesCollapsed ? "px-0 py-2.5" : "px-3 py-2.5",
                          )}
                          style={
                            active
                              ? { background: "var(--dashboard-selected)" }
                              : undefined
                          }
                        >
                          {messagesCollapsed ? (
                            <div className="flex justify-center">
                              <span
                                className={cn(
                                  "inline-flex size-8 items-center justify-center rounded-[1rem] text-xs font-semibold",
                                  tone,
                                )}
                              >
                                {getInitials(sender.name)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3 text-left">
                              <Avatar className="size-9 rounded-full after:hidden">
                                <AvatarFallback
                                  className={cn("text-sm font-semibold", tone)}
                                >
                                  {getInitials(sender.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-[color:var(--dashboard-text)]">
                                      {sender.name}
                                    </p>
                                    <p className="truncate text-sm font-semibold text-[color:var(--dashboard-text)]">
                                      {email.subject}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2 text-xs text-[color:var(--dashboard-text-soft)]">
                                    <span>
                                      {formatMessageTimestamp(email.createdAt)}
                                    </span>
                                    {!email.isRead ? (
                                      <span className="size-2 rounded-full bg-violet-400" />
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-1 truncate text-sm text-[color:var(--dashboard-text-soft)]">
                                  {buildSnippet(getChatMessageBody(email), 88)}
                                </p>
                                <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--dashboard-text-soft)]">
                                  {email.attachments.length > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                      <PaperclipIcon className="size-3.5" />
                                      {email.attachments.length}
                                    </span>
                                  ) : null}
                                  {email.kind === "sent" ? (
                                    <span>Sent</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={mailPanelClass}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-[color:var(--dashboard-border)] px-4 py-3">
                {selectedEmail ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[1.45rem] font-semibold tracking-tight text-[color:var(--dashboard-text)] sm:text-[1.6rem]">
                            {selectedEmail.subject}
                          </h3>
                          <Badge className="border-transparent bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)] hover:bg-[color:var(--dashboard-accent-soft)]">
                            {folder === "inbox" ? "Inbox" : "Sent"}
                          </Badge>
                        </div>
                        <p className={cn("mt-1 text-sm", mailSoftTextClass)}>
                          Thread participants:{" "}
                          {Array.from(getEmailParticipants(selectedEmail)).join(
                            ", ",
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className={mailGhostButtonClass}
                        >
                          <StarIcon />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className={mailGhostButtonClass}
                        >
                          <ArchiveIcon />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className={mailGhostButtonClass}
                              />
                            }
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setStatusMessage("Star action coming soon.")
                              }
                            >
                              Mark as important
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setStatusMessage("Archive action coming soon.")
                              }
                            >
                              Archive thread
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10 rounded-full after:hidden">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold",
                              getTone(selectedEmail.from),
                            )}
                          >
                            {selectedSender
                              ? getInitials(selectedSender.name)
                              : "IR"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[color:var(--dashboard-text)]">
                            {selectedSender?.name || selectedEmail.from}
                          </p>
                          <p
                            className={cn(
                              "truncate text-xs",
                              mailSoftTextClass,
                            )}
                          >
                            {selectedSender?.email || selectedEmail.from}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-[color:var(--dashboard-text-soft)]">
                        <p>{formatTimeOnly(selectedEmail.createdAt)}</p>
                        {selectedRecipients.length > 0 ? (
                          <p className="mt-1 max-w-[24rem] truncate text-xs">
                            to {selectedRecipients.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-[color:var(--dashboard-text)]">
                      Select a message
                    </h3>
                    <p className={cn("mt-1 text-sm", mailSoftTextClass)}>
                      Choose an email from the middle column to open the thread.
                    </p>
                  </>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {selectedEmail ? (
                  <>
                    {loadingThread ? (
                      <p className={mailPlaceholderClass}>
                        Loading thread messages...
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {threadEmails.map((threadEmail) => {
                          const isSentMessage = threadEmail.kind === "sent";
                          const canReplyToThis = threadEmail.kind === "inbound";
                          const sender = splitAddress(
                            isSentMessage
                              ? user.email || "You"
                              : threadEmail.from,
                          );

                          return (
                            <div
                              key={threadEmail.id}
                              className={cn(
                                "flex",
                                isSentMessage ? "justify-end" : "justify-start",
                              )}
                            >
                              <article
                                className={cn(
                                  "max-w-[85%] rounded-[1.2rem] border px-3.5 py-3 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.95)]",
                                  isSentMessage
                                    ? "border-violet-400/25 bg-[linear-gradient(135deg,rgba(109,40,217,0.72),rgba(99,102,241,0.7))] text-white"
                                    : "border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] text-[color:var(--dashboard-text)]",
                                )}
                              >
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                                          isSentMessage
                                            ? "bg-white/14 text-white"
                                            : getTone(threadEmail.from),
                                        )}
                                      >
                                        {getInitials(sender.name)}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                          {isSentMessage
                                            ? user.name || "You"
                                            : sender.name}
                                        </p>
                                        <p
                                          className={cn(
                                            "text-xs",
                                            isSentMessage
                                              ? "text-white/70"
                                              : "text-[color:var(--dashboard-text-soft)]",
                                          )}
                                        >
                                          {formatTimeOnly(
                                            threadEmail.createdAt,
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          size="icon-sm"
                                          variant="ghost"
                                          className={cn(
                                            "size-7 rounded-full",
                                            isSentMessage
                                              ? "text-white/72 hover:bg-white/10 hover:text-white"
                                              : "text-[color:var(--dashboard-text-soft)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]",
                                          )}
                                        />
                                      }
                                    >
                                      <MoreHorizontalIcon />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-44"
                                    >
                                      <DropdownMenuItem
                                        disabled={!canReplyToThis}
                                        onClick={() => {
                                          if (!canReplyToThis) {
                                            return;
                                          }
                                          setReplyTargetInboundId(
                                            threadEmail.id,
                                          );
                                          setReplyAll(false);
                                          setStatusMessage(
                                            "Reply mode: specific recipient",
                                          );
                                        }}
                                      >
                                        Reply specific
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={!canReplyToThis}
                                        onClick={() => {
                                          if (!canReplyToThis) {
                                            return;
                                          }
                                          setReplyTargetInboundId(
                                            threadEmail.id,
                                          );
                                          setReplyAll(true);
                                          setStatusMessage(
                                            "Reply mode: reply all recipients",
                                          );
                                        }}
                                      >
                                        Reply all
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                <pre
                                  className={cn(
                                    "whitespace-pre-wrap text-sm leading-7",
                                    isSentMessage
                                      ? "text-white"
                                      : "text-[color:var(--dashboard-text-muted)]",
                                  )}
                                >
                                  {getChatMessageBody(threadEmail)}
                                </pre>

                                {threadEmail.attachments.length > 0 ? (
                                  <div className="mt-3 space-y-2">
                                    {threadEmail.attachments.map(
                                      (attachment) => (
                                        <div
                                          key={attachment.id}
                                          className={cn(
                                            "flex items-center justify-between rounded-[0.9rem] border px-3 py-2 text-sm",
                                            isSentMessage
                                              ? "border-white/12 bg-black/10"
                                              : "border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-hover)]",
                                          )}
                                        >
                                          <div className="min-w-0">
                                            <p className="truncate font-medium">
                                              {attachment.filename ||
                                                "attachment"}
                                            </p>
                                            <p
                                              className={cn(
                                                "text-xs",
                                                isSentMessage
                                                  ? "text-white/72"
                                                  : "text-[color:var(--dashboard-text-soft)]",
                                              )}
                                            >
                                              {formatBytes(
                                                attachment.sizeBytes,
                                              )}
                                            </p>
                                          </div>
                                          {attachment.hasDownload ? (
                                            <a
                                              className={cn(
                                                "text-xs font-semibold underline underline-offset-4",
                                                isSentMessage
                                                  ? "text-white"
                                                  : "text-violet-200",
                                              )}
                                              href={attachment.downloadPath}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              Download
                                            </a>
                                          ) : (
                                            <span className="text-xs text-[color:var(--dashboard-text-soft)]">
                                              No file
                                            </span>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : null}
                              </article>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={mailPlaceholderClass}>
                    Click an email to open its conversation here.
                  </div>
                )}
              </div>

              <div className="border-t border-[color:var(--dashboard-border)] p-3">
                {replyTargetEmail ? (
                  <div className="rounded-[1rem] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-composer)]">
                    <div className="flex items-center gap-6 border-b border-[color:var(--dashboard-border)] px-4 py-3 text-sm">
                      <span className="font-medium text-[color:var(--dashboard-accent)]">
                        Reply
                      </span>
                      <span className={mailSoftTextClass}>Internal Note</span>
                    </div>
                    <div className="space-y-3 px-4 py-3.5">
                      <p className={cn("text-xs", mailSoftTextClass)}>
                        Replying to {replyTargetEmail.from} ·{" "}
                        {formatMessageTimestamp(replyTargetEmail.createdAt)}
                      </p>
                      <textarea
                        className="min-h-24 w-full resize-none rounded-[0.95rem] border border-[color:var(--dashboard-border)] bg-transparent px-3.5 py-3 text-sm text-[color:var(--dashboard-text)] outline-none placeholder:text-[color:var(--dashboard-text-soft)]"
                        placeholder="Type your reply..."
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-[color:var(--dashboard-text-soft)]">
                          <input
                            type="checkbox"
                            checked={replyAll}
                            onChange={(event) =>
                              setReplyAll(event.target.checked)
                            }
                          />
                          Reply all recipients
                        </label>
                        <Button
                          className="rounded-full bg-[linear-gradient(135deg,#8b5cf6,#6366f1)] text-white hover:opacity-95"
                          onClick={() => void handleReply()}
                          disabled={busyAction === "reply" || !replyBody.trim()}
                        >
                          <SendHorizontalIcon />
                          {busyAction === "reply" ? "Sending..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={mailPlaceholderClass}>
                    Select an inbound thread message to enable quick reply.
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {tab === "users" ? (
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Users Directory</CardTitle>
                  <CardDescription>
                    Mailboxes are treated as users. Filter, paginate, and manage
                    user mailboxes.
                  </CardDescription>
                </div>

                <Button onClick={openCreateUserSheet}>Create New</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={usersSearchQuery}
                    onChange={(event) =>
                      setUsersSearchQuery(event.target.value)
                    }
                    className="pl-9"
                    placeholder="Search by name, passport ID, email, or user ID"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={
                      usersStatusFilter === "all" ? "default" : "outline"
                    }
                    onClick={() => setUsersStatusFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      usersStatusFilter === "active" ? "default" : "outline"
                    }
                    onClick={() => setUsersStatusFilter("active")}
                  >
                    Active
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      usersStatusFilter === "inactive" ? "default" : "outline"
                    }
                    onClick={() => setUsersStatusFilter("inactive")}
                  >
                    Inactive
                  </Button>
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={usersUnreadOnly}
                    onChange={(event) =>
                      setUsersUnreadOnly(event.target.checked)
                    }
                  />
                  Unread only
                </label>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-700 p-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Passport ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Inbox</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingMailboxes ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-16 text-center text-zinc-600"
                        >
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : paginatedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-16 text-center text-zinc-600"
                        >
                          No users match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedUsers.map((mailbox) => (
                        <TableRow key={mailbox.id}>
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {mailbox.label ||
                              mailbox.emailAddress.split("@")[0]}
                          </TableCell>
                          <TableCell>{mailbox.passportId}</TableCell>
                          <TableCell className="max-w-[240px] truncate">
                            {mailbox.emailAddress}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={mailbox.isActive ? "default" : "outline"}
                            >
                              {mailbox.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{mailbox.inboxCount}</TableCell>
                          <TableCell>{mailbox.sentCount}</TableCell>
                          <TableCell>
                            {formatTimestamp(mailbox.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyPassword(mailbox.id)}
                                disabled={busyAction === `reveal-${mailbox.id}`}
                              >
                                <CopyIcon />
                                Copy Password
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  void handleDeleteMailbox(mailbox)
                                }
                                disabled={busyAction === `delete-${mailbox.id}`}
                              >
                                <Trash2Icon />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
                <span>
                  Showing{" "}
                  {filteredUsers.length === 0
                    ? 0
                    : (usersPage - 1) * USERS_PAGE_SIZE + 1}
                  -{(usersPage - 1) * USERS_PAGE_SIZE + paginatedUsers.length}{" "}
                  of {filteredUsers.length}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={usersPage <= 1}
                    onClick={() =>
                      setUsersPage((previous) => Math.max(1, previous - 1))
                    }
                  >
                    Previous
                  </Button>
                  <span>
                    Page {usersPage} of {usersTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={usersPage >= usersTotalPages}
                    onClick={() =>
                      setUsersPage((previous) =>
                        Math.min(usersTotalPages, previous + 1),
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Sheet
            open={createUserSheetOpen}
            onOpenChange={setCreateUserSheetOpen}
          >
            <SheetContent side="left" className="w-full sm:max-w-md">
              <form
                className="flex h-full flex-col"
                onSubmit={handleCreateUserSubmit}
              >
                <SheetHeader>
                  <SheetTitle>Create New User</SheetTitle>
                  <SheetDescription>
                    Create a mailbox-user using name and passport ID. The email
                    is generated automatically.
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 px-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-user-name">Nickname / Name</Label>
                    <Input
                      id="create-user-name"
                      value={createUserForm.name}
                      onChange={(event) =>
                        setCreateUserForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Ananya Sharma"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-user-passport">Passport ID</Label>
                    <Input
                      id="create-user-passport"
                      value={createUserForm.passportId}
                      onChange={(event) =>
                        setCreateUserForm((previous) => ({
                          ...previous,
                          passportId: event.target.value,
                        }))
                      }
                      placeholder="P1234567"
                      required
                    />
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    Generated mailbox:{" "}
                    {generatedMailboxEmail || "Fill name and passport ID"}
                  </div>
                </div>

                <SheetFooter>
                  <Button
                    type="submit"
                    disabled={
                      busyAction === "create-user" || !generatedMailboxEmail
                    }
                  >
                    {busyAction === "create-user"
                      ? "Creating..."
                      : "Create User"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateUserSheetOpen(false)}
                  >
                    Cancel
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WorkflowIcon className="size-4 text-sky-600" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Most recent message events for the currently selected inbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
                    No activity yet. Select an inbox to load recent events.
                  </p>
                ) : (
                  recentActivity.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5"
                    >
                      <span className="mt-1 inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCheckIcon className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {event.label}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {event.timestamp}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue Snapshot</CardTitle>
              <CardDescription>
                Live summary across all mailbox queues.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-700">
              <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  Active Mailboxes
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">
                  {dashboardMetrics.activeMailboxes}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  Inbound Queue
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">
                  {dashboardMetrics.totalInbox}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  Sent Throughput
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">
                  {dashboardMetrics.totalSent}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>
                Configure default behavior for notifications and inbox workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-700">
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2">
                <input type="checkbox" defaultChecked />
                Auto-refresh active inbox every 60 seconds
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2">
                <input type="checkbox" defaultChecked />
                Show popup notifications for new inbound emails
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2">
                <input type="checkbox" />
                Require confirmation before sending replies
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>
                Switch or sign out from the current dashboard account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-white/80 p-3">
                <p className="text-sm font-semibold text-zinc-900">
                  {user.name || "Operator"}
                </p>
                <p className="text-xs text-zinc-600">
                  {user.email || "No email"}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/users")}
              >
                Manage Inboxes
              </Button>
              <Button
                variant="destructive"
                onClick={() => signOut({ callbackUrl: "/auth" })}
              >
                <LogOutIcon />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
