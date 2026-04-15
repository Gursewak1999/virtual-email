import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_45%),radial-gradient(circle_at_88%_4%,color-mix(in_oklab,var(--chart-2)_18%,transparent),transparent_42%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1120px] items-stretch gap-5 lg:grid-cols-[1fr_440px]">
        <section className="hidden rounded-3xl border bg-card p-8 text-card-foreground shadow-sm lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              shadcn Admin Auth
            </p>
            <h1 className="mt-3 max-w-xl font-heading text-4xl leading-[1.08] font-bold tracking-tight">
              Access your operations dashboard.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Authenticate once to access your full operational stack: identity
              provisioning, inbound triage, and high-confidence reply workflows.
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Operator Flow
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              New users can create an account in one step and are routed
              directly into the dashboard after secure credential setup.
            </p>
          </div>
        </section>

        <div className="flex flex-col items-stretch justify-center gap-3">
          <div className="flex justify-end">
            <Link
              href="/"
              className="rounded-full border bg-background/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
            >
              Back to Home
            </Link>
          </div>

          <AuthCard />
        </div>
      </div>
    </div>
  );
}
