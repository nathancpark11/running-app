"use client";

import { RunTrackProvider } from "@/components/RunTrackProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <RunTrackProvider>{children}</RunTrackProvider>;
}
