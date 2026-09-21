"use client";

import { useMemo, useState } from "react";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/home/ProductCard";

type DonationRibbonItem = {
  id: string;
  title: string;
  beneficiary: string;
  progress: number;
};

type ProductGridProps = {
  products: ProductCardData[];
  categories?: string[];
  donationRibbon?: DonationRibbonItem[];
  title?: string;
  subtitle?: string;
  onMakeOffer?: (product: ProductCardData) => void;
  onPrimaryAction?: (product: ProductCardData) => void;
};

const defaultCategories = [
  "الكل",
  "إلكترونيات",
  "أجهزة منزلية",
  "أثاث",
  "أزياء",
  "كتب وتعليم",
  "رياضة",
  "للتبرع",
];

export function ProductGrid({
  products,
  categories = defaultCategories,
  donationRibbon = [],
  title = "منتجات مختارة لك",
  subtitle = "اكتشف الأشياء التي تستحق فرصة جديدة، مع فلاتر سريعة وتجربة شراء سلسة.",
  onMakeOffer,
  onPrimaryAction,
}: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "الكل");
  const [sort, setSort] = useState("relevance");

  const filteredProducts = useMemo(() => {
    const list =
      activeCategory === "الكل"
        ? products
        : activeCategory === "للتبرع"
          ? products.filter((product) => product.listingType === "donation")
          : products.filter((product) => product.category === activeCategory);

    return [...list].sort((a, b) => {
      if (sort === "price-asc") return (a.price ?? 0) - (b.price ?? 0);
      if (sort === "price-desc") return (b.price ?? 0) - (a.price ?? 0);
      return 0;
    });
  }, [activeCategory, products, sort]);

  return (
    <section aria-labelledby="deba-product-grid-title">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-deba-royal">سوق ديبا</p>
          <h2
            id="deba-product-grid-title"
            className="mt-1 text-3xl font-black tracking-tight text-deba-ink dark:text-white sm:text-4xl"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-deba-muted sm:text-base">
            {subtitle}
          </p>
        </div>

        <label className="flex items-center gap-2 self-start rounded-full border border-deba-border bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:self-auto">
          <span>ترتيب</span>
          <select
            aria-label="ترتيب المنتجات"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="bg-transparent font-extrabold text-deba-ink outline-none dark:text-white"
          >
            <option value="relevance">الأكثر صلة</option>
            <option value="price-asc">السعر: من الأقل</option>
            <option value="price-desc">السعر: من الأعلى</option>
          </select>
        </label>
      </div>

      <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {categories.map((category) => {
            const selected = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveCategory(category)}
                className={
                  "rounded-full border px-4 py-2.5 text-sm font-extrabold transition " +
                  (selected
                    ? "border-deba-royal bg-deba-royal text-white shadow-sm"
                    : "border-deba-border bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-300")
                }
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {donationRibbon.length > 0 ? (
        <div className="donation-ribbon mb-7 overflow-hidden rounded-[1.75rem] p-5 text-white shadow-deba-emerald sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full bg-white/14 px-3 py-1.5 text-xs font-black backdrop-blur-sm">
                Donation Ribbon Zone
              </span>
              <h3 className="mt-3 text-2xl font-black tracking-tight">
                حوّل شيئًا لا تستخدمه إلى أثر مباشر.
              </h3>
              <p className="mt-2 text-sm leading-7 text-emerald-50 sm:text-base">
                مسارات تبرع واضحة، مع تقدم ظاهر وتأكيد استلام يساعدان على بناء الثقة من أول نقرة.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[48%]">
              {donationRibbon.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
                >
                  <p className="text-sm font-extrabold">{item.title}</p>
                  <p className="mt-1 text-xs text-emerald-50">{item.beneficiary}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white transition-[width]"
                      style={{ width: Math.min(100, Math.max(0, item.progress)) + "%" }}
                    />
                  </div>
                  <div className="mt-2 text-xs font-bold text-emerald-50">
                    {item.progress}% مكتمل
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onMakeOffer={onMakeOffer}
              onPrimaryAction={onPrimaryAction}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-deba-border bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-extrabold text-deba-ink dark:text-white">
            لا توجد منتجات في هذا الفلتر الآن.
          </p>
          <button
            type="button"
            onClick={() => setActiveCategory(categories[0] ?? "الكل")}
            className="mt-4 rounded-full bg-deba-royal px-5 py-3 font-extrabold text-white"
          >
            عرض الكل
          </button>
        </div>
      )}
    </section>
  );
}
