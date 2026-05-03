"use client";

import {
  ArchiveIcon,
  AtSignIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MailIcon,
  MailOpenIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendHorizontalIcon,
  StarIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import * as sanitizeHtml from "sanitize-html";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import {
  formatBytes,
  getChatMessageBody,
  getEmailParticipants,
  type Mailbox,
} from "@/components/dashboard/dashboard-shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarSeparator,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildSnippet } from "@/lib/email-helpers";
import { th } from "date-fns/locale";
import React, { useRef } from "react";
import { EmailThread } from "../EmailThread";

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
  if (!normalized) return "IR";
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
    return { name, email: match[2]?.trim() || null };
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
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTimeOnly(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InboxesDashboardClient() {
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
    replyBody,
    setReplyBody,
    replyAll,
    setReplyAll,
    replyTargetEmail,
    setReplyTargetInboundId,
    setStatusMessage,
    loadingMailboxes,
    loadingEmails,
    busyAction,
    filteredMailboxes,
    filteredEmails,
    handleReply,
    openCreateUserSheet,
    loadEmails,
    totalUnread,
  } = useDashboardState();

  const unreadEmailCount = filteredEmails.filter((e) => !e.isRead).length;
  const attachmentEmailCount = filteredEmails.filter(
    (e) => e.attachments.length > 0,
  ).length;
  const mentionEmailCount = filteredEmails.filter((email) =>
    [email.subject, email.preview, email.textBody || "", email.htmlBody || ""]
      .join(" ")
      .includes("@"),
  ).length;

  const selectedMailboxTitle = selectedMailbox
    ? getMailboxName(selectedMailbox)
    : "Choose a mailbox";
  const mailPanelClass =
    "rounded-[1.4rem] border border-(--dashboard-border) bg-(--dashboard-panel) text-(--dashboard-text) shadow-[0_26px_70px_-42px_rgba(15,23,42,0.65)]";
  const mailGhostButtonClass =
    "rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-soft) text-(--dashboard-text-soft) hover:bg-(--dashboard-hover) hover:text-(--dashboard-text)";
  const mailInputClass =
    "h-9 rounded-xl border-(--dashboard-border) bg-(--dashboard-panel-soft) text-(--dashboard-text) placeholder:text-(--dashboard-text-soft) focus-visible:border-(--dashboard-border) focus-visible:ring-2 focus-visible:ring-(--dashboard-hover)";
  const mailPlaceholderClass =
    "rounded-[1rem] border border-dashed border-(--dashboard-border) bg-(--dashboard-panel-soft) px-3 py-4 text-sm text-(--dashboard-text-soft)";
  const mailSoftTextClass = "text-(--dashboard-text-soft)";

  const selectedSender = selectedEmail
    ? splitAddress(selectedEmail.from)
    : null;
  const selectedRecipients = selectedEmail
    ? [...selectedEmail.to, ...selectedEmail.cc].filter(Boolean)
    : [];

  const smartViews = [
    { label: "All Inboxes", count: mailboxes.length, icon: MailIcon },
    { label: "Unread", count: totalUnread, icon: MailOpenIcon },
    { label: "Mentions", count: mentionEmailCount, icon: AtSignIcon },
    { label: "Attachments", count: attachmentEmailCount, icon: PaperclipIcon },
    { label: "Archived", count: 0, icon: ArchiveIcon },
  ];
  const router = useRouter();

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const processHtml = (html?: string) => {
    if (!html) return null;

    const clean = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "style"]),
      allowedAttributes: {
        "*": ["style"],
        a: ["href", "target"],
        img: ["src", "alt", "width", "height"],
      },
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              margin: 0;
              padding: 12px;
              font-family: Arial, sans-serif;
              background: white;
              color: black;
              word-break: break-word;
            }

            img { max-width: 100%; height: auto; }
            table { max-width: 100% !important; }
          </style>
        </head>
        <body>${clean}</body>
      </html>
    `;
  };

  const handleLoad = (id: string) => {
    const iframe = iframeRefs.current[id];
    if (!iframe) return;

    try {
      const doc = iframe.contentWindow?.document;
      if (!doc) return;

      const resize = () => {
        iframe.style.height = doc.body.scrollHeight + "px";
        iframe.style.maxWidth = "600px";
      };

      resize();
      setTimeout(resize, 300);
      setTimeout(resize, 1000);

      const observer = new ResizeObserver(resize);
      observer.observe(doc.body);
    } catch (err) {
      console.error("Iframe access blocked:", err);
    }
  };

  const renderEmail = (email: (typeof threadEmails)[number]) => {
    const html = processHtml(email.htmlBody ?? "");

    return (
      <div key={email.id} style={{ marginBottom: "24px" }}>
        {html ? (
          <iframe
            ref={(el) => {
              iframeRefs.current[email.id] = el;
            }}
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={() => handleLoad(email.id)}
            style={{
              width: "100%",
              border: "none",
              height: "0px",
              display: "block",
              background: "white",
            }}
          />
        ) : (
          <div style={{ whiteSpace: "pre-wrap", padding: "12px" }}>
            {email.textBody || "No content"}
          </div>
        )}
      </div>
    );
  };

  return (
    // <SidebarProvider
    //   open={!inboxesCollapsed}
    //   onOpenChange={(open) => setInboxesCollapsed(!open)}
    // >
    <div className="flex min-h-0 flex-1 gap-1">
      <div className="relative shrink-0 overflow-visible">
        <SidebarProvider
          open={!inboxesCollapsed}
          onOpenChange={(open) => setInboxesCollapsed(!open)}
        >
          <Sidebar side="left" collapsible="icon" className={cn("relative")}>
            <SidebarHeader className="gap-2 border-b border-(--dashboard-border)">
              <Button
                className={cn(
                  "h-10 rounded-[1rem] border-0 bg-[linear-gradient(135deg,#8b5cf6,#6366f1)] text-white hover:opacity-95",
                  inboxesCollapsed ? "size-10 px-0" : "w-full justify-center",
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
            </SidebarHeader>

            <SidebarContent className="gap-4 p-2">
              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-0">
                  My Inboxes
                </SidebarGroupLabel>
                <SidebarGroupContent className="space-y-3">
                  <InputGroup className="max-w-xs">
                    <InputGroupInput
                      value={inboxSidebarSearch}
                      onChange={(event) =>
                        setInboxSidebarSearch(event.target.value)
                      }
                      placeholder="Search inboxes"
                      className="pl-9 group-data-[collapsible=icon]:hidden "
                    />
                    <InputGroupAddon>
                      <SearchIcon />
                    </InputGroupAddon>
                  </InputGroup>

                  {loadingMailboxes ? (
                    <p className={mailPlaceholderClass}>Loading inboxes...</p>
                  ) : mailboxes.length === 0 ? (
                    <div className={mailPlaceholderClass}>
                      <p>No inboxes created yet.</p>
                    </div>
                  ) : filteredMailboxes.length === 0 ? (
                    <p className={mailPlaceholderClass}>
                      No inboxes match your search.
                    </p>
                  ) : (
                    <SidebarMenu className="gap-1 p-0">
                      {filteredMailboxes.slice(0, 8).map((mailbox) => {
                        const active = mailbox.id === selectedMailboxId;
                        const mailboxTone = getTone(mailbox.id);
                        return (
                          <SidebarMenuItem key={mailbox.id}>
                            <SidebarMenuButton
                              onClick={() => {
                                setSelectedMailboxId(mailbox.id);
                                setFolder("inbox");
                              }}
                              tooltip={getMailboxName(mailbox)}
                              isActive={active}
                              className="h-auto"
                            >
                              <Avatar className="size-8 rounded-[1rem] after:hidden">
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
                                <p className="truncate text-sm font-medium text-(--dashboard-text)">
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
                              <span className="rounded-full bg-(--dashboard-hover) px-2 py-1 text-xs font-medium text-(--dashboard-text-muted)">
                                {mailbox.inboxCount}
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarSeparator />

              <SidebarGroup className=" p-0">
                <SidebarGroupLabel className="px-0">
                  Smart Views
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2">
                    {smartViews.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton
                            render={<button type="button" />}
                            className="h-auto justify-start rounded-[1rem] border border-(--dashboard-border) bg-(--dashboard-panel-soft) px-3 py-2"
                          >
                            <Icon className="size-4" />
                            <span className="flex-1 text-sm text-(--dashboard-text-muted)">
                              {item.label}
                            </span>
                            <span className="rounded-full bg-(--dashboard-hover) px-2 py-1 text-xs text-(--dashboard-text-soft)">
                              {item.count}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarSeparator />

              <SidebarGroup className=" p-0">
                <SidebarGroupLabel className="px-0">Labels</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2">
                    {MAIL_LABELS.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          render={<button type="button" />}
                          className="h-auto justify-start rounded-[1rem] border border-(--dashboard-border) bg-(--dashboard-panel-soft) px-3 py-2"
                        >
                          <span
                            className={cn("size-3 rounded-full", item.color)}
                          />
                          <span className=" group-data-[collapsible=icon]:hidden text-sm text-(--dashboard-text-muted)">
                            {item.label}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <SidebarTrigger className="absolute right-0 top-11 z-20  translate-x-1/2 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-soft) text-(--dashboard-text-soft) shadow-md hover:bg-(--dashboard-hover) hover:text-(--dashboard-text)" />
        </SidebarProvider>
      </div>

      {/* MESSAGES SIDEBAR */}
      <SidebarProvider
        open={!messagesCollapsed}
        onOpenChange={(open) => setMessagesCollapsed(!open)}
        className={"relative"}
      >
        <Sidebar collapsible="icon" className={cn("relative w-[24rem] h-auto")}>
          <SidebarContent>
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
                          {/* <button
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
                          </button> */}
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

                  {/* <Button
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
                    </Button> */}
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
          </SidebarContent>
          <SidebarTrigger className="absolute right-0 top-11 z-20  translate-x-1/2 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-soft) text-(--dashboard-text-soft) shadow-md hover:bg-(--dashboard-hover) hover:text-(--dashboard-text)" />
        </Sidebar>
        <SidebarInset>
          <section
            className={cn(
              mailPanelClass,
              "flex w-full flex-1 min-h-0 flex-col",
            )}
          >
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

                    {/* <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
                    </div> */}
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
                        <EmailThread
                          currentUserEmail={user.email || ""}
                          emails={threadEmails}
                        />
                        {/* {threadEmails.map((threadEmail) => {
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

                                  {canReplyToThis && (
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
                                            if (!canReplyToThis) return;
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
                                            if (!canReplyToThis) return;
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
                                  )}
                                </div>

                                <pre
                                  className={cn(
                                    "whitespace-pre-wrap text-sm leading-7",
                                    isSentMessage
                                      ? "text-white"
                                      : "text-[color:var(--dashboard-text-muted)]",
                                  )}
                                >
                                  {renderEmail(threadEmail)}
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
                        })} */}
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
        </SidebarInset>
      </SidebarProvider>
    </div>
    // </SidebarProvider>
  );
}
