"use client";

import { useState } from "react";

export type ProductListingType = "sale" | "donation" | "free";

export type ProductCardData = {
  id: string;
  title: string;
  price?: number;
  currency?: string;
  condition: "new" | "like_new" | "excellent" | "good" | "fair" | "poor" | "for_parts";
  city: string;
  category: string;
  listingType: ProductListingType;
  imageUrl?: string;
  isNegotiable?: boolean;
  sellerName?: string;
  sellerVerified?: boolean;
};

type ProductCardProps = {
  product: ProductCardData;
  onMakeOffer?: (product: ProductCardData) => void;
  onPrimaryAction?: (product: ProductCardData) => void;
};

const conditionLabels: Record<ProductCardData["condition"], string> = {
  new: "جديد",
  like_new: "مستعمل كالجديد",
  excellent: "ممتاز",
  good: "جيد جدًا",
  fair: "جيد",
  poor: "مقبول",
  for_parts: "للقطع",
};

function formatPrice(price?: number, currency = "EGP") {
  if (price == null) return "مجانًا";
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 0,
  }).format(price) + " " + (currency === "EGP" ? "ج.م" : currency);
}

function typeBadge(type: ProductListingType) {
  if (type === "donation") {
    return {
      label: "للتبرع",
      className: "bg-emerald-500 text-white shadow-deba-emerald",
    };
  }

  if (type === "free") {
    return {
      label: "مجاني",
      className: "bg-sky-500 text-white",
    };
  }

  return {
    label: "للبيع",
    className: "bg-deba-navy text-white",
  };
}

export function ProductCard({
  product,
  onMakeOffer,
  onPrimaryAction,
}: ProductCardProps) {
  const [saved, setSaved] = useState(false);
  const badge = typeBadge(product.listingType);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-deba-border bg-deba-surface shadow-deba-card transition duration-300 hover:-translate-y-1 hover:shadow-deba-hover dark:border-slate-700 dark:bg-slate-900">
      <div className="product-image-shell relative aspect-[4/3] overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid h-full place-items-center bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 text-7xl dark:from-slate-800 dark:via-slate-900 dark:to-emerald-950"
          >
            <span>✦</span>
          </div>
        )}

        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <span className={"rounded-full px-3 py-1.5 text-xs font-extrabold " + badge.className}>
            {badge.label}
          </span>

          <button
            type="button"
            aria-label={saved ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
            aria-pressed={saved}
            onClick={() => setSaved((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/90 text-lg text-slate-700 shadow-sm backdrop-blur-xl transition hover:scale-105 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
          >
            {saved ? "♥" : "♡"}
          </button>
        </div>

        {product.sellerVerified ? (
          <div className="absolute bottom-4 right-4 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs font-extrabold text-deba-navy shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 dark:text-white">
            ✓ بائع موثّق
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-deba-muted">{product.category}</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-extrabold leading-7 tracking-tight text-deba-ink dark:text-white">
              {product.title}
            </h3>
          </div>

          <p className="price-emphasis shrink-0 text-lg font-black">
            {formatPrice(product.price, product.currency)}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {conditionLabels[product.condition]}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {product.city}
          </span>
          {product.isNegotiable && product.listingType === "sale" ? (
            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
              قابل للتفاوض
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-6">
          {product.listingType === "sale" ? (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={() => onPrimaryAction?.(product)}
                className="rounded-full bg-deba-orange px-4 py-3 font-extrabold text-white shadow-deba-orange transition hover:bg-deba-orange-dark hover:-translate-y-0.5"
              >
                أضف للسلة
              </button>
              <button
                type="button"
                onClick={() => onMakeOffer?.(product)}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-3 font-extrabold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
              >
                تفاوض
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onPrimaryAction?.(product)}
              className="w-full rounded-full bg-deba-emerald px-4 py-3 font-extrabold text-white shadow-deba-emerald transition hover:bg-deba-emerald-dark hover:-translate-y-0.5"
            >
              {product.listingType === "donation" ? "تواصل للتبرع" : "اطلب مجانًا"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
