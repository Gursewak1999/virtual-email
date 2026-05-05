"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CommandIcon,
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  Settings2Icon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import { clearUnlockedPrivateKey } from "@/lib/e2ee";
import {
  navTabs,
  workspaceOptions,
} from "@/components/dashboard/dashboard-shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { cn } from "@/lib/utils";

interface DashboardNavProps {
  children: ReactNode;
}

const dashboardShellNavItems = [
  ...navTabs,
  {
    id: "settings",
    title: "Settings",
    icon: Settings2Icon,
    href: "/dashboard/settings",
  },
] as const;

function getInitials(value: string | null | undefined): string {
  const parts = value?.split(" ").filter(Boolean) || [];
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "IR"
  );
}

export function DashboardNav({ children }: DashboardNavProps) {
  const {
    activeWorkspaceInfo,
    setActiveWorkspace,
    user,
    totalUnread,
    notificationItems,
    setSelectedMailboxId,
    setFolder,
    statusMessage,
    selectedMailbox,
    folder,
  } = useDashboardState();
  const pathname = usePathname();
  const router = useRouter();

  const normalizedPath =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  function isRouteActive(href: string): boolean {
    if (href === "/dashboard") {
      return normalizedPath === "/dashboard";
    }

    return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
  }

  const activePage =
    dashboardShellNavItems.find((item) => isRouteActive(item.href))?.title ||
    "Dashboard";
  const userInitials = getInitials(user.name);

  return (
    <div className="dashboard-app h-dvh overflow-hidden">
      <div className="h-full w-full">
        <div className="mx-auto flex h-full flex-col overflow-hidden bg-[color:var(--dashboard-shell)] shadow-[0_24px_90px_-50px_rgba(15,23,42,0.42)] ">
          <header className="shrink-0 border-b border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-shell-strong)] px-3 py-2.5 sm:px-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
              <div className="flex items-center gap-3">
                {/* //logo goes here */}
                <CommandIcon className="size-5 text-[color:var(--dashboard-text-muted)]" />
              </div>

              <nav
                className="mx-auto flex w-full max-w-fit items-center justify-center gap-1.5 overflow-x-auto rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] px-1.5 py-1.5"
                aria-label="Dashboard sections"
              >
                {dashboardShellNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(item.href);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      title={item.title}
                      onClick={() => {
                        if (item.href === "/dashboard") {
                          setFolder("inbox");
                        }
                      }}
                      className={cn(
                        "relative flex size-8 shrink-0 items-center justify-center rounded-full border transition duration-200",
                        active
                          ? "border-accent border-2 bg-[color:var(--dashboard-button)] text-[color:var(--dashboard-button-text)] shadow-[0_12px_24px_-18px_rgba(15,23,42,0.4)]"
                          : "border-[color:var(--dashboard-border)] bg-transparent text-[color:var(--dashboard-text-muted)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.id === "inboxes" && totalUnread > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#74b9ff] px-1 text-[10px] font-semibold text-[#06101d]">
                          {Math.min(totalUnread, 99)}
                        </span>
                      ) : null}
                      <span className="sr-only">{item.title}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <ThemeToggleButton className="size-8" />

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          className="size-8 relative rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] text-[color:var(--dashboard-text-muted)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]"
                        />
                      }
                    >
                      <BellIcon />
                      {totalUnread > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#74b9ff] px-1 text-[10px] font-semibold text-[#06101d]">
                          {Math.min(totalUnread, 99)}
                        </span>
                      ) : null}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel>
                        New Email Notifications
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {notificationItems.length === 0 ? (
                        <p className="px-2 py-2 text-sm text-muted-foreground">
                          No new inbound notifications.
                        </p>
                      ) : (
                        notificationItems.map((mailbox) => (
                          <DropdownMenuItem
                            key={mailbox.id}
                            onClick={() => {
                              setSelectedMailboxId(mailbox.id);
                              setFolder("inbox");
                              router.push("/dashboard");
                            }}
                          >
                            <div className="flex w-full items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {mailbox.label || mailbox.emailAddress}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {mailbox.emailAddress}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                {mailbox.inboxCount}
                              </Badge>
                            </div>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          className="h-8 rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] px-1.5 py-1 text-[color:var(--dashboard-text)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]"
                        />
                      }
                    >
                      {userInitials}
                      {/* <div className="hidden min-w-0 text-left sm:grid p-x-2">
                        <span className="truncate text-xs font-medium">
                          {user.name || "Operator"}
                        </span>
                        <span className="truncate text-[11px] text-[color:var(--dashboard-text-soft)]">
                          {user.email || "No email"}
                        </span>
                      </div> */}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>
                        <div className="grid leading-tight">
                          <span className="text-sm font-medium">
                            {user.name || "Operator"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.email || "No email"}
                          </span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => router.push("/dashboard/users")}
                      >
                        Manage Users
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push("/dashboard/settings")}
                      >
                        Workspace Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          clearUnlockedPrivateKey();
                          void signOut({ callbackUrl: "/auth" });
                        }}
                      >
                        <LogOutIcon />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5 sm:px-3.5 lg:px-4">
            <div className="mx-auto flex h-full min-h-0 flex-col">
              {children}
            </div>
          </main>

          <footer className="shrink-0 border-t border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-shell-strong)] px-3 py-2 text-[11px] text-[color:var(--dashboard-text-soft)] sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {activePage} · {statusMessage}
              </span>
              <span>
                Active inbox: {selectedMailbox?.emailAddress || "none"} ·
                Folder: {folder.toUpperCase()} · Unread: {totalUnread}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
