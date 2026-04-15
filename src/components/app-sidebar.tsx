"use client";

import * as React from "react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  ActivityIcon,
  CommandIcon,
  Clock3Icon,
  DatabaseIcon,
  FileChartColumnIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  MailIcon,
  ShieldAlertIcon,
  Settings2Icon,
} from "lucide-react";

const defaultUser = {
  name: "Operator",
  email: "operator@example.com",
  avatar: "",
};

const data = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Mailbox Operations",
      url: "/dashboard",
      icon: <MailIcon />,
    },
    {
      title: "Queue Monitor",
      url: "/dashboard",
      icon: <FileChartColumnIcon />,
    },
    {
      title: "SLA Watch",
      url: "/dashboard",
      icon: <Clock3Icon />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard",
      icon: <Settings2Icon />,
    },
    {
      title: "Help",
      url: "/",
      icon: <LifeBuoyIcon />,
    },
  ],
  documents: [
    {
      name: "Inbound Events",
      url: "/dashboard",
      icon: <DatabaseIcon />,
    },
    {
      name: "Delivery Reports",
      url: "/dashboard",
      icon: <FileChartColumnIcon />,
    },
    {
      name: "Escalation Log",
      url: "/dashboard",
      icon: <ShieldAlertIcon />,
    },
    {
      name: "Live Health",
      url: "/dashboard",
      icon: <ActivityIcon />,
    },
  ],
};

export function AppSidebar({
  user = defaultUser,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <CommandIcon className="size-5!" />
              <div className="grid leading-tight">
                <span className="text-base font-semibold">
                  Virtual Mail Ops
                </span>
                <span className="text-[11px] text-sidebar-foreground/70">
                  Control Surface
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
