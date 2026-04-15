"use client";

import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  InboxIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";

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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
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
import type { SessionUser } from "@/lib/session-user";

type DashboardTab = "inboxes" | "users" | "activity" | "settings";
type MailFolder = "inbox" | "sent";
type UsersStatusFilter = "all" | "active" | "inactive";

interface Mailbox {
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

interface EmailAttachment {
  id: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  hasDownload: boolean;
  downloadPath: string;
}

interface EmailRecord {
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
  attachments: EmailAttachment[];
}

interface DashboardClientProps {
  user: SessionUser;
}

const MAILBOX_EMAIL_DOMAIN = "jatts.ca";
const USERS_PAGE_SIZE = 8;

const workspaceOptions = [
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

const navTabs: Array<{
  id: DashboardTab;
  title: string;
  icon: typeof InboxIcon;
}> = [
  {
    id: "inboxes",
    title: "Inboxes",
    icon: InboxIcon,
  },
  {
    id: "users",
    title: "Users",
    icon: UsersIcon,
  },
  {
    id: "activity",
    title: "Activity",
    icon: WorkflowIcon,
  },
];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function formatBytes(sizeBytes: number | null): string {
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

function slugMailboxPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function buildMailboxEmailFromIdentity(
  name: string,
  passportId: string,
): string {
  const namePart = slugMailboxPart(name) || "mailbox";
  const passportPart = slugMailboxPart(passportId) || "user";
  return `${namePart}.${passportPart}@${MAILBOX_EMAIL_DOMAIN}`;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("inboxes");
  const [activeWorkspace, setActiveWorkspace] =
    useState<(typeof workspaceOptions)[number]["id"]>("primary");
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxSidebarSearch, setInboxSidebarSearch] = useState("");
  const [messagesSidebarSearch, setMessagesSidebarSearch] = useState("");
  const [inboxesCollapsed, setInboxesCollapsed] = useState(false);
  const [messagesCollapsed, setMessagesCollapsed] = useState(false);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(
    null,
  );

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const [createUserSheetOpen, setCreateUserSheetOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    passportId: "",
  });
  const [usersSearchQuery, setUsersSearchQuery] = useState("");
  const [usersStatusFilter, setUsersStatusFilter] =
    useState<UsersStatusFilter>("all");
  const [usersUnreadOnly, setUsersUnreadOnly] = useState(false);
  const [usersPage, setUsersPage] = useState(1);

  const [replyBody, setReplyBody] = useState("");
  const [replyAll, setReplyAll] = useState(false);

  const [statusMessage, setStatusMessage] = useState("Ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMailboxes, setLoadingMailboxes] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedMailbox = useMemo(
    () => mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? null,
    [mailboxes, selectedMailboxId],
  );

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId],
  );

  const dashboardMetrics = useMemo(() => {
    const totalInbox = mailboxes.reduce(
      (sum, mailbox) => sum + mailbox.inboxCount,
      0,
    );
    const totalSent = mailboxes.reduce(
      (sum, mailbox) => sum + mailbox.sentCount,
      0,
    );
    const activeMailboxes = mailboxes.filter(
      (mailbox) => mailbox.isActive,
    ).length;

    return {
      totalInbox,
      totalSent,
      activeMailboxes,
    };
  }, [mailboxes]);

  const filteredMailboxes = useMemo(() => {
    const globalQuery = searchQuery.trim().toLowerCase();
    const sidebarQuery = inboxSidebarSearch.trim().toLowerCase();

    return mailboxes.filter((mailbox) => {
      const searchable = [
        mailbox.label || "",
        mailbox.emailAddress,
        mailbox.passportId,
        mailbox.id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesGlobal = !globalQuery || searchable.includes(globalQuery);
      const matchesSidebar = !sidebarQuery || searchable.includes(sidebarQuery);

      return matchesGlobal && matchesSidebar;
    });
  }, [inboxSidebarSearch, mailboxes, searchQuery]);

  const filteredEmails = useMemo(() => {
    const globalQuery = searchQuery.trim().toLowerCase();
    const sidebarQuery = messagesSidebarSearch.trim().toLowerCase();

    return emails.filter((email) => {
      const searchable = [
        email.subject,
        email.from,
        email.to.join(" "),
        email.cc.join(" "),
        email.preview,
      ]
        .join(" ")
        .toLowerCase();

      const matchesGlobal = !globalQuery || searchable.includes(globalQuery);
      const matchesSidebar = !sidebarQuery || searchable.includes(sidebarQuery);

      return matchesGlobal && matchesSidebar;
    });
  }, [emails, messagesSidebarSearch, searchQuery]);

  const totalUnread = useMemo(
    () => mailboxes.reduce((sum, mailbox) => sum + mailbox.inboxCount, 0),
    [mailboxes],
  );

  const notificationItems = useMemo(() => {
    return [...mailboxes]
      .filter((mailbox) => mailbox.inboxCount > 0)
      .sort((a, b) => b.inboxCount - a.inboxCount)
      .slice(0, 8);
  }, [mailboxes]);

  const recentActivity = useMemo(() => {
    return [...emails].slice(0, 10).map((email) => ({
      id: email.id,
      label:
        email.kind === "inbound"
          ? `Inbound: ${email.subject}`
          : `Sent: ${email.subject}`,
      timestamp: formatTimestamp(email.createdAt),
    }));
  }, [emails]);

  const activeWorkspaceInfo =
    workspaceOptions.find((workspace) => workspace.id === activeWorkspace) ??
    workspaceOptions[0];

  const filteredUsers = useMemo(() => {
    const query = usersSearchQuery.trim().toLowerCase();

    return mailboxes.filter((mailbox) => {
      const matchesStatus =
        usersStatusFilter === "all"
          ? true
          : usersStatusFilter === "active"
            ? mailbox.isActive
            : !mailbox.isActive;

      const matchesUnread = usersUnreadOnly ? mailbox.inboxCount > 0 : true;

      const searchable = [
        mailbox.label || "",
        mailbox.passportId,
        mailbox.emailAddress,
        mailbox.id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || searchable.includes(query);

      return matchesStatus && matchesUnread && matchesQuery;
    });
  }, [mailboxes, usersSearchQuery, usersStatusFilter, usersUnreadOnly]);

  const usersTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PAGE_SIZE),
  );

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + USERS_PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  const generatedMailboxEmail = useMemo(() => {
    const name = createUserForm.name.trim();
    const passportId = createUserForm.passportId.trim();

    if (!name || !passportId) {
      return "";
    }

    return buildMailboxEmailFromIdentity(name, passportId);
  }, [createUserForm.name, createUserForm.passportId]);

  const inboxPaneGridStyle = {
    "--inbox-col": inboxesCollapsed ? "3.5rem" : "18rem",
    "--messages-col": messagesCollapsed ? "3.5rem" : "22rem",
  } as CSSProperties;

  const loadMailboxes = useCallback(async (): Promise<void> => {
    setLoadingMailboxes(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/mailboxes", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        mailboxes?: Mailbox[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to load mailboxes");
      }

      const nextMailboxes = payload.mailboxes || [];
      setMailboxes(nextMailboxes);
      setStatusMessage(`Loaded ${nextMailboxes.length} mailbox account(s).`);

      setSelectedMailboxId((currentSelectedId) => {
        if (nextMailboxes.length === 0) {
          return null;
        }

        return nextMailboxes.some((mailbox) => mailbox.id === currentSelectedId)
          ? currentSelectedId
          : nextMailboxes[0].id;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load mailboxes",
      );
    } finally {
      setLoadingMailboxes(false);
    }
  }, []);

  const loadEmails = useCallback(
    async (mailboxId: string, nextFolder: MailFolder): Promise<void> => {
      setLoadingEmails(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/mailboxes/${mailboxId}/emails?folder=${nextFolder}&limit=80`,
          { cache: "no-store" },
        );

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          emails?: EmailRecord[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load emails");
        }

        const nextEmails = payload.emails || [];
        setEmails(nextEmails);
        setStatusMessage(
          `Loaded ${nextEmails.length} ${nextFolder} message(s).`,
        );

        setSelectedEmailId((currentSelectedId) => {
          if (nextEmails.length === 0) {
            return null;
          }

          return nextEmails.some((email) => email.id === currentSelectedId)
            ? currentSelectedId
            : nextEmails[0].id;
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load emails",
        );
      } finally {
        setLoadingEmails(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadMailboxes();
  }, [loadMailboxes]);

  useEffect(() => {
    if (!selectedMailboxId) {
      setEmails([]);
      setSelectedEmailId(null);
      return;
    }

    void loadEmails(selectedMailboxId, folder);
  }, [folder, loadEmails, selectedMailboxId]);

  useEffect(() => {
    if (!selectedEmailId) {
      return;
    }

    const isStillVisible = filteredEmails.some(
      (email) => email.id === selectedEmailId,
    );

    if (!isStillVisible) {
      setSelectedEmailId(filteredEmails[0]?.id ?? null);
    }
  }, [filteredEmails, selectedEmailId]);

  useEffect(() => {
    if (usersPage > usersTotalPages) {
      setUsersPage(usersTotalPages);
    }
  }, [usersPage, usersTotalPages]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersSearchQuery, usersStatusFilter, usersUnreadOnly]);

  async function handleCreateUserSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const name = createUserForm.name.trim();
    const passportId = createUserForm.passportId.trim().toUpperCase();

    if (!name || !passportId) {
      setErrorMessage("Name and passport ID are required.");
      return;
    }

    const generatedEmail = buildMailboxEmailFromIdentity(name, passportId);

    setBusyAction("create-user");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/mailboxes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          label: name,
          passportId,
          emailAddress: generatedEmail,
          password: "",
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        createdPassword?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to create mailbox");
      }

      await loadMailboxes();
      setCreateUserForm({
        name: "",
        passportId: "",
      });
      setCreateUserSheetOpen(false);
      setActiveTab("users");

      if (payload.createdPassword) {
        await navigator.clipboard
          .writeText(payload.createdPassword)
          .catch(() => null);

        setStatusMessage(
          `Created ${generatedEmail} and copied generated password to clipboard.`,
        );
      } else {
        setStatusMessage(`Created mailbox ${generatedEmail}.`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create user mailbox",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteMailbox(mailbox: Mailbox): Promise<void> {
    const confirmed = window.confirm(
      `Delete mailbox ${mailbox.emailAddress}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`delete-${mailbox.id}`);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/mailboxes/${mailbox.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to delete mailbox");
      }

      setStatusMessage("Mailbox deleted.");
      await loadMailboxes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete mailbox",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyPassword(mailboxId: string): Promise<void> {
    setBusyAction(`reveal-${mailboxId}`);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/mailboxes/${mailboxId}/reveal`, {
        method: "POST",
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        password?: string;
      };

      if (!response.ok || !payload.ok || !payload.password) {
        throw new Error(payload.error || "Could not reveal password");
      }

      await navigator.clipboard.writeText(payload.password);
      setStatusMessage("Mailbox password copied to clipboard.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not copy password",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReply(): Promise<void> {
    if (
      !selectedMailbox ||
      !selectedEmail ||
      selectedEmail.kind !== "inbound"
    ) {
      return;
    }

    if (!replyBody.trim()) {
      setErrorMessage("Reply body cannot be empty.");
      return;
    }

    setBusyAction("reply");
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/mailboxes/${selectedMailbox.id}/reply`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            inboundEmailId: selectedEmail.id,
            textBody: replyBody,
            replyAll,
          }),
        },
      );

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to send reply");
      }

      setReplyBody("");
      setReplyAll(false);
      setStatusMessage("Reply sent.");
      setFolder("sent");
      await loadEmails(selectedMailbox.id, "sent");
      await loadMailboxes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send reply",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16.5rem",
          "--header-height": "3.5rem",
        } as CSSProperties
      }
    >
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="aria-expanded:bg-sidebar-accent"
                    />
                  }
                >
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="text-sm font-semibold">
                      {activeWorkspaceInfo.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.email || activeWorkspaceInfo.description}
                    </span>
                  </div>
                  <ChevronDownIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {workspaceOptions.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() => setActiveWorkspace(workspace.id)}
                    >
                      <div className="grid leading-tight">
                        <span className="text-sm font-medium">
                          {workspace.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {workspace.description}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navTabs.map((tab) => {
                  const Icon = tab.icon;

                  return (
                    <SidebarMenuItem key={tab.id}>
                      <SidebarMenuButton
                        isActive={activeTab === tab.id}
                        tooltip={tab.title}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <Icon />
                        <span>{tab.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeTab === "settings"}
                onClick={() => setActiveTab("settings")}
              >
                <Settings2Icon />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-(--header-height) items-center gap-2 border-b bg-background/95 px-3 backdrop-blur-xl md:px-4">
          <SidebarTrigger className="-ml-1" />

          <div className="relative w-full max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
              placeholder="Search inboxes, senders, subjects, or IDs"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    className="relative"
                  />
                }
              >
                <BellIcon />
                {totalUnread > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {Math.min(totalUnread, 99)}
                  </span>
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>New Email Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notificationItems.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    No new inbound notifications.
                  </p>
                ) : (
                  notificationItems.map((mailbox) => (
                    <DropdownMenuItem
                      key={mailbox.id}
                      onClick={() => {
                        setActiveTab("inboxes");
                        setSelectedMailboxId(mailbox.id);
                        setFolder("inbox");
                      }}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {mailbox.label || mailbox.emailAddress}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {mailbox.emailAddress}
                          </p>
                        </div>
                        <Badge variant="secondary">{mailbox.inboxCount}</Badge>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon-sm" variant="outline" />}
              >
                <UserIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="grid leading-tight">
                    <span className="text-sm font-medium">
                      {user.name || "Operator"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.email || "No email"}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("users")}>
                  Manage Users
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("settings")}>
                  Workspace Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/auth" })}
                >
                  <LogOutIcon />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 space-y-4 p-4 md:p-6">
          {errorMessage ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {activeTab === "inboxes" ? (
            <section
              className="grid gap-4 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:var(--inbox-col)_var(--messages-col)_minmax(0,1fr)]"
              style={inboxPaneGridStyle}
            >
              <aside className="overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground">
                <div className="border-b border-sidebar-border p-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        setInboxesCollapsed((previous) => !previous)
                      }
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
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                        Inb
                      </span>
                    ) : (
                      <>
                        <h2 className="font-heading text-base font-semibold">
                          Inboxes
                        </h2>
                        <Badge variant="secondary" className="ml-auto">
                          {filteredMailboxes.length}
                        </Badge>
                      </>
                    )}
                  </div>

                  {!inboxesCollapsed ? (
                    <div className="relative mt-2">
                      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/60" />
                      <Input
                        value={inboxSidebarSearch}
                        onChange={(event) =>
                          setInboxSidebarSearch(event.target.value)
                        }
                        className="h-8 border-sidebar-border bg-sidebar-accent/50 pl-9"
                        placeholder="Search inboxes"
                      />
                    </div>
                  ) : null}
                </div>

                <SidebarContent className="max-h-[calc(100vh-14rem)] p-2">
                  {loadingMailboxes ? (
                    <p className="px-2 py-2 text-sm text-sidebar-foreground/70">
                      Loading inboxes...
                    </p>
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
                                    <span className="text-xs font-semibold uppercase">
                                      {(
                                        mailbox.label || mailbox.emailAddress
                                      ).slice(0, 1)}
                                    </span>
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

              <section className="overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground">
                <div className="border-b border-sidebar-border p-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon-sm"
                      variant="ghost"
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

                    {messagesCollapsed ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                        Msg
                      </span>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-base font-semibold">Messages</h3>
                          <p className="text-xs text-sidebar-foreground/70">
                            {selectedMailbox
                              ? `${selectedMailbox.label || selectedMailbox.emailAddress}`
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
                      <Input
                        value={messagesSidebarSearch}
                        onChange={(event) =>
                          setMessagesSidebarSearch(event.target.value)
                        }
                        className="h-8 border-sidebar-border bg-sidebar-accent/50 pl-9"
                        placeholder="Search messages"
                      />
                    </div>
                  ) : null}
                </div>

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
                                    messagesCollapsed
                                      ? email.subject
                                      : undefined
                                  }
                                  className={
                                    messagesCollapsed
                                      ? "justify-center px-0"
                                      : "h-auto items-start py-2"
                                  }
                                  onClick={() => setSelectedEmailId(email.id)}
                                >
                                  {messagesCollapsed ? (
                                    <span className="text-xs font-semibold uppercase">
                                      {(email.subject || "M").slice(0, 1)}
                                    </span>
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
                    Email Preview
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Opened messages are shown in-place without leaving the
                    dashboard.
                  </p>
                </div>

                <div className="max-h-[calc(100vh-14rem)] space-y-3 overflow-y-auto p-4">
                  {selectedEmail ? (
                    <>
                      <div className="space-y-1 rounded-xl border border-zinc-200 bg-white/80 p-3">
                        <p className="text-lg font-semibold text-zinc-900">
                          {selectedEmail.subject}
                        </p>
                        <p className="text-sm text-zinc-600">
                          From: {selectedEmail.from}
                        </p>
                        <p className="text-sm text-zinc-600">
                          To: {selectedEmail.to.join(", ")}
                        </p>
                        {selectedEmail.cc.length > 0 ? (
                          <p className="text-xs text-zinc-500">
                            CC: {selectedEmail.cc.join(", ")}
                          </p>
                        ) : null}
                        <p className="text-xs text-zinc-500">
                          {formatTimestamp(selectedEmail.createdAt)}
                        </p>
                      </div>

                      {selectedEmail.attachments.length > 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-white/85 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Attachments
                          </p>
                          <div className="space-y-1.5">
                            {selectedEmail.attachments.map((attachment) => (
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
                                  <span className="text-zinc-500">No file</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selectedEmail.textBody ? (
                        <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white/90 p-3 text-sm text-zinc-800">
                          {selectedEmail.textBody}
                        </pre>
                      ) : null}

                      {!selectedEmail.textBody && selectedEmail.htmlBody ? (
                        <iframe
                          title="email-html-preview"
                          className="h-[360px] w-full rounded-xl border border-zinc-200 bg-white"
                          srcDoc={selectedEmail.htmlBody}
                          sandbox=""
                        />
                      ) : null}

                      {selectedEmail.kind === "inbound" ? (
                        <div className="rounded-xl border border-zinc-200 bg-white/85 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Quick Reply
                          </p>
                          <textarea
                            className="min-h-24 w-full rounded-xl border border-input/90 bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
                            placeholder="Write your reply"
                            value={replyBody}
                            onChange={(event) =>
                              setReplyBody(event.target.value)
                            }
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
                            disabled={
                              busyAction === "reply" || !replyBody.trim()
                            }
                          >
                            {busyAction === "reply"
                              ? "Sending Reply..."
                              : "Send Reply"}
                          </Button>
                        </div>
                      ) : null}
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

          {activeTab === "users" ? (
            <section className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Users Directory</CardTitle>
                      <CardDescription>
                        Mailboxes are treated as users. Filter, paginate, and
                        manage user mailboxes.
                      </CardDescription>
                    </div>

                    <Button onClick={() => setCreateUserSheetOpen(true)}>
                      Create New
                    </Button>
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
                          usersStatusFilter === "inactive"
                            ? "default"
                            : "outline"
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
                                  variant={
                                    mailbox.isActive ? "default" : "outline"
                                  }
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
                                    onClick={() =>
                                      handleCopyPassword(mailbox.id)
                                    }
                                    disabled={
                                      busyAction === `reveal-${mailbox.id}`
                                    }
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
                                    disabled={
                                      busyAction === `delete-${mailbox.id}`
                                    }
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
                      -
                      {(usersPage - 1) * USERS_PAGE_SIZE +
                        paginatedUsers.length}{" "}
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
                        Create a mailbox-user using name and passport ID. The
                        email is generated automatically.
                      </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="create-user-name">
                          Nickname / Name
                        </Label>
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
                        <Label htmlFor="create-user-passport">
                          Passport ID
                        </Label>
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

          {activeTab === "activity" ? (
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

          {activeTab === "settings" ? (
            <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Workspace Settings</CardTitle>
                  <CardDescription>
                    Configure default behavior for notifications and inbox
                    workflow.
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
                    onClick={() => setActiveTab("users")}
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

        <footer className="border-t bg-background/90 px-4 py-2 text-xs text-zinc-600 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2">
            <span>{statusMessage}</span>
            <span>
              Active inbox: {selectedMailbox?.emailAddress || "none"} · Folder:{" "}
              {folder.toUpperCase()} · Unread: {totalUnread}
            </span>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
