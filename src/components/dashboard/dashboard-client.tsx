"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildSnippet } from "@/lib/email-helpers";
import type { SessionUser } from "@/lib/session-user";

type DashboardSection = "accounts" | "client";
type MailFolder = "inbox" | "sent";

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

interface ComposeAttachment {
  id: string;
  filename: string;
  contentType?: string;
  contentBase64: string;
}

interface DashboardClientProps {
  user: SessionUser;
}

const emptyCompose = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  textBody: "",
  htmlBody: "",
};

const emptyCreateMailbox = {
  passportId: "",
  emailAddress: "",
  label: "",
  password: "",
};

const emptyEditMailbox = {
  passportId: "",
  emailAddress: "",
  label: "",
  password: "",
  isActive: true,
};

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

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }

      const [, base64 = ""] = reader.result.split(",");
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Could not read file"));
    };

    reader.readAsDataURL(file);
  });
}

export function DashboardClient({ user }: DashboardClientProps) {
  const [section, setSection] = useState<DashboardSection>("accounts");
  const [folder, setFolder] = useState<MailFolder>("inbox");

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(
    null,
  );

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const [createMailboxForm, setCreateMailboxForm] =
    useState(emptyCreateMailbox);
  const [editMailboxId, setEditMailboxId] = useState<string | null>(null);
  const [editMailboxForm, setEditMailboxForm] = useState(emptyEditMailbox);

  const [composeForm, setComposeForm] = useState(emptyCompose);
  const [composeAttachments, setComposeAttachments] = useState<
    ComposeAttachment[]
  >([]);

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

  async function handleCreateMailbox(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setBusyAction("create-mailbox");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/mailboxes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createMailboxForm),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        createdPassword?: string;
        mailbox?: Mailbox;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to create mailbox");
      }

      await loadMailboxes();
      setCreateMailboxForm(emptyCreateMailbox);

      if (payload.createdPassword) {
        await navigator.clipboard
          .writeText(payload.createdPassword)
          .catch(() => null);
        setStatusMessage(
          `Mailbox created. Generated password copied to clipboard: ${payload.createdPassword}`,
        );
      } else {
        setStatusMessage("Mailbox created successfully.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create mailbox",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function beginEditMailbox(mailbox: Mailbox): void {
    setEditMailboxId(mailbox.id);
    setEditMailboxForm({
      passportId: mailbox.passportId,
      emailAddress: mailbox.emailAddress,
      label: mailbox.label || "",
      password: "",
      isActive: mailbox.isActive,
    });
  }

  async function handleSaveMailboxEdit(): Promise<void> {
    if (!editMailboxId) {
      return;
    }

    setBusyAction(`save-${editMailboxId}`);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/mailboxes/${editMailboxId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(editMailboxForm),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to update mailbox");
      }

      setStatusMessage("Mailbox updated.");
      setEditMailboxId(null);
      setEditMailboxForm(emptyEditMailbox);
      await loadMailboxes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update mailbox",
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

  async function addComposeAttachments(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setBusyAction("attachments");
    setErrorMessage(null);

    try {
      const mapped = await Promise.all(
        files.map(async (file) => ({
          id: crypto.randomUUID(),
          filename: file.name,
          contentType: file.type || undefined,
          contentBase64: await toBase64(file),
        })),
      );

      setComposeAttachments((previous) => [...previous, ...mapped]);
      setStatusMessage(`Attached ${mapped.length} file(s).`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to attach file(s)",
      );
    } finally {
      setBusyAction(null);
      event.target.value = "";
    }
  }

  async function handleSendEmail(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedMailbox) {
      setErrorMessage("Select a mailbox before sending.");
      return;
    }

    setBusyAction("send-email");
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/mailboxes/${selectedMailbox.id}/send`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...composeForm,
            attachments: composeAttachments,
          }),
        },
      );

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to send email");
      }

      setComposeForm(emptyCompose);
      setComposeAttachments([]);
      setFolder("sent");
      setStatusMessage("Email sent successfully.");
      await loadEmails(selectedMailbox.id, "sent");
      await loadMailboxes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send email",
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
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-zinc-100 via-emerald-50 to-cyan-100 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Virtual Mail Control Center
            </p>
            <h1 className="text-lg font-semibold sm:text-xl">
              Operations Dashboard
            </h1>
          </div>

          <nav className="flex items-center gap-2">
            <Button
              variant={section === "accounts" ? "default" : "outline"}
              size="sm"
              onClick={() => setSection("accounts")}
            >
              Accounts
            </Button>
            <Button
              variant={section === "client" ? "default" : "outline"}
              size="sm"
              onClick={() => setSection("client")}
            >
              Email Client
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/auth" })}
            >
              Log Out
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3 rounded-2xl border border-zinc-200/60 bg-white/80 p-3 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Mailboxes
          </h2>

          <div className="space-y-2">
            {mailboxes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500">
                No virtual mailbox accounts yet.
              </p>
            ) : (
              mailboxes.map((mailbox) => {
                const active = mailbox.id === selectedMailboxId;
                return (
                  <button
                    key={mailbox.id}
                    type="button"
                    onClick={() => {
                      setSelectedMailboxId(mailbox.id);
                      setSection("client");
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {mailbox.label || mailbox.emailAddress}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {mailbox.emailAddress}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Inbox {mailbox.inboxCount} | Sent {mailbox.sentCount}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="font-semibold text-zinc-700">User</p>
            <p>{user.name || "Operator"}</p>
            <p>{user.email || "No email"}</p>
          </div>
        </aside>

        <main className="space-y-4">
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {section === "accounts" ? (
            <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Create Virtual Mailbox</CardTitle>
                  <CardDescription>
                    Bind an email account to a unique user identifier such as a
                    passport ID.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={handleCreateMailbox}>
                    <div className="space-y-1">
                      <Label htmlFor="create-passport">Passport ID</Label>
                      <Input
                        id="create-passport"
                        value={createMailboxForm.passportId}
                        onChange={(event) =>
                          setCreateMailboxForm((previous) => ({
                            ...previous,
                            passportId: event.target.value,
                          }))
                        }
                        placeholder="P1234567"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="create-email">
                        Virtual Email Address
                      </Label>
                      <Input
                        id="create-email"
                        type="email"
                        value={createMailboxForm.emailAddress}
                        onChange={(event) =>
                          setCreateMailboxForm((previous) => ({
                            ...previous,
                            emailAddress: event.target.value,
                          }))
                        }
                        placeholder="passport123@jatts.ca"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="create-label">Label (optional)</Label>
                      <Input
                        id="create-label"
                        value={createMailboxForm.label}
                        onChange={(event) =>
                          setCreateMailboxForm((previous) => ({
                            ...previous,
                            label: event.target.value,
                          }))
                        }
                        placeholder="Travel Candidate"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="create-password">
                        Password (leave blank to auto-generate)
                      </Label>
                      <Input
                        id="create-password"
                        type="text"
                        value={createMailboxForm.password}
                        onChange={(event) =>
                          setCreateMailboxForm((previous) => ({
                            ...previous,
                            password: event.target.value,
                          }))
                        }
                        placeholder="Auto-generated if blank"
                      />
                    </div>

                    <Button
                      className="w-full"
                      disabled={busyAction === "create-mailbox"}
                      type="submit"
                    >
                      {busyAction === "create-mailbox"
                        ? "Creating..."
                        : "Create Mailbox"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manage Mailbox Accounts</CardTitle>
                  <CardDescription>
                    Update credentials, copy passwords, or remove virtual
                    accounts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingMailboxes ? (
                    <p className="text-sm text-zinc-500">
                      Loading mailboxes...
                    </p>
                  ) : mailboxes.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No mailbox accounts available.
                    </p>
                  ) : (
                    mailboxes.map((mailbox) => (
                      <div
                        key={mailbox.id}
                        className="rounded-xl border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {mailbox.label || mailbox.emailAddress}
                            </p>
                            <p className="text-sm text-zinc-600">
                              {mailbox.emailAddress}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Passport: {mailbox.passportId}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyPassword(mailbox.id)}
                              disabled={busyAction === `reveal-${mailbox.id}`}
                            >
                              Copy Password
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => beginEditMailbox(mailbox)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDeleteMailbox(mailbox)}
                              disabled={busyAction === `delete-${mailbox.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-zinc-500">
                          Updated {formatTimestamp(mailbox.updatedAt)} | Inbox{" "}
                          {mailbox.inboxCount} | Sent {mailbox.sentCount}
                        </div>
                      </div>
                    ))
                  )}

                  {editMailboxId ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                      <h3 className="mb-2 text-sm font-semibold">
                        Edit Mailbox
                      </h3>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="edit-passport">Passport ID</Label>
                          <Input
                            id="edit-passport"
                            value={editMailboxForm.passportId}
                            onChange={(event) =>
                              setEditMailboxForm((previous) => ({
                                ...previous,
                                passportId: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="edit-email">Email</Label>
                          <Input
                            id="edit-email"
                            type="email"
                            value={editMailboxForm.emailAddress}
                            onChange={(event) =>
                              setEditMailboxForm((previous) => ({
                                ...previous,
                                emailAddress: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="edit-label">Label</Label>
                          <Input
                            id="edit-label"
                            value={editMailboxForm.label}
                            onChange={(event) =>
                              setEditMailboxForm((previous) => ({
                                ...previous,
                                label: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="edit-password">New Password</Label>
                          <Input
                            id="edit-password"
                            value={editMailboxForm.password}
                            onChange={(event) =>
                              setEditMailboxForm((previous) => ({
                                ...previous,
                                password: event.target.value,
                              }))
                            }
                            placeholder="Leave blank to keep current"
                          />
                        </div>
                      </div>

                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editMailboxForm.isActive}
                          onChange={(event) =>
                            setEditMailboxForm((previous) => ({
                              ...previous,
                              isActive: event.target.checked,
                            }))
                          }
                        />
                        Mailbox is active
                      </label>

                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleSaveMailboxEdit()}
                          disabled={busyAction?.startsWith("save-")}
                        >
                          Save Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditMailboxId(null);
                            setEditMailboxForm(emptyEditMailbox);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Compose Email</CardTitle>
                  <CardDescription>
                    Send new outbound messages using the selected virtual
                    mailbox identity.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedMailbox ? (
                    <form className="space-y-2" onSubmit={handleSendEmail}>
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        Sending from{" "}
                        <span className="font-semibold">
                          {selectedMailbox.emailAddress}
                        </span>
                      </div>

                      <Input
                        placeholder="To (comma-separated)"
                        value={composeForm.to}
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            to: event.target.value,
                          }))
                        }
                        required
                      />

                      <Input
                        placeholder="CC"
                        value={composeForm.cc}
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            cc: event.target.value,
                          }))
                        }
                      />

                      <Input
                        placeholder="BCC"
                        value={composeForm.bcc}
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            bcc: event.target.value,
                          }))
                        }
                      />

                      <Input
                        placeholder="Subject"
                        value={composeForm.subject}
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            subject: event.target.value,
                          }))
                        }
                      />

                      <textarea
                        className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
                        placeholder="Plain text body"
                        value={composeForm.textBody}
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            textBody: event.target.value,
                          }))
                        }
                      />

                      <textarea
                        className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
                        placeholder="Optional HTML body"
                        value={composeForm.htmlBody}
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            htmlBody: event.target.value,
                          }))
                        }
                      />

                      <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-2">
                        <Label htmlFor="compose-attachments">Attachments</Label>
                        <Input
                          id="compose-attachments"
                          type="file"
                          multiple
                          onChange={(event) =>
                            void addComposeAttachments(event)
                          }
                        />

                        {composeAttachments.length > 0 ? (
                          <div className="space-y-1 text-xs text-zinc-600">
                            {composeAttachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1"
                              >
                                <span>{attachment.filename}</span>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() =>
                                    setComposeAttachments((previous) =>
                                      previous.filter(
                                        (item) => item.id !== attachment.id,
                                      ),
                                    )
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={busyAction === "send-email"}
                      >
                        {busyAction === "send-email"
                          ? "Sending..."
                          : "Send Email"}
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Select a mailbox from the sidebar before composing.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Email Client</CardTitle>
                      <CardDescription>
                        Browse received and sent messages, inspect attachments,
                        and reply.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
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
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          selectedMailboxId
                            ? void loadEmails(selectedMailboxId, folder)
                            : undefined
                        }
                        disabled={!selectedMailboxId || loadingEmails}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {!selectedMailbox ? (
                    <p className="text-sm text-zinc-500">
                      Select a mailbox to view messages.
                    </p>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
                      <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
                        {loadingEmails ? (
                          <p className="text-sm text-zinc-500">
                            Loading messages...
                          </p>
                        ) : emails.length === 0 ? (
                          <p className="text-sm text-zinc-500">
                            No messages in this folder.
                          </p>
                        ) : (
                          emails.map((email) => {
                            const selected = email.id === selectedEmailId;

                            return (
                              <button
                                key={email.id}
                                type="button"
                                onClick={() => setSelectedEmailId(email.id)}
                                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                  selected
                                    ? "border-emerald-400 bg-emerald-50"
                                    : "border-zinc-200 bg-white hover:border-zinc-300"
                                }`}
                              >
                                <p className="truncate text-sm font-semibold">
                                  {email.subject}
                                </p>
                                <p className="truncate text-xs text-zinc-600">
                                  {email.from}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {buildSnippet(email.preview, 90)}
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  {formatTimestamp(email.createdAt)}
                                </p>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="max-h-[68vh] space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        {selectedEmail ? (
                          <>
                            <div className="space-y-1">
                              <p className="text-lg font-semibold">
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
                              <div className="rounded-lg border border-zinc-200 bg-white p-2">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                                  Attachments
                                </p>
                                <div className="space-y-1">
                                  {selectedEmail.attachments.map(
                                    (attachment) => (
                                      <div
                                        key={attachment.id}
                                        className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs"
                                      >
                                        <span>
                                          {attachment.filename || "attachment"}{" "}
                                          ({formatBytes(attachment.sizeBytes)})
                                        </span>
                                        {attachment.hasDownload ? (
                                          <a
                                            className="font-semibold text-emerald-700 underline"
                                            href={attachment.downloadPath}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Download
                                          </a>
                                        ) : (
                                          <span className="text-zinc-400">
                                            No file
                                          </span>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            ) : null}

                            {selectedEmail.textBody ? (
                              <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
                                {selectedEmail.textBody}
                              </pre>
                            ) : null}

                            {!selectedEmail.textBody &&
                            selectedEmail.htmlBody ? (
                              <iframe
                                title="email-html-preview"
                                className="h-[360px] w-full rounded-lg border border-zinc-200 bg-white"
                                srcDoc={selectedEmail.htmlBody}
                                sandbox=""
                              />
                            ) : null}

                            {selectedEmail.kind === "inbound" ? (
                              <div className="rounded-lg border border-zinc-200 bg-white p-2">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                                  Reply
                                </p>
                                <textarea
                                  className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
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
                                  disabled={
                                    busyAction === "reply" || !replyBody.trim()
                                  }
                                  onClick={() => void handleReply()}
                                >
                                  {busyAction === "reply"
                                    ? "Sending Reply..."
                                    : "Send Reply"}
                                </Button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-zinc-500">
                            Select a message from the list to open it.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      <footer className="sticky bottom-0 z-20 border-t border-zinc-200/70 bg-white/90 px-4 py-2 text-xs text-zinc-600 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2">
          <span>{statusMessage}</span>
          <span>
            Active mailbox: {selectedMailbox?.emailAddress || "none"} | Folder:{" "}
            {folder.toUpperCase()}
          </span>
        </div>
      </footer>
    </div>
  );
}
