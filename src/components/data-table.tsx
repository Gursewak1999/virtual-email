"use client";

import * as React from "react";
import { z } from "zod";
import { SearchIcon, ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const schema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
});

type QueueRow = z.infer<typeof schema>;

const statusFilters = ["all", "Running", "Queued", "Blocked", "Done"] as const;

type StatusFilter = (typeof statusFilters)[number];

function statusBadgeClass(status: string) {
  if (status === "Running") {
    return "border-emerald-300 bg-emerald-100/70 text-emerald-700";
  }

  if (status === "Queued") {
    return "border-sky-300 bg-sky-100/70 text-sky-700";
  }

  if (status === "Blocked") {
    return "border-red-300 bg-red-100/70 text-red-700";
  }

  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}

function QueueDrawer({ row }: { row: QueueRow }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="link"
          className="h-auto px-0 text-left text-foreground"
        >
          {row.header}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{row.header}</DrawerTitle>
          <DrawerDescription>
            Queue details, status posture, and owner context.
          </DrawerDescription>
        </DrawerHeader>

        <div className="grid gap-3 px-4 pb-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Channel
            </p>
            <p className="mt-1 font-medium text-foreground">{row.type}</p>
          </div>

          <div className="rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Current status
            </p>
            <div className="mt-1">
              <Badge variant="outline" className={statusBadgeClass(row.status)}>
                {row.status}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              SLA target
            </p>
            <p className="mt-1 font-medium text-foreground">{row.target}</p>
          </div>

          <div className="rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Daily capacity
            </p>
            <p className="mt-1 font-medium text-foreground">{row.limit}</p>
          </div>

          <div className="rounded-xl border p-3 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Queue owner
            </p>
            <p className="mt-1 font-medium text-foreground">{row.reviewer}</p>
          </div>
        </div>

        <DrawerFooter>
          <Button render={<a href="/dashboard" />}>
            Open Mailbox Operations
            <ExternalLinkIcon className="size-4" />
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function DataTable({ data }: { data: z.infer<typeof schema>[] }) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.filter((item) => {
      const statusMatch =
        statusFilter === "all" || item.status === statusFilter;

      if (!statusMatch) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [item.header, item.type, item.reviewer, item.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [data, query, statusFilter]);

  return (
    <section>
      <Card className="overflow-hidden border-zinc-200/80 shadow-sm">
        <CardHeader className="space-y-3 border-b bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <div className="space-y-1">
            <CardTitle>Operational Queues</CardTitle>
            <CardDescription>
              Search active channels and inspect queue ownership, SLA, and
              capacity posture.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter}
                variant={statusFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter)}
              >
                {filter === "all" ? "All" : filter}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="relative max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search queue, channel, owner, or status"
            />
          </div>

          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No queue rows match your current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <QueueDrawer row={row} />
                      </TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(row.status)}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.target}</TableCell>
                      <TableCell>{row.limit}</TableCell>
                      <TableCell>{row.reviewer}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<a href="/dashboard" />}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
