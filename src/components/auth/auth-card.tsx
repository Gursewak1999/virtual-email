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
    <Card className="mx-auto w-full max-w-md border-black/10 bg-white/90 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl">
          {mode === "login" ? "Sign In" : "Create Account"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Authenticate to access your virtual mailbox dashboard."
            : "Create an account to manage virtual mailbox credentials and inboxes."}
        </CardDescription>
      </CardHeader>

      <CardContent>
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

      <CardFooter className="justify-between">
        <span className="text-sm text-muted-foreground">
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </Button>
      </CardFooter>
    </Card>
  );
}
