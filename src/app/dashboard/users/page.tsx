import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return <DashboardClient tab="users" />;
}
