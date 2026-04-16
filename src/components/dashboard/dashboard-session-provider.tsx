"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SessionUser } from "@/lib/session-user";

const DashboardSessionUserContext = createContext<SessionUser | null>(null);

interface DashboardSessionProviderProps {
  user: SessionUser;
  children: ReactNode;
}

export function DashboardSessionProvider({
  user,
  children,
}: DashboardSessionProviderProps) {
  return (
    <DashboardSessionUserContext.Provider value={user}>
      {children}
    </DashboardSessionUserContext.Provider>
  );
}

export function useDashboardSessionUser(): SessionUser {
  const sessionUser = useContext(DashboardSessionUserContext);

  if (!sessionUser) {
    throw new Error(
      "useDashboardSessionUser must be used within DashboardSessionProvider",
    );
  }

  return sessionUser;
}
