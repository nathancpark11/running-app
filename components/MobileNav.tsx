"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Calendar, Ellipsis, LayoutDashboard, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stretch-timer", label: "Timer", icon: Timer },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

const moreItems = [
  { href: "/stats", label: "Stats" },
  { href: "/goals", label: "Goals" },
  { href: "/training-plan", label: "Plan" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement | null>(null);
  const isMoreActive = moreItems.some((item) => item.href === pathname);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!moreRef.current?.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
      <ul className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center rounded-md py-1.5 text-[11px] leading-tight ${
                  isActive
                    ? "text-blue-600 dark:text-blue-300"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon className="mb-1 h-4.5 w-4.5" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setIsMoreOpen((open) => !open)}
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            className={`flex w-full flex-col items-center rounded-md py-1.5 text-[11px] leading-tight ${
              isMoreActive || isMoreOpen
                ? "text-blue-600 dark:text-blue-300"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Ellipsis className="mb-1 h-4.5 w-4.5" />
            More
          </button>
          {isMoreOpen ? (
            <div
              role="menu"
              className="absolute bottom-[calc(100%+8px)] right-0 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {moreItems.map((item) => {
                const isItemActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={`block px-3 py-2 text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      isItemActive
                        ? "text-blue-600 dark:text-blue-300"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
