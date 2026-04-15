import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-lime-50 to-cyan-50 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.18),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(16,185,129,0.18),transparent_45%)]" />
      <div className="relative z-10 w-full max-w-md">
        <AuthCard />
      </div>
    </div>
  );
}
