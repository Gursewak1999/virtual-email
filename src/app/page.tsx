import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Gauge,
  Inbox,
  KeyRound,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { buildSnippet, stripHtml } from "@/lib/email-helpers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

const features = [
  {
    icon: ShieldCheck,
    title: "Virtual Mailbox Generation",
    body: "Provision identity-specific mailbox accounts tied to passport IDs with governance-ready labels.",
  },
  {
    icon: KeyRound,
    title: "Credential Vault",
    body: "Keep mailbox secrets encrypted and reveal them only when a verified operator actually needs access.",
  },
  {
    icon: Inbox,
    title: "Inbox + Sent Client",
    body: "Run inbox and sent operations from one pane with immediate context, previews, and message trails.",
  },
  {
    icon: Workflow,
    title: "Attachments + Reply Flow",
    body: "Handle attachment download/upload, response drafting, and reply-all execution in a single workflow.",
  },
];

interface HomeRecentEmail {
  id: string;
  subject: string;
  from: string;
  mailboxDisplay: string;
  mailboxPassportId: string;
  createdAt: Date;
  preview: string;
}

export default async function Home() {
  const sessionUser = await getSessionUser();
  let recentEmails: HomeRecentEmail[] = [];

  if (sessionUser) {
    const ownedMailboxes = await prisma.virtualMailbox.findMany({
      where: {
        ownerId: sessionUser.id,
      },
      select: {
        passportId: true,
        emailAddress: true,
        label: true,
      },
    });

    const mailboxByAddress = new Map(
      ownedMailboxes.map((mailbox) => [
        mailbox.emailAddress.toLowerCase(),
        mailbox,
      ]),
    );

    if (ownedMailboxes.length > 0) {
      const trackedAddresses = ownedMailboxes.map((mailbox) =>
        mailbox.emailAddress.toLowerCase(),
      );

      const inboundEmails = await prisma.inboundEmail.findMany({
        where: {
          OR: [
            { toAddresses: { hasSome: trackedAddresses } },
            { ccAddresses: { hasSome: trackedAddresses } },
          ],
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 16,
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          fromRaw: true,
          toAddresses: true,
          ccAddresses: true,
          textBody: true,
          htmlBody: true,
          createdAt: true,
        },
      });

      recentEmails = inboundEmails.slice(0, 10).map((email) => {
        const relatedAddress = [...email.toAddresses, ...email.ccAddresses]
          .map((address) => address.toLowerCase())
          .find((address) => mailboxByAddress.has(address));

        const relatedMailbox = relatedAddress
          ? mailboxByAddress.get(relatedAddress)
          : undefined;

        return {
          id: email.id,
          subject: email.subject || "(No subject)",
          from: email.fromAddress || email.fromRaw || "Unknown sender",
          mailboxDisplay:
            relatedMailbox?.label ||
            relatedMailbox?.emailAddress ||
            "Unmapped mailbox",
          mailboxPassportId: relatedMailbox?.passportId || "N/A",
          createdAt: email.createdAt,
          preview: buildSnippet(
            email.textBody || stripHtml(email.htmlBody || ""),
            120,
          ),
        };
      });
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden vibe-grid">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_3%_20%,rgba(245,158,11,0.2),transparent_32%),radial-gradient(circle_at_92%_4%,rgba(59,130,246,0.15),transparent_42%),radial-gradient(circle_at_82%_82%,rgba(16,185,129,0.15),transparent_40%)]" />

      <main className="relative z-10 mx-auto flex w-full max-w-[1300px] flex-col gap-8 px-4 py-8 sm:px-8 lg:py-10">
        <header className="animate-rise-in flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/75 px-4 py-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Virtual Mail Control Center
            </p>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-zinc-900">
              Operational Command Interface
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="rounded-full border border-zinc-300 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-white"
            >
              Login / Signup
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#f59e0b,#f97316)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(249,115,22,0.75)] transition hover:-translate-y-0.5"
            >
              Open Dashboard
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="vibe-shell animate-rise-in rounded-3xl p-6 sm:p-8">
            <p className="mb-3 inline-flex items-center rounded-full border border-amber-200/80 bg-amber-100/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-amber-800">
              High-trust messaging orchestration
            </p>
            <h1 className="max-w-3xl font-heading text-4xl leading-[1.05] font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
              CRED-grade presence.
              <br />
              Zapier-grade execution.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
              Stand up virtual identities, secure credentials, and power full
              inbound-to-reply workflows through one intentional control
              surface.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
              <span className="rounded-full border border-zinc-300 bg-white/80 px-3 py-1">
                Account Provisioning
              </span>
              <span className="rounded-full border border-zinc-300 bg-white/80 px-3 py-1">
                Email Client
              </span>
              <span className="rounded-full border border-zinc-300 bg-white/80 px-3 py-1">
                Attachment Workflows
              </span>
              <span className="rounded-full border border-zinc-300 bg-white/80 px-3 py-1">
                Reply + Reply All
              </span>
            </div>
          </div>

          <div className="grid gap-4 animate-rise-in [animation-delay:120ms]">
            <article className="vibe-shell rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Live command score
              </p>
              <div className="mt-3 space-y-3">
                <div className="flex items-end justify-between rounded-xl border border-white/65 bg-white/75 p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Mailbox reliability
                    </p>
                    <p className="font-heading text-3xl font-bold text-zinc-900">
                      99.94%
                    </p>
                  </div>
                  <Gauge className="size-10 text-amber-500" />
                </div>

                <div className="rounded-xl border border-white/65 bg-white/75 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    <span>Response velocity</span>
                    <span className="text-emerald-600">+18%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div className="vibe-line h-full w-[76%]" />
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-300/80 bg-zinc-950 p-5 text-zinc-100 shadow-[0_20px_44px_-28px_rgba(15,23,42,0.75)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Blueprint
              </p>
              <h3 className="mt-2 font-heading text-xl font-semibold">
                Command center for identity-based communications.
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Built for operators who need precision, auditability, and speed
                in one secure layer.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="vibe-shell animate-rise-in rounded-2xl p-4 [animation-delay:220ms]"
                style={{ animationDelay: `${220 + index * 70}ms` }}
              >
                <Icon className="mb-3 size-5 text-amber-600" />
                <h2 className="mb-2 font-heading text-lg font-semibold text-zinc-900">
                  {feature.title}
                </h2>
                <p className="text-sm leading-6 text-zinc-600">
                  {feature.body}
                </p>
              </article>
            );
          })}
        </section>

        <section className="vibe-shell animate-rise-in rounded-2xl p-5 [animation-delay:360ms]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Homepage Email Feed
              </p>
              <h2 className="font-heading text-2xl font-semibold text-zinc-900">
                Recent Emails
              </h2>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/80 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
            >
              Open Full Dashboard
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {!sessionUser ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
              Sign in to see your latest inbound emails from all virtual
              inboxes.
            </p>
          ) : recentEmails.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-sm text-zinc-600">
              No inbound emails yet. Create a mailbox and messages will appear
              here.
            </p>
          ) : (
            <div className="space-y-2">
              {recentEmails.map((email) => (
                <article
                  key={email.id}
                  className="rounded-xl border border-zinc-200 bg-white/85 px-3 py-3"
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {email.subject}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                      <Clock3 className="size-3" />
                      {new Date(email.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600">From: {email.from}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Inbox: {email.mailboxDisplay} · UID:{" "}
                    {email.mailboxPassportId}
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">{email.preview}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="vibe-shell animate-rise-in rounded-2xl p-5 [animation-delay:440ms]">
          <p className="text-sm text-zinc-600">
            Start by creating an operator account, then provision mailbox
            credentials against passport IDs and manage communication lifecycle
            from inbox to reply.
          </p>
        </section>
      </main>
    </div>
  );
}
