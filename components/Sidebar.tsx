"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Calendar, ClipboardList, Flag, LayoutDashboard, Settings, Sparkles, Timer, Trophy } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stretch-timer", label: "Stretch Timer", icon: Timer },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/run-generator", label: "Run Generator", icon: Sparkles },
  { href: "/stats", label: "Stats", icon: Trophy },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/training-plan", label: "Training Plan", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:gap-8 md:bg-slate-950 md:px-6 md:py-8 md:text-slate-100">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-blue-200">RunTrack</p>
        <h1 className="mt-2 text-xl font-semibold">Personal Running Hub</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-blue-500/20 text-blue-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-sm text-slate-300">Stay consistent.</p>
        <p className="mt-1 text-xs text-slate-400">Log one run today, no matter how short.</p>
      </div>
    </aside>
  );
}
