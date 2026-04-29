"use client";

import Link from "next/link";
import { Bell, ChevronDown, LogOut, Settings, UserCircle2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { StretchTimerMiniModal } from "@/components/StretchTimerMiniModal";

function titleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/runs") return "Runs";
  if (pathname === "/run-generator") return "Run Generator";
  if (pathname === "/training-plan") return "Training Plan";
  if (pathname === "/calendar") return "Calendar";
  if (pathname === "/stretch-timer") return "Stretch Timer";
  if (pathname === "/stats") return "Stats";
  if (pathname === "/goals") return "Goals";
  if (pathname === "/settings") return "Settings";
  return "RunTrack";
}

function greetingByTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Runner");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPaceModalOpen, setIsPaceModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const treadmillPaces = Array.from({ length: 91 }, (_, index) => {
    const mph = 3 + index * 0.1;
    const minutesPerMile = 60 / mph;
    const totalSeconds = Math.round(minutesPerMile * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return {
      mph: mph.toFixed(1),
      pace: `${minutes}:${seconds.toString().padStart(2, "0")}`,
    };
  });

  useEffect(() => {
    if (pathname === "/login") return;

    let canceled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
          }
          return;
        }

        const data = (await response.json()) as { user?: { name?: string } };
        if (!canceled && data.user?.name) {
          setDisplayName(data.user.name);
        }
      } catch {
        // Ignore transient network failures and keep existing UI state.
      }
    }

    loadUser();

    return () => {
      canceled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsPaceModalOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-3 py-2 backdrop-blur md:px-8 md:py-3 dark:border-slate-800 dark:bg-slate-900/85">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{greetingByTime()}</p>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 md:text-lg">{titleForPath(pathname)}</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/60 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-900/70">
            <button
              className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              type="button"
              onClick={() => setIsPaceModalOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isPaceModalOpen}
              aria-label="Open treadmill pace conversion chart"
              title="Treadmill pace conversion chart"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs">
              <UserCircle2 className="hidden h-4.5 w-4.5 text-blue-500 md:block" />
              <span className="hidden text-slate-700 md:block dark:text-slate-200">{displayName}</span>
              <button
                type="button"
                onClick={signOut}
                className="hidden rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 md:block dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Sign out
              </button>
              <div className="relative md:hidden" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open user menu"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <UserCircle2 className="h-3.5 w-3.5 text-blue-500" />
                  <span>{displayName}</span>
                  <ChevronDown className={`h-3 w-3 transition ${isUserMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {isUserMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={signOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-2.5 pb-[calc(92px+env(safe-area-inset-bottom))] md:px-8 md:py-5 md:pb-8">{children}</main>
      </div>

      {isPaceModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
          onClick={() => setIsPaceModalOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Treadmill to minute per mile pace conversions"
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Treadmill Pace Conversion</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">3.0 to 12.0 mph in 0.1 increments</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaceModalOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 font-medium">Treadmill (mph)</th>
                    <th className="py-2 font-medium">Pace (min/mile)</th>
                  </tr>
                </thead>
                <tbody>
                  {treadmillPaces.map((entry) => (
                    <tr key={entry.mph} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-medium text-slate-800 dark:text-slate-100">{entry.mph}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{entry.pace}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <StretchTimerMiniModal />
      <MobileNav />
    </div>
  );
}
