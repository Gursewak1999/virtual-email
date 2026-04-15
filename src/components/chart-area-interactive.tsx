"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const description = "An interactive area chart";

const chartData = [
  { date: "2024-04-01", inbound: 332, outbound: 170 },
  { date: "2024-04-02", inbound: 287, outbound: 210 },
  { date: "2024-04-03", inbound: 315, outbound: 214 },
  { date: "2024-04-04", inbound: 341, outbound: 226 },
  { date: "2024-04-05", inbound: 365, outbound: 240 },
  { date: "2024-04-06", inbound: 356, outbound: 231 },
  { date: "2024-04-07", inbound: 372, outbound: 245 },
  { date: "2024-04-08", inbound: 391, outbound: 259 },
  { date: "2024-04-09", inbound: 408, outbound: 263 },
  { date: "2024-04-10", inbound: 426, outbound: 281 },
  { date: "2024-04-11", inbound: 443, outbound: 298 },
  { date: "2024-04-12", inbound: 437, outbound: 306 },
  { date: "2024-04-13", inbound: 451, outbound: 319 },
  { date: "2024-04-14", inbound: 465, outbound: 328 },
  { date: "2024-04-15", inbound: 489, outbound: 342 },
  { date: "2024-04-16", inbound: 476, outbound: 336 },
  { date: "2024-04-17", inbound: 493, outbound: 352 },
  { date: "2024-04-18", inbound: 506, outbound: 357 },
  { date: "2024-04-19", inbound: 512, outbound: 361 },
  { date: "2024-04-20", inbound: 504, outbound: 355 },
  { date: "2024-04-21", inbound: 496, outbound: 349 },
  { date: "2024-04-22", inbound: 521, outbound: 367 },
  { date: "2024-04-23", inbound: 539, outbound: 378 },
  { date: "2024-04-24", inbound: 548, outbound: 386 },
  { date: "2024-04-25", inbound: 533, outbound: 371 },
  { date: "2024-04-26", inbound: 526, outbound: 364 },
  { date: "2024-04-27", inbound: 552, outbound: 391 },
  { date: "2024-04-28", inbound: 563, outbound: 399 },
  { date: "2024-04-29", inbound: 576, outbound: 412 },
  { date: "2024-04-30", inbound: 584, outbound: 420 },
  { date: "2024-05-01", inbound: 596, outbound: 426 },
  { date: "2024-05-02", inbound: 602, outbound: 434 },
  { date: "2024-05-03", inbound: 614, outbound: 446 },
  { date: "2024-05-04", inbound: 621, outbound: 453 },
  { date: "2024-05-05", inbound: 632, outbound: 462 },
  { date: "2024-05-06", inbound: 645, outbound: 474 },
  { date: "2024-05-07", inbound: 639, outbound: 470 },
  { date: "2024-05-08", inbound: 627, outbound: 459 },
  { date: "2024-05-09", inbound: 618, outbound: 452 },
  { date: "2024-05-10", inbound: 606, outbound: 440 },
  { date: "2024-05-11", inbound: 593, outbound: 432 },
  { date: "2024-05-12", inbound: 584, outbound: 420 },
  { date: "2024-05-13", inbound: 572, outbound: 409 },
  { date: "2024-05-14", inbound: 561, outbound: 398 },
  { date: "2024-05-15", inbound: 549, outbound: 389 },
  { date: "2024-05-16", inbound: 541, outbound: 377 },
  { date: "2024-05-17", inbound: 528, outbound: 369 },
  { date: "2024-05-18", inbound: 516, outbound: 360 },
  { date: "2024-05-19", inbound: 509, outbound: 352 },
  { date: "2024-05-20", inbound: 501, outbound: 346 },
  { date: "2024-05-21", inbound: 494, outbound: 337 },
  { date: "2024-05-22", inbound: 486, outbound: 331 },
  { date: "2024-05-23", inbound: 479, outbound: 324 },
  { date: "2024-05-24", inbound: 471, outbound: 317 },
  { date: "2024-05-25", inbound: 468, outbound: 311 },
  { date: "2024-05-26", inbound: 462, outbound: 304 },
  { date: "2024-05-27", inbound: 458, outbound: 299 },
  { date: "2024-05-28", inbound: 451, outbound: 293 },
  { date: "2024-05-29", inbound: 446, outbound: 288 },
  { date: "2024-05-30", inbound: 442, outbound: 283 },
  { date: "2024-05-31", inbound: 438, outbound: 276 },
  { date: "2024-06-01", inbound: 432, outbound: 270 },
  { date: "2024-06-02", inbound: 427, outbound: 264 },
  { date: "2024-06-03", inbound: 421, outbound: 258 },
  { date: "2024-06-04", inbound: 416, outbound: 254 },
  { date: "2024-06-05", inbound: 409, outbound: 248 },
  { date: "2024-06-06", inbound: 403, outbound: 244 },
  { date: "2024-06-07", inbound: 398, outbound: 239 },
  { date: "2024-06-08", inbound: 392, outbound: 235 },
  { date: "2024-06-09", inbound: 388, outbound: 231 },
  { date: "2024-06-10", inbound: 381, outbound: 227 },
  { date: "2024-06-11", inbound: 375, outbound: 222 },
  { date: "2024-06-12", inbound: 369, outbound: 219 },
  { date: "2024-06-13", inbound: 364, outbound: 213 },
  { date: "2024-06-14", inbound: 357, outbound: 208 },
  { date: "2024-06-15", inbound: 352, outbound: 203 },
  { date: "2024-06-16", inbound: 348, outbound: 198 },
  { date: "2024-06-17", inbound: 342, outbound: 193 },
  { date: "2024-06-18", inbound: 338, outbound: 189 },
  { date: "2024-06-19", inbound: 334, outbound: 184 },
  { date: "2024-06-20", inbound: 329, outbound: 180 },
  { date: "2024-06-21", inbound: 325, outbound: 175 },
  { date: "2024-06-22", inbound: 321, outbound: 170 },
  { date: "2024-06-23", inbound: 318, outbound: 168 },
  { date: "2024-06-24", inbound: 312, outbound: 164 },
  { date: "2024-06-25", inbound: 307, outbound: 160 },
  { date: "2024-06-26", inbound: 304, outbound: 157 },
  { date: "2024-06-27", inbound: 299, outbound: 152 },
  { date: "2024-06-28", inbound: 295, outbound: 149 },
  { date: "2024-06-29", inbound: 291, outbound: 146 },
  { date: "2024-06-30", inbound: 286, outbound: 142 },
];

const chartConfig = {
  inbound: {
    label: "Inbound",
    color: "var(--chart-2)",
  },
  outbound: {
    label: "Outbound",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const referenceDate = new Date("2024-06-30");
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  return (
    <Card className="@container/card overflow-hidden border-zinc-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Message Throughput Trend</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Inbound versus outbound processing volume
          </span>
          <span className="@[540px]/card:hidden">Inbound vs outbound</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={(value) => {
              setTimeRange(value[0] ?? "90d");
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 90 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={(value) => {
              if (value !== null) {
                setTimeRange(value);
              }
            }}
          >
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 90 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 90 days
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-outbound)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-outbound)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-inbound)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-inbound)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="inbound"
              type="natural"
              fill="url(#fillMobile)"
              stroke="var(--color-inbound)"
              stackId="a"
            />
            <Area
              dataKey="outbound"
              type="natural"
              fill="url(#fillDesktop)"
              stroke="var(--color-outbound)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
