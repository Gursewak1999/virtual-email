import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardSessionProvider } from "@/components/dashboard/dashboard-session-provider";
import { DashboardStateProvider } from "@/components/dashboard/dashboard-state-provider";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  return (
    <DashboardSessionProvider user={sessionUser}>
      <DashboardStateProvider>
        <DashboardNav>{children}</DashboardNav>
      </DashboardStateProvider>
    </DashboardSessionProvider>
  );
}
