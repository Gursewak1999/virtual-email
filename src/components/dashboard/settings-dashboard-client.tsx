"use client";

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

export function SettingsDashboardClient() {
  const { user } = useDashboardState();
  const router = useRouter();

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
    </div>
  );
}
