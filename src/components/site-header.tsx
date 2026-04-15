import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BellDotIcon, MailIcon } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/90 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />

        <div>
          <h1 className="text-sm font-semibold tracking-[0.02em] text-foreground sm:text-base">
            Overview Console
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Identity, throughput, and queue readiness
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="hidden md:inline-flex"
            render={<a href="/dashboard" />}
          >
            <BellDotIcon />
            Alerts
          </Button>
          <Button size="sm" variant="outline" render={<a href="/dashboard" />}>
            <MailIcon />
            Mailbox Operations
          </Button>
        </div>
      </div>
    </header>
  );
}
