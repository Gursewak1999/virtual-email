"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BellDotIcon,
  Clock3Icon,
  InboxIcon,
  SendIcon,
  TrendingUpIcon,
} from "lucide-react";

export function SectionCards() {
  const items = [
    {
      title: "Inbound Queue",
      value: "1,248",
      change: "+8.4%",
      trend: "Queue growth in the last 24h",
      note: "92 messages pending triage",
      icon: <InboxIcon className="size-4" />,
    },
    {
      title: "Outbound Delivered",
      value: "986",
      change: "+5.1%",
      trend: "Delivery velocity improving",
      note: "Median send-to-deliver 42s",
      icon: <SendIcon className="size-4" />,
    },
    {
      title: "Response SLA",
      value: "94.2%",
      change: "+2.7%",
      trend: "Within target response window",
      note: "Current SLA target under 2h",
      icon: <Clock3Icon className="size-4" />,
    },
    {
      title: "Escalation Alerts",
      value: "17",
      change: "-3",
      trend: "Lower than previous cycle",
      note: "7 require immediate ownership",
      icon: <BellDotIcon className="size-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.title}
          className="overflow-hidden border-zinc-200/80 bg-[linear-gradient(165deg,#ffffff_0%,#f6f9ff_100%)] shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]"
        >
          <CardHeader>
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.12em]">
              {item.title}
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {item.value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <TrendingUpIcon className="size-3" />
                {item.change}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 border-t border-zinc-100/80 bg-white/60 text-sm">
            <div className="line-clamp-1 flex items-center gap-2 font-medium text-zinc-800">
              {item.icon}
              {item.trend}
            </div>
            <div className="text-muted-foreground">{item.note}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
