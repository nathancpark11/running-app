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
  const activeItemClass = "bg-blue-600 text-white shadow-[0_14px_30px_-18px_rgba(37,99,235,0.95)] dark:bg-blue-500 dark:text-slate-950";
  const inactiveItemClass = "text-slate-500 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-slate-800/70";

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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/94 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/94">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 gap-1.5 rounded-2xl bg-slate-100/70 p-1.5 dark:bg-slate-900/80">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-xs font-medium leading-tight transition ${
                  isActive ? activeItemClass : inactiveItemClass
                }`}
              >
                <Icon className="mb-1 h-5 w-5" />
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
            className={`flex min-h-14 w-full flex-col items-center justify-center rounded-xl px-1 py-2 text-xs font-medium leading-tight transition ${
              isMoreActive || isMoreOpen ? activeItemClass : inactiveItemClass
            }`}
          >
            <Ellipsis className="mb-1 h-5 w-5" />
            More
          </button>
          {isMoreOpen ? (
            <div
              role="menu"
              className="absolute bottom-[calc(100%+10px)] right-0 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {moreItems.map((item) => {
                const isItemActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={`block px-3.5 py-2.5 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
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
