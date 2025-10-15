"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface DemoContextProps {
  isDemoMode: boolean;
  canWrite: boolean;
  showDemoBanner: boolean;
}

const DemoContext = createContext<DemoContextProps | undefined>(undefined);

const DEMO_USER_EMAILS = [
  "demo@familyphotoshare.com",
  "guest@familyphotoshare.com",
];

export function DemoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const isDemoMode = useMemo(() => {
    if (!user?.email) return false;
    return DEMO_USER_EMAILS.includes(user.email.toLowerCase());
  }, [user]);

  const value = useMemo(
    () => ({
      isDemoMode,
      canWrite: !isDemoMode,
      showDemoBanner: !isDemoMode,
    }), 
    [isDemoMode]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}