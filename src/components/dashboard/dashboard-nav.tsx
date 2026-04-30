"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CommandIcon,
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
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
import { Input } from "@/components/ui/input";
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
    searchQuery,
    setSearchQuery,
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
    <div className="min-h-screen">
      <div className="mx-auto ">
        <div className="overflow-hidden  border-white/10 bg-[#070a11]/95 shadow-[0_32px_120px_-48px_rgba(15,23,42,0.95)]">
          <header className="border-b border-white/10 px-4 py-4 text-white sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="h-auto justify-start rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-white hover:bg-white/[0.07] hover:text-white"
                      />
                    }
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-[#0b1020] shadow-[0_10px_30px_-18px_rgba(255,255,255,0.9)]">
                      <CommandIcon className="size-4" />
                    </div>
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-base font-semibold tracking-tight">
                        IRCC Dashboard
                      </span>
                      <span className="truncate text-xs text-white/55">
                        {activeWorkspaceInfo.title}
                      </span>
                    </div>
                    <ChevronDownIcon className="size-4 text-white/60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {workspaceOptions.map((workspace) => (
                      <DropdownMenuItem
                        key={workspace.id}
                        onClick={() => setActiveWorkspace(workspace.id)}
                      >
                        <div className="grid leading-tight">
                          <span className="text-sm font-medium">
                            {workspace.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {workspace.description}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <nav
                className="mx-auto flex w-full max-w-fit items-center justify-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-2"
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
                        "relative flex size-11 shrink-0 items-center justify-center rounded-full border transition duration-200",
                        active
                          ? "border-white bg-white text-[#090d17] shadow-[0_14px_28px_-18px_rgba(255,255,255,0.95)]"
                          : "border-white/10 bg-transparent text-white/68 hover:bg-white/[0.08] hover:text-white",
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
                  {/* <div className="relative w-full min-w-[220px] max-w-sm">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-white/40 focus-visible:border-white/20 focus-visible:ring-white/15"
                      placeholder="Search inboxes, senders, or IDs"
                    />
                  </div> */}

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="relative rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
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
                          className="h-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white hover:bg-white/[0.08] hover:text-white"
                        />
                      }
                    >
                      <Avatar size="lg" className="ring-2 ring-white/10">
                        <AvatarFallback className="bg-white/10 text-white">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden min-w-0 text-left sm:grid">
                        <span className="truncate text-sm font-medium">
                          {user.name || "Operator"}
                        </span>
                        <span className="truncate text-xs text-white/50">
                          {user.email || "No email"}
                        </span>
                      </div>
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
                        onClick={() => signOut({ callbackUrl: "/auth" })}
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

          <div className="px-3 pb-4 pt-4 sm:px-4 lg:px-5">
            {/* <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/35">
                  Command Center
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
                  {activePage}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.06]">
                  {selectedMailbox?.emailAddress || "No inbox selected"}
                </Badge>
                <Badge className="border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.06]">
                  Folder {folder.toUpperCase()}
                </Badge>
                <span className="max-w-xl truncate text-xs text-white/45">
                  {statusMessage}
                </span>
              </div>
            </div> */}

            {children}
          </div>

          <footer className="border-t border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/45 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{statusMessage}</span>
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
