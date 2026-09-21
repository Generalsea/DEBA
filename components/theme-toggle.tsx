"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("deba-theme");
    const next =
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("deba-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      aria-label={dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      aria-pressed={dark}
      onClick={toggle}
      className="grid h-10 w-10 place-items-center rounded-full border border-black/5 bg-white/80 text-sm shadow-sm transition hover:scale-105 dark:border-white/10 dark:bg-slate-900/80"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
