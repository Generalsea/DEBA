"use client";

import { useEffect, useMemo, useState } from "react";

export function LiveOffer({
  productName,
  currentOffer,
  sellerResponseMinutes,
}: {
  productName: string;
  currentOffer: string;
  sellerResponseMinutes: number;
}) {
  const [seconds, setSeconds] = useState(sellerResponseMinutes * 60);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const timeLabel = useMemo(() => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const rest = (seconds % 60).toString().padStart(2, "0");
    return minutes + ":" + rest;
  }, [seconds]);

  return (
    <section className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-amber-700">
            Live Offer
          </p>
          <h3 className="mt-2 text-xl font-black text-ink-900">{productName}</h3>
          <p className="mt-1 text-sm text-slate-500">المفاوضة مفتوحة الآن</p>
        </div>
        <div className="rounded-2xl bg-ink-900 px-3 py-2 text-sm font-black text-white">
          {timeLabel}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">أعلى عرض حالي</p>
          <p className="mt-1 text-3xl font-black text-emerald-700">{currentOffer}</p>
        </div>

        <button
          type="button"
          className="rounded-full bg-ink-900 px-5 py-3 font-bold text-white transition hover:-translate-y-0.5"
        >
          قدّم عرضك
        </button>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-full rounded-full bg-gradient-to-l from-amber-400 to-emerald-500 transition-[width] duration-1000"
          style={{
            width:
              Math.max(
                12,
                (seconds / Math.max(1, sellerResponseMinutes * 60)) * 100,
              ) + "%",
          }}
        />
      </div>
    </section>
  );
}
