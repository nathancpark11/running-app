import { Suspense } from "react";
import { RunGeneratorTab } from "@/components/RunGeneratorTab";
import { RunGeneratorSearch } from "@/components/RunGeneratorSearch";

export default function RunGeneratorPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 text-slate-100">Loading...</div>}>
      <RunGeneratorSearch />
    </Suspense>
  );
}
