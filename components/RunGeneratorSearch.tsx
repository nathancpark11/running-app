"use client";

import { useSearchParams } from "next/navigation";
import { RunGeneratorTab } from "@/components/RunGeneratorTab";

export function RunGeneratorSearch() {
  const searchParams = useSearchParams();
  const preselectedWorkoutId = searchParams.get("workoutId");

  return <RunGeneratorTab preselectedWorkoutId={preselectedWorkoutId} />;
}
