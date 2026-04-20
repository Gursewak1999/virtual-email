"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  BellIcon,
  ChevronDownIcon,
  InboxIcon,
  LogOutIcon,
  SearchIcon,
  Settings2Icon,
  UserIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { useDashboardState } from "@/components/dashboard/dashboard-state-provider";
import {
  navTabs,
  workspaceOptions,
} from "@/components/dashboard/dashboard-shared";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface DashboardNavProps {
  children: ReactNode;
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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16.5rem",
          "--header-height": "3.5rem",
        } as CSSProperties
      }
    >
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="aria-expanded:bg-sidebar-accent"
                    />
                  }
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <InboxIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="text-sm font-semibold">
                      {activeWorkspaceInfo.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.email || activeWorkspaceInfo.description}
                    </span>
                  </div>
                  <ChevronDownIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu
                style={{
                  gap: "0.5rem",
                }}
              >
                {navTabs.map((tab) => {
                  const Icon = tab.icon;

                  return (
                    <SidebarMenuItem key={tab.id}>
                      <SidebarMenuButton
                        isActive={isRouteActive(tab.href)}
                        tooltip={tab.title}
                        onClick={() => router.push(tab.href)}
                      >
                        <Icon />
                        <span>{tab.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isRouteActive("/dashboard/settings")}
                onClick={() => router.push("/dashboard/settings")}
              >
                <Settings2Icon />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-(--header-height) items-center gap-2 border-b bg-background/95 px-3 backdrop-blur-xl md:px-4">
          <SidebarTrigger className="-ml-1" />

          <div className="relative w-full max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
              placeholder="Search inboxes, senders, subjects, or IDs"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    className="relative"
                  />
                }
              >
                <BellIcon />
                {totalUnread > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {Math.min(totalUnread, 99)}
                  </span>
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>New Email Notifications</DropdownMenuLabel>
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
                        <Badge variant="secondary">{mailbox.inboxCount}</Badge>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon-sm" variant="outline" />}
              >
                <UserIcon />
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
        </header>

        {children}

        <footer className="border-t bg-background/90 px-4 py-2 text-xs text-zinc-600 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2">
            <span>{statusMessage}</span>
            <span>
              Active inbox: {selectedMailbox?.emailAddress || "none"} · Folder:{" "}
              {folder.toUpperCase()} · Unread: {totalUnread}
            </span>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
