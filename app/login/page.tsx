"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/";
    return next;
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = mode === "signup" ? { name, email, password } : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Authentication failed.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(14,116,144,0.2),_transparent_55%)]" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/85 p-8 shadow-2xl shadow-blue-950/30 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-blue-300">RunTrack</p>
        <h1 className="mt-3 text-3xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-slate-300">
          {mode === "signup"
            ? "Create a secure account to save runs and progress to your database."
            : "Sign in to continue tracking your training."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl border border-slate-700 p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              mode === "signup" ? "bg-blue-500 text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            New account
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              mode === "login" ? "bg-blue-500 text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            Sign in
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "signup" && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Name</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-blue-400 transition focus:ring"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Email</span>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-blue-400 transition focus:ring"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Password</span>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-blue-400 transition focus:ring"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && <p className="rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
