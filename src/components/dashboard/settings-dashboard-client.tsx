"use client";

import { useEffect, useState } from "react";
import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  clearUnlockedPrivateKey,
  decryptPrivateKey,
  decryptDataForUser,
  loadUnlockedPrivateKey,
  storeUnlockedPrivateKey,
} from "@/lib/e2ee";

interface VaultRecordPayload {
  id: string;
  titleHint: string | null;
  encryptedPayload: string;
  encryptedPayloadIv: string;
  wrappedKey: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultRecordView {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export function SettingsDashboardClient() {
  const { user } = useDashboardState();
  const router = useRouter();
  const [masterRecoveryKey, setMasterRecoveryKey] = useState("");
  const [vaultStatus, setVaultStatus] = useState<string | null>(null);
  const [vaultTitle, setVaultTitle] = useState("");
  const [vaultBody, setVaultBody] = useState("");
  const [vaultRecords, setVaultRecords] = useState<VaultRecordView[]>([]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [loadingVaultRecords, setLoadingVaultRecords] = useState(false);

  useEffect(() => {
    const privateKeyJwk = loadUnlockedPrivateKey();
    if (privateKeyJwk) {
      setVaultStatus("Vault is already unlocked in this browser session.");
      void loadVaultRecords(privateKeyJwk);
    }
  }, []);

  async function loadVaultRecords(privateKeyJwk?: string): Promise<void> {
    const unlockedPrivateKey = privateKeyJwk ?? loadUnlockedPrivateKey();

    if (!unlockedPrivateKey) {
      setVaultStatus("Unlock the vault before loading encrypted records.");
      return;
    }

    setLoadingVaultRecords(true);

    try {
      const response = await fetch("/api/vault-records", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        records?: VaultRecordPayload[];
      } | null;

      if (!response.ok || !payload?.ok || !payload.records) {
        throw new Error(payload?.error ?? "Failed to load vault records");
      }

      const decrypted = await Promise.all(
        payload.records.map(async (record) => {
          const plaintext = await decryptDataForUser(
            {
              ciphertext: record.encryptedPayload,
              iv: record.encryptedPayloadIv,
              wrappedKey: record.wrappedKey,
            },
            unlockedPrivateKey,
          );

          const parsed = JSON.parse(plaintext) as {
            title?: string;
            body?: string;
          };

          return {
            id: record.id,
            title: parsed.title ?? record.titleHint ?? "Encrypted record",
            body: parsed.body ?? "",
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          } satisfies VaultRecordView;
        }),
      );

      setVaultRecords(decrypted);
      setVaultStatus(`Loaded ${decrypted.length} encrypted record(s).`);
    } catch (error) {
      setVaultStatus(
        error instanceof Error ? error.message : "Failed to load vault records",
      );
    } finally {
      setLoadingVaultRecords(false);
    }
  }

  async function handleUnlockVault(): Promise<void> {
    if (
      !user.encryptedPrivateKey ||
      !user.encryptedPrivateKeyIv ||
      !user.encryptedPrivateKeySalt ||
      !user.encryptedPrivateKeyRounds
    ) {
      setVaultStatus("This account does not yet have vault material stored.");
      return;
    }

    if (!masterRecoveryKey.trim()) {
      setVaultStatus("Enter the master recovery key to unlock the vault.");
      return;
    }

    const privateKeyJwk = await decryptPrivateKey(
      {
        ciphertext: user.encryptedPrivateKey,
        iv: user.encryptedPrivateKeyIv,
        salt: user.encryptedPrivateKeySalt,
        rounds: user.encryptedPrivateKeyRounds,
      },
      masterRecoveryKey.trim(),
    );

    storeUnlockedPrivateKey(privateKeyJwk);
    setVaultStatus("Vault unlocked. The private key is stored in sessionStorage.");
    setMasterRecoveryKey("");
    await loadVaultRecords(privateKeyJwk);
  }

  async function handleSaveVaultRecord(): Promise<void> {
    const unlockedPrivateKey = loadUnlockedPrivateKey();

    if (!unlockedPrivateKey) {
      setVaultStatus("Unlock the vault before creating or updating records.");
      return;
    }

    if (!vaultTitle.trim() || !vaultBody.trim()) {
      setVaultStatus("Both title and body are required.");
      return;
    }

    const endpoint = editingRecordId
      ? `/api/vault-records/${editingRecordId}`
      : "/api/vault-records";
    const method = editingRecordId ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: vaultTitle.trim(),
        body: vaultBody.trim(),
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if (!response.ok || !payload?.ok) {
      setVaultStatus(payload?.error ?? "Failed to save encrypted record");
      return;
    }

    setVaultTitle("");
    setVaultBody("");
    setEditingRecordId(null);
    setVaultStatus(editingRecordId ? "Encrypted record updated." : "Encrypted record created.");
    await loadVaultRecords(unlockedPrivateKey);
  }

  async function handleDeleteVaultRecord(recordId: string): Promise<void> {
    const response = await fetch(`/api/vault-records/${recordId}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if (!response.ok || !payload?.ok) {
      setVaultStatus(payload?.error ?? "Failed to delete encrypted record");
      return;
    }

    setVaultStatus("Encrypted record deleted.");
    await loadVaultRecords();
  }

  function handleEditVaultRecord(record: VaultRecordView): void {
    setEditingRecordId(record.id);
    setVaultTitle(record.title);
    setVaultBody(record.body);
    setVaultStatus("Editing decrypted record content.");
  }

  async function handleSignOut(): Promise<void> {
    clearUnlockedPrivateKey();
    await signOut({ callbackUrl: "/auth" });
  }

  return (
    <div className="flex-1">
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace Settings</CardTitle>
            <CardDescription>
              Configure default behavior for notifications and inbox workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm ">
            <label className="flex items-center gap-2 rounded-lg border  px-3 py-2">
              <input type="checkbox" defaultChecked />
              Auto-refresh active inbox every 60 seconds
            </label>
            <label className="flex items-center gap-2 rounded-lg border  px-3 py-2">
              <input type="checkbox" defaultChecked />
              Show popup notifications for new inbound emails
            </label>
            <label className="flex items-center gap-2 rounded-lg border  px-3 py-2">
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
            <div className="rounded-xl border  p-3">
              <p className="text-sm font-semibold ">
                {user.name || "Operator"}
              </p>
              <p className="text-xs ">{user.email || "No email"}</p>
            </div>

            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/users")}
            >
              Manage Inboxes
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleSignOut()}
            >
              <LogOutIcon />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Encrypted Vault</CardTitle>
            <CardDescription>
              Unlock the browser-local private key with your master recovery key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="masterRecoveryKey">
                  Master Recovery Key
                </label>
                <input
                  id="masterRecoveryKey"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-offset-background transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  type="password"
                  value={masterRecoveryKey}
                  onChange={(event) => setMasterRecoveryKey(event.target.value)}
                  placeholder="Enter the 16-character recovery key"
                />
              </div>

              <div className="flex items-end">
                <Button type="button" onClick={() => void handleUnlockVault()}>
                  Unlock Vault
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              {vaultStatus ??
                "The decrypted private key is only stored in sessionStorage after you unlock it here."}
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Recovery codes restore account access only. The master recovery key is
              required to recover encrypted data if all synced passkey devices are lost.
            </p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Encrypted Records</CardTitle>
            <CardDescription>
              Create, edit, and delete records that are encrypted server-side and
              decrypted locally after unlocking the vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="vaultTitle">
                  Title
                </label>
                <input
                  id="vaultTitle"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-offset-background transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={vaultTitle}
                  onChange={(event) => setVaultTitle(event.target.value)}
                  placeholder="Confidential case note"
                />
              </div>

              <div className="space-y-2 lg:col-span-1">
                <label className="text-sm font-medium" htmlFor="vaultBody">
                  Body
                </label>
                <textarea
                  id="vaultBody"
                  className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={vaultBody}
                  onChange={(event) => setVaultBody(event.target.value)}
                  placeholder="Store private case details here"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleSaveVaultRecord()}>
                {editingRecordId ? "Update Record" : "Create Record"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadVaultRecords()}
                disabled={loadingVaultRecords}
              >
                Refresh Records
              </Button>
              {editingRecordId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingRecordId(null);
                    setVaultTitle("");
                    setVaultBody("");
                  }}
                >
                  Cancel Edit
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              {vaultRecords.length === 0 ? (
                <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  No encrypted records yet.
                </div>
              ) : (
                vaultRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{record.title}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {record.body}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditVaultRecord(record)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => void handleDeleteVaultRecord(record.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Updated {new Date(record.updatedAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
