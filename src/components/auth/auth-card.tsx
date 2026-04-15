"use client";

import { useMemo, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(): Promise<void> {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (!result?.ok) {
      setError("Invalid email or password");
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  async function handleSignup(): Promise<void> {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? "Signup failed");
      return;
    }

    await handleLogin();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (mode === "login") {
        await handleLogin();
      } else {
        await handleSignup();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-3xl border shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="rounded-full border bg-muted px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Secure Access
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
            ? "Authenticate to enter your mailbox operations workspace."
            : "Register now to start managing secure virtual mailbox identities."}
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

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

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
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t bg-muted/40 text-center text-xs text-muted-foreground">
        {mode === "login"
          ? "Use your existing operator credentials to continue."
          : "Your account will sign in automatically after successful registration."}
      </CardFooter>
    </Card>
  );
}
