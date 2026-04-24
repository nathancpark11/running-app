"use client";

import { Download, Moon, Sun } from "lucide-react";
import { useRunTrack } from "@/components/RunTrackProvider";

export default function SettingsPage() {
  const { preferences, updatePreferences, clearAllData, runs, goals } = useRunTrack();

  function exportDataPlaceholder() {
    const blob = new Blob([JSON.stringify({ runs, goals }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "runtrack-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Dark Mode</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark themes.</p>
          </div>
          <button
            type="button"
            onClick={() => updatePreferences({ darkMode: !preferences.darkMode })}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
          >
            {preferences.darkMode ? (
              <span className="inline-flex items-center gap-1"><Sun className="h-4 w-4" /> Light</span>
            ) : (
              <span className="inline-flex items-center gap-1"><Moon className="h-4 w-4" /> Dark</span>
            )}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preferences</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => updatePreferences({ unit: "miles" })}
            className={`rounded-lg border px-3 py-2 text-sm ${
              preferences.unit === "miles"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            Miles
          </button>
          <button
            type="button"
            onClick={() => updatePreferences({ unit: "km" })}
            className={`rounded-lg border px-3 py-2 text-sm ${
              preferences.unit === "km"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            Kilometers
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Data</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportDataPlaceholder}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            Export Data (JSON)
          </button>

          <button
            type="button"
            onClick={() => {
              const ok = window.confirm("Clear all locally stored RunTrack data?");
              if (ok) {
                clearAllData();
              }
            }}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:text-red-300"
          >
            Clear All Local Data
          </button>
        </div>
      </section>
    </div>
  );
}
