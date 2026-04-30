"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (mounted ? resolvedTheme : "dark") === "dark";

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-soft)] text-[color:var(--dashboard-text-muted)] hover:bg-[color:var(--dashboard-hover)] hover:text-[color:var(--dashboard-text)]"
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
