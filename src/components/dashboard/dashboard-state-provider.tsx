"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useDashboardSessionUser } from "@/components/dashboard/dashboard-session-provider";
import {
  buildMailboxEmailFromIdentity,
  isLikelySameThread,
  type EmailRecord,
  type MailFolder,
  type Mailbox,
  USERS_PAGE_SIZE,
  type UsersStatusFilter,
  workspaceOptions,
} from "@/components/dashboard/dashboard-shared";

function useDashboardStateValue() {
  const user = useDashboardSessionUser();

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
  const [threadEmails, setThreadEmails] = useState<EmailRecord[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

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
  const [replyTargetInboundId, setReplyTargetInboundId] = useState<
    string | null
  >(null);

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

  const replyTargetEmail = useMemo(() => {
    if (replyTargetInboundId) {
      const explicitTarget = threadEmails.find(
        (email) =>
          email.id === replyTargetInboundId && email.kind === "inbound",
      );
      if (explicitTarget) {
        return explicitTarget;
      }
    }

    if (selectedEmail?.kind === "inbound") {
      return selectedEmail;
    }

    return threadEmails.find((email) => email.kind === "inbound") ?? null;
  }, [replyTargetInboundId, selectedEmail, threadEmails]);

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
      timestamp: new Date(email.createdAt).toLocaleString(),
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

  const loadThreadEmails = useCallback(
    async (mailboxId: string, anchorEmail: EmailRecord): Promise<void> => {
      setLoadingThread(true);

      try {
        const [inboxResponse, sentResponse] = await Promise.all([
          fetch(`/api/mailboxes/${mailboxId}/emails?folder=inbox&limit=120`, {
            cache: "no-store",
          }),
          fetch(`/api/mailboxes/${mailboxId}/emails?folder=sent&limit=120`, {
            cache: "no-store",
          }),
        ]);

        const inboxPayload = (await inboxResponse.json()) as {
          ok: boolean;
          emails?: EmailRecord[];
        };
        const sentPayload = (await sentResponse.json()) as {
          ok: boolean;
          emails?: EmailRecord[];
        };

        if (
          !inboxResponse.ok ||
          !sentResponse.ok ||
          !inboxPayload.ok ||
          !sentPayload.ok
        ) {
          throw new Error("Failed to load thread messages");
        }

        const merged = [
          ...(inboxPayload.emails || []),
          ...(sentPayload.emails || []),
        ];
        const deduped = Array.from(
          new Map(merged.map((email) => [email.id, email])).values(),
        );

        const relatedThread = deduped
          .filter((email) => isLikelySameThread(anchorEmail, email))
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

        setThreadEmails(
          relatedThread.length > 0 ? relatedThread : [anchorEmail],
        );
      } catch {
        setThreadEmails([anchorEmail]);
      } finally {
        setLoadingThread(false);
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
      setThreadEmails([]);
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
    if (threadEmails.length === 0) {
      setReplyTargetInboundId(null);
      return;
    }

    if (
      replyTargetInboundId &&
      threadEmails.some(
        (email) =>
          email.id === replyTargetInboundId && email.kind === "inbound",
      )
    ) {
      return;
    }

    const preferredTarget =
      selectedEmail?.kind === "inbound"
        ? selectedEmail
        : (threadEmails.find((email) => email.kind === "inbound") ?? null);

    setReplyTargetInboundId(preferredTarget?.id ?? null);
  }, [replyTargetInboundId, selectedEmail, threadEmails]);

  useEffect(() => {
    if (!selectedMailboxId || !selectedEmail) {
      setThreadEmails([]);
      return;
    }

    void loadThreadEmails(selectedMailboxId, selectedEmail);
  }, [loadThreadEmails, selectedEmail, selectedMailboxId]);

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
    if (!selectedMailbox || !replyTargetEmail) {
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
            inboundEmailId: replyTargetEmail.id,
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

  function openCreateUserSheet(): void {
    setCreateUserSheetOpen(true);
  }

  return {
    user,
    activeWorkspace,
    setActiveWorkspace,
    activeWorkspaceInfo,
    folder,
    setFolder,
    searchQuery,
    setSearchQuery,
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
    emails,
    selectedEmailId,
    setSelectedEmailId,
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
    replyTargetInboundId,
    setReplyTargetInboundId,
    statusMessage,
    setStatusMessage,
    errorMessage,
    setErrorMessage,
    loadingMailboxes,
    loadingEmails,
    busyAction,
    selectedMailbox,
    selectedEmail,
    replyTargetEmail,
    dashboardMetrics,
    filteredMailboxes,
    filteredEmails,
    totalUnread,
    notificationItems,
    recentActivity,
    filteredUsers,
    usersTotalPages,
    paginatedUsers,
    generatedMailboxEmail,
    inboxPaneGridStyle,
    loadMailboxes,
    loadEmails,
    handleCreateUserSubmit,
    handleDeleteMailbox,
    handleCopyPassword,
    handleReply,
    openCreateUserSheet,
  };
}

type DashboardStateContextValue = ReturnType<typeof useDashboardStateValue>;

const DashboardStateContext = createContext<DashboardStateContextValue | null>(
  null,
);

interface DashboardStateProviderProps {
  children: ReactNode;
}

export function DashboardStateProvider({
  children,
}: DashboardStateProviderProps) {
  const value = useDashboardStateValue();

  return (
    <DashboardStateContext.Provider value={value}>
      {children}
    </DashboardStateContext.Provider>
  );
}

export function useDashboardState(): DashboardStateContextValue {
  const state = useContext(DashboardStateContext);

  if (!state) {
    throw new Error(
      "useDashboardState must be used within DashboardStateProvider",
    );
  }

  return state;
}
