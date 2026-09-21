"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) setError(authError.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google") {
    setError(null);

    try {
      const supabase = createClient();
      const redirectTo = window.location.origin + "/auth/callback";
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (authError) setError(authError.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء تسجيل الدخول.");
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-[2rem] border border-black/5 bg-white p-6 shadow-glass dark:border-white/10 dark:bg-slate-900 sm:p-8">
      <p className="text-sm font-bold text-emerald-700">DEBA</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">مرحباً بعودتك</h1>
      <p className="mt-2 text-sm leading-7 text-slate-500">
        ادخل إلى حسابك لإدارة المنتجات والعروض والتبرعات.
      </p>

      <form onSubmit={submit} className="mt-7 grid gap-4">
        <label className="grid gap-2 text-sm font-bold">
          البريد الإلكتروني
          <input
            aria-label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-0 transition focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
            placeholder="you@example.com"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          كلمة المرور
          <input
            aria-label="Password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
            placeholder="••••••••"
          />
        </label>

        <button
          disabled={busy}
          type="submit"
          className="mt-2 rounded-full bg-ink-900 px-5 py-3.5 font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "جارٍ الدخول…" : "تسجيل الدخول"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => oauth("google")}
        className="mt-3 w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 font-bold text-ink-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
      >
        المتابعة باستخدام Google
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
