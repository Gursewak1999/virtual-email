"use client";

import { CheckCheckIcon, WorkflowIcon } from "lucide-react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ActivityDashboardClient() {
  const { recentActivity, dashboardMetrics } = useDashboardState();

  return (
    <div className="flex-1">
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
                    className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
                  >
                    <span className="mt-1 inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCheckIcon className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{event.label}</p>
                      <p className="text-xs ">{event.timestamp}</p>
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
          <CardContent className="space-y-2 text-sm ">
            <div className="rounded-xl border  p-3">
              <p className="text-xs uppercase tracking-[0.12em] ">
                Active Mailboxes
              </p>
              <p className="mt-1 text-2xl font-semibold ">
                {dashboardMetrics.activeMailboxes}
              </p>
            </div>
            <div className="rounded-xl border  p-3">
              <p className="text-xs uppercase tracking-[0.12em] ">
                Inbound Queue
              </p>
              <p className="mt-1 text-2xl font-semibold ">
                {dashboardMetrics.totalInbox}
              </p>
            </div>
            <div className="rounded-xl border  p-3">
              <p className="text-xs uppercase tracking-[0.12em] ">
                Sent Throughput
              </p>
              <p className="mt-1 text-2xl font-semibold ">
                {dashboardMetrics.totalSent}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
