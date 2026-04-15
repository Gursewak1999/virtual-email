import Link from "next/link";

const features = [
  {
    title: "Virtual Mailbox Generation",
    body: "Create unique mailbox identities mapped to passport IDs and custom labels.",
  },
  {
    title: "Credential Vault",
    body: "Store mailbox passwords in encrypted form and reveal/copy them on-demand.",
  },
  {
    title: "Inbox + Sent Client",
    body: "Open inbound and sent folders per mailbox with full message previews and details.",
  },
  {
    title: "Attachments + Reply Flow",
    body: "Download received attachments, compose with uploads, and send reply or reply-all.",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.24),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(251,191,36,0.22),transparent_45%),linear-gradient(120deg,#0a0f1f_0%,#101a31_52%,#1a2b4d_100%)] text-zinc-100">
      <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.04)_100%)]" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12 lg:px-10">
        <header className="mb-12 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Virtual Email Control Center
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="rounded-full border border-zinc-300/30 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-200/60 hover:bg-white/10"
            >
              Login / Signup
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
            >
              Open Dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <h1 className="max-w-3xl font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Build and operate virtual email identities with a full mailbox
              client.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-zinc-200/90 sm:text-lg">
              Generate controlled email accounts, map them to passport IDs,
              securely manage passwords, and run inbox workflows from one
              unified operational dashboard.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-200/80">
              <span className="rounded-full border border-zinc-200/30 bg-white/5 px-3 py-1">
                Account Provisioning
              </span>
              <span className="rounded-full border border-zinc-200/30 bg-white/5 px-3 py-1">
                Email Client
              </span>
              <span className="rounded-full border border-zinc-200/30 bg-white/5 px-3 py-1">
                Attachment Workflows
              </span>
              <span className="rounded-full border border-zinc-200/30 bg-white/5 px-3 py-1">
                Reply + Reply All
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-zinc-300/25 bg-white/10 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur"
              >
                <h2 className="mb-1 text-lg font-semibold text-emerald-300">
                  {feature.title}
                </h2>
                <p className="text-sm leading-6 text-zinc-100/90">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-zinc-300/25 bg-black/20 p-5 backdrop-blur">
          <p className="text-sm text-zinc-200/80">
            Start by creating an operator account, then provision mailbox
            credentials against passport IDs and manage communication lifecycle
            from inbox to reply.
          </p>
        </section>
      </main>
    </div>
  );
}
