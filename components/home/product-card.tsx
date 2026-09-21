"use client";

import { useState } from "react";

type ProductCardProps = {
  title: string;
  price: string;
  condition: string;
  city: string;
  accent: "sand" | "slate" | "mint";
};

export function ProductCard({
  title,
  price,
  condition,
  city,
  accent,
}: ProductCardProps) {
  const [saved, setSaved] = useState(false);

  const mediaClass = {
    sand: "from-amber-100 via-stone-100 to-white",
    slate: "from-slate-200 via-slate-100 to-white",
    mint: "from-emerald-100 via-teal-50 to-white",
  }[accent];

  return (
    <article className="group overflow-hidden rounded-3xl border border-black/5 bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-glass dark:border-white/10 dark:bg-slate-900">
      <div className={"product-media relative aspect-[4/3] bg-gradient-to-br " + mediaClass}>
        <button
          type="button"
          aria-label={saved ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
          aria-pressed={saved}
          onClick={() => setSaved((value) => !value)}
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/80 text-lg shadow-sm backdrop-blur-xl transition hover:scale-105"
        >
          {saved ? "♥" : "♡"}
        </button>

        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/50 bg-white/60 p-4 backdrop-blur-xl">
          <p className="text-xs font-bold text-slate-500">DEBA AI Grade</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm font-black text-emerald-700">{condition}</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">
              موثوق
            </span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{city}</p>
          </div>
          <p className="shrink-0 text-lg font-black text-ink-900 dark:text-white">
            {price}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {condition}
          </span>
          <button
            type="button"
            className="font-bold text-emerald-700 transition hover:text-emerald-600"
          >
            مشاهدة المنتج ←
          </button>
        </div>
      </div>
    </article>
  );
}
