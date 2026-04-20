"use client";

import {
  CheckCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  InboxIcon,
  LogOutIcon,
  MailIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SearchIcon,
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
  USERS_PAGE_SIZE,
} from "@/components/dashboard/dashboard-shared";
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
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildSnippet } from "@/lib/email-helpers";

interface DashboardClientProps {
  tab: DashboardTab;
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
  } = useDashboardState();
  const router = useRouter();

  return (
    <div className="flex-1 space-y-4 ">
      {errorMessage ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {tab === "inboxes" ? (
        <section
          className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[var(--inbox-col)_var(--messages-col)_minmax(0,1fr)]"
          style={inboxPaneGridStyle}
        >
          <aside className="overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <SidebarHeader className="border-b border-sidebar-border p-2">
              <div className="flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="ghost"
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

                {inboxesCollapsed ? (
                  <InboxIcon className="size-4 text-sidebar-foreground/70" />
                ) : (
                  <>
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <h2 className="truncate font-heading text-sm font-semibold">
                        Inboxes
                      </h2>
                      <p className="truncate text-[11px] text-sidebar-foreground/65">
                        {mailboxes.length} mailbox account(s)
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {filteredMailboxes.length}
                    </Badge>
                  </>
                )}
              </div>

              {!inboxesCollapsed ? (
                <div className="relative mt-2">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/60" />
                  <SidebarInput
                    value={inboxSidebarSearch}
                    onChange={(event) =>
                      setInboxSidebarSearch(event.target.value)
                    }
                    className="h-8 border-sidebar-border bg-sidebar-accent/50 pl-9"
                    placeholder="Search inboxes"
                  />
                </div>
              ) : null}
            </SidebarHeader>

            <SidebarContent className="max-h-[calc(100vh-14rem)] p-2">
              {loadingMailboxes ? (
                <p className="px-2 py-2 text-sm text-sidebar-foreground/70">
                  Loading inboxes...
                </p>
              ) : mailboxes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/30 px-3 py-3 text-sm text-sidebar-foreground/70">
                  <p>No inboxes created yet.</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      router.push("/dashboard/users");
                      openCreateUserSheet();
                    }}
                  >
                    Create New Inbox
                  </Button>
                </div>
              ) : filteredMailboxes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/30 px-3 py-3 text-sm text-sidebar-foreground/70">
                  No inboxes match your search.
                </p>
              ) : (
                <SidebarGroup className="p-0">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredMailboxes.map((mailbox) => {
                        const active = mailbox.id === selectedMailboxId;

                        return (
                          <SidebarMenuItem key={mailbox.id}>
                            <SidebarMenuButton
                              isActive={active}
                              tooltip={
                                inboxesCollapsed
                                  ? mailbox.label || mailbox.emailAddress
                                  : undefined
                              }
                              className={
                                inboxesCollapsed
                                  ? "justify-center px-0"
                                  : "h-auto items-start py-2"
                              }
                              onClick={() => {
                                setSelectedMailboxId(mailbox.id);
                                setFolder("inbox");
                              }}
                            >
                              {inboxesCollapsed ? (
                                <InboxIcon className="size-4" />
                              ) : (
                                <div className="w-full space-y-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold">
                                        {mailbox.label || "Untitled Inbox"}
                                      </p>
                                      <p className="truncate text-xs text-sidebar-foreground/70">
                                        {mailbox.emailAddress}
                                      </p>
                                    </div>
                                    <Badge variant="outline">
                                      {mailbox.inboxCount}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-sidebar-foreground/65">
                                    UID: {mailbox.passportId} ·{" "}
                                    {mailbox.id.slice(0, 8)}
                                  </p>
                                </div>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </aside>

          <section className="overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <SidebarHeader className="border-b border-sidebar-border p-2">
              <div className="flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setMessagesCollapsed((previous) => !previous)}
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

                {messagesCollapsed ? (
                  <MailIcon className="size-4 text-sidebar-foreground/70" />
                ) : (
                  <>
                    <div className="grid min-w-0 leading-tight">
                      <h3 className="truncate text-sm font-semibold">
                        {selectedMailbox
                          ? `${selectedMailbox.label || selectedMailbox.emailAddress}`
                          : "Messages"}
                      </h3>
                      <p className="truncate text-[11px] text-sidebar-foreground/70">
                        {selectedMailbox
                          ? "Conversation list"
                          : "Select an inbox"}
                      </p>
                    </div>

                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={folder === "inbox" ? "default" : "outline"}
                        onClick={() => setFolder("inbox")}
                      >
                        Inbox
                      </Button>
                      <Button
                        size="sm"
                        variant={folder === "sent" ? "default" : "outline"}
                        onClick={() => setFolder("sent")}
                      >
                        Sent
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          selectedMailboxId
                            ? void loadEmails(selectedMailboxId, folder)
                            : undefined
                        }
                        disabled={!selectedMailboxId || loadingEmails}
                      >
                        <RefreshCwIcon />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {!messagesCollapsed ? (
                <div className="relative mt-2">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/60" />
                  <SidebarInput
                    value={messagesSidebarSearch}
                    onChange={(event) =>
                      setMessagesSidebarSearch(event.target.value)
                    }
                    className="h-8 border-sidebar-border bg-sidebar-accent/50 pl-9"
                    placeholder="Search messages"
                  />
                </div>
              ) : null}
            </SidebarHeader>

            <SidebarContent className="max-h-[calc(100vh-14rem)] p-2">
              {!selectedMailbox ? (
                <p className="rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/30 px-3 py-3 text-sm text-sidebar-foreground/70">
                  Choose an inbox from the sidebar to load messages.
                </p>
              ) : loadingEmails ? (
                <p className="px-2 py-2 text-sm text-sidebar-foreground/70">
                  Loading messages...
                </p>
              ) : filteredEmails.length === 0 ? (
                <p className="rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/30 px-3 py-3 text-sm text-sidebar-foreground/70">
                  No messages for this view.
                </p>
              ) : (
                <SidebarGroup className="p-0">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredEmails.map((email) => {
                        const active = email.id === selectedEmailId;

                        return (
                          <SidebarMenuItem key={email.id}>
                            <SidebarMenuButton
                              isActive={active}
                              tooltip={
                                messagesCollapsed ? email.subject : undefined
                              }
                              className={
                                messagesCollapsed
                                  ? "justify-center px-0"
                                  : "h-auto items-start py-2"
                              }
                              onClick={() => setSelectedEmailId(email.id)}
                            >
                              {messagesCollapsed ? (
                                <MailIcon className="size-4" />
                              ) : (
                                <div className="w-full space-y-0.5">
                                  <p className="truncate text-sm font-semibold">
                                    {email.subject}
                                  </p>
                                  <p className="truncate text-xs text-sidebar-foreground/70">
                                    {email.from}
                                  </p>
                                  <p className="text-xs text-sidebar-foreground/65">
                                    {buildSnippet(email.preview, 88)}
                                  </p>
                                  <p className="text-[11px] text-sidebar-foreground/60">
                                    {formatTimestamp(email.createdAt)}
                                  </p>
                                </div>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </section>

          <section className="vibe-shell overflow-hidden rounded-2xl">
            <div className="border-b px-4 py-3">
              <h3 className="text-base font-semibold text-zinc-900">
                Thread Chat
              </h3>
              <p className="text-xs text-zinc-600">
                Conversation history for the selected email shown as chat.
              </p>
            </div>

            <div className="max-h-[calc(100vh-14rem)] space-y-3 overflow-y-auto p-4">
              {selectedEmail ? (
                <>
                  <div className="rounded-xl border border-zinc-200 bg-white/85 p-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      {selectedEmail.subject}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Thread participants:{" "}
                      {Array.from(getEmailParticipants(selectedEmail)).join(
                        ", ",
                      )}
                    </p>
                  </div>

                  {loadingThread ? (
                    <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
                      Loading thread messages...
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {threadEmails.map((threadEmail) => {
                        const isSentMessage = threadEmail.kind === "sent";
                        const messageBody = getChatMessageBody(threadEmail);
                        const canReplyToThis = threadEmail.kind === "inbound";

                        return (
                          <div
                            key={threadEmail.id}
                            className={`flex ${isSentMessage ? "justify-end" : "justify-start"}`}
                          >
                            <article
                              className={`max-w-[84%] rounded-2xl border px-3 py-2 ${
                                isSentMessage
                                  ? "border-sky-200 bg-sky-50"
                                  : "border-zinc-200 bg-white"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-zinc-900">
                                    {isSentMessage ? "You" : threadEmail.from}
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    {formatTimestamp(threadEmail.createdAt)}
                                  </p>
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        className="size-7"
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
                                        setReplyTargetInboundId(threadEmail.id);
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
                                        setReplyTargetInboundId(threadEmail.id);
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

                              <p className="text-xs text-zinc-600">
                                To: {threadEmail.to.join(", ") || "(none)"}
                              </p>

                              <pre className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                                {messageBody}
                              </pre>

                              {threadEmail.attachments.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {threadEmail.attachments.map((attachment) => (
                                    <div
                                      key={attachment.id}
                                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                                    >
                                      <span>
                                        {attachment.filename || "attachment"} (
                                        {formatBytes(attachment.sizeBytes)})
                                      </span>
                                      {attachment.hasDownload ? (
                                        <a
                                          className="font-semibold text-sky-700 underline"
                                          href={attachment.downloadPath}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Download
                                        </a>
                                      ) : (
                                        <span className="text-zinc-500">
                                          No file
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </article>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {replyTargetEmail ? (
                    <div className="rounded-xl border border-zinc-200 bg-white/85 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Quick Reply
                      </p>
                      <p className="mb-2 text-xs text-zinc-600">
                        Target: {replyTargetEmail.from} ·{" "}
                        {formatTimestamp(replyTargetEmail.createdAt)}
                      </p>
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-input/90 bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
                        placeholder="Write your reply"
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                      />
                      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
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
                        className="mt-2"
                        size="sm"
                        onClick={() => void handleReply()}
                        disabled={busyAction === "reply" || !replyBody.trim()}
                      >
                        {busyAction === "reply"
                          ? "Sending Reply..."
                          : "Send Reply"}
                      </Button>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
                      Select an inbound message from the thread menu to reply.
                    </p>
                  )}
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
                  Click an email to open it here.
                </p>
              )}
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

              <div className="overflow-hidden rounded-xl border border-zinc-200">
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
