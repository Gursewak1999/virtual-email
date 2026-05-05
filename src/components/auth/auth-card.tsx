"use client";

import { useMemo, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import {
  encryptPrivateKey,
  exportPrivateKeyJwk,
  exportPublicKeyJwk,
  generateMasterRecoveryKey,
  generateUserEncryptionKeyPair,
  storeUnlockedPrivateKey,
} from "@/lib/e2ee";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

interface RegistrationSuccessState {
  masterRecoveryKey: string;
  recoveryCodes: string[];
}

export function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") || "/dashboard",
    [searchParams],
  );

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] =
    useState<RegistrationSuccessState | null>(null);

  async function handlePasskeyLogin(): Promise<void> {
    const beginResponse = await fetch("/api/auth/passkey/login/begin", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const beginPayload = (await beginResponse.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      options?: Parameters<typeof startAuthentication>[0];
    } | null;

    if (!beginResponse.ok || !beginPayload?.ok || !beginPayload.options) {
      throw new Error(beginPayload?.error ?? "Unable to start passkey login");
    }

    const authenticationResponse = await startAuthentication(beginPayload.options);

    const result = await signIn("credentials", {
      email,
      authResponse: JSON.stringify(authenticationResponse),
      redirect: false,
      callbackUrl,
    });

    if (!result?.ok) {
      throw new Error("Passkey sign-in failed");
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  async function handleRecoveryLogin(): Promise<void> {
    const result = await signIn("credentials", {
      email,
      recoveryCode,
      redirect: false,
      callbackUrl,
    });

    if (!result?.ok) {
      throw new Error("Recovery code sign-in failed");
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  async function handleSignup(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const userId = globalThis.crypto.randomUUID();
    const keyPair = await generateUserEncryptionKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair.publicKey);
    const privateKeyJwk = await exportPrivateKeyJwk(keyPair.privateKey);
    const masterRecoveryKey = generateMasterRecoveryKey();
    const encryptedPrivateKey = await encryptPrivateKey(
      privateKeyJwk,
      masterRecoveryKey,
    );

    const beginResponse = await fetch("/api/auth/passkey/register/begin", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId,
        email: trimmedEmail,
        name: trimmedName,
      }),
    });

    const beginPayload = (await beginResponse.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      options?: Parameters<typeof startRegistration>[0];
    } | null;

    if (!beginResponse.ok || !beginPayload?.ok || !beginPayload.options) {
      throw new Error(beginPayload?.error ?? "Unable to start registration");
    }

    const registrationResponse = await startRegistration(beginPayload.options);

    const completeResponse = await fetch(
      "/api/auth/passkey/register/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId,
          email: trimmedEmail,
          name: trimmedName,
          registrationResponse,
          vault: {
            publicKeyJwk,
            encryptedPrivateKey: encryptedPrivateKey.ciphertext,
            encryptedPrivateKeyIv: encryptedPrivateKey.iv,
            encryptedPrivateKeySalt: encryptedPrivateKey.salt,
            encryptedPrivateKeyRounds: encryptedPrivateKey.rounds,
          },
        }),
      },
    );

    const completePayload = (await completeResponse.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      recoveryCodes?: string[];
    } | null;

    if (!completeResponse.ok || !completePayload?.ok) {
      throw new Error(completePayload?.error ?? "Registration failed");
    }

    storeUnlockedPrivateKey(privateKeyJwk);
    setRegistrationSuccess({
      masterRecoveryKey,
      recoveryCodes: completePayload.recoveryCodes ?? [],
    });
    setMode("login");
    setRecoveryCode("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Name is required");
      return;
    }

    if (mode === "login" && !recoveryCode.trim()) {
      // Passkey login does not require a recovery code, but empty login should
      // fall through to passkey instead of submitting an unusable code.
    }

    setBusy(true);
    setError(null);

    try {
      if (mode === "login") {
        if (recoveryCode.trim()) {
          await handleRecoveryLogin();
        } else {
          await handlePasskeyLogin();
        }
      } else {
        await handleSignup();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Authentication failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-3xl border shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="rounded-full border bg-muted px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Passkey Access
          </p>

          <div className="grid grid-cols-2 rounded-full border bg-muted/60 p-1 text-xs font-semibold text-muted-foreground">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 transition ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/80"
              }`}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 transition ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/80"
              }`}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              Create
            </button>
          </div>
        </div>

        <CardTitle className="text-2xl">
          {mode === "login" ? "Welcome back" : "Create your operator account"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Use your passkey to sign in, or fall back to a recovery code if needed."
            : "Create a passkey, generate your encrypted vault key, and save your recovery material."}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Chen"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {mode === "login" ? (
            <div className="space-y-2">
              <Label htmlFor="recoveryCode">Recovery Code</Label>
              <Input
                id="recoveryCode"
                autoComplete="one-time-code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                placeholder="Optional fallback code"
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <Button disabled={busy} className="w-full" type="submit">
            {busy
              ? mode === "login"
                ? "Signing In..."
                : "Creating Account..."
              : mode === "login"
                ? recoveryCode.trim()
                  ? "Use Recovery Code"
                  : "Use Passkey"
                : "Create Account"}
          </Button>
        </form>

        {registrationSuccess ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                Save this immediately
              </p>
              <p className="mt-2 text-sm leading-6">
                Your passkey is registered. Store the master recovery key below in a
                safe offline location. It is required to decrypt the private key on a
                new device.
              </p>
            </div>

            <div className="grid gap-2 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Master Recovery Key
                </p>
                <p className="mt-1 font-mono text-base font-semibold tracking-[0.2em]">
                  {registrationSuccess.masterRecoveryKey}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Recovery Codes
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {registrationSuccess.recoveryCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs font-semibold tracking-[0.16em]"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-center border-t bg-muted/40 text-center text-xs text-muted-foreground">
        {mode === "login"
          ? "Passkeys sync across supported Apple and Google devices; recovery codes are one-time fallback access only."
          : "After registration, keep the master recovery key offline. It is the only way to recover encrypted data if all synced passkeys are lost."}
      </CardFooter>
    </Card>
  );
}
