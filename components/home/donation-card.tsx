"use client";

import { useState } from "react";

export function DonationCard({
  title,
  beneficiary,
  progress,
}: {
  title: string;
  beneficiary: string;
  progress: number;
}) {
  const [interested, setInterested] = useState(false);

  return (
    <article className="rounded-3xl border border-emerald-900/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-emerald-700">
            تبرع موثق
          </p>
          <h3 className="mt-2 text-xl font-black">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{beneficiary}</p>
        </div>

        <button
          type="button"
          onClick={() => setInterested((value) => !value)}
          className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/15"
        >
          {interested ? "تم الاهتمام ✓" : "أهتم بالتبرع"}
        </button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-sm font-bold">
          <span>{progress}% مكتمل</span>
          <span className="text-slate-500">شفافية 100%</span>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: progress + "%" }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
        <span className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">طلب</span>
        <span className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">استلام</span>
        <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/50">
          تأكيد
        </span>
      </div>
    </article>
  );
}
