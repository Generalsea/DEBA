import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-[2.25rem] bg-white shadow-deba-card ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(37,99,235,.12),transparent_30%),radial-gradient(circle_at_92%_10%,rgba(249,115,22,.10),transparent_26%)]" />
      <div className="relative grid gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_.85fr] lg:px-14 lg:py-16">
        <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
            <span className="h-2 w-2 rounded-full bg-deba-royal" />
            سوق + تبرع + تفاوض في مكان واحد
          </div>

          <h1 className="max-w-4xl text-4xl font-black leading-[1.06] tracking-[-0.04em] text-deba-navy dark:text-white sm:text-6xl lg:text-7xl">
            اشتري أذكى.
            <span className="block text-deba-royal">بع أسرع.</span>
            <span className="block text-deba-orange">وتبرّع بأثر واضح.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            ديبا تجمع اكتشاف المنتجات، التفاوض المباشر، والسلع المتاحة للتبرع داخل
            تجربة تجارية واحدة مصممة للسرعة والوضوح والثقة.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="rounded-full bg-deba-orange px-6 py-3.5 font-black text-white shadow-deba-orange transition hover:-translate-y-0.5 hover:bg-deba-orange-dark"
            >
              ابدأ التسوق
            </Link>
            <Link
              href="/donate"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3.5 font-black text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              استكشف التبرعات
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-6 text-sm font-bold text-slate-500 dark:text-slate-400">
            <span>✓ دفع آمن</span>
            <span>✓ عروض مباشرة</span>
            <span>✓ تبرع قابل للتتبع</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-deba-hero p-6 text-white shadow-deba-card sm:p-8">
          <div className="absolute -left-10 top-6 h-36 w-36 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="relative">
            <p className="text-sm font-black text-blue-200">DEBA LIVE</p>
            <p className="mt-2 text-3xl font-black tracking-tight">ما يحدث الآن</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ["منتجات جديدة", "1,240"],
                ["عروض مباشرة", "320"],
                ["طلبات تبرع", "186"],
                ["بائعون موثقون", "92%"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md"
                >
                  <p className="text-xs font-bold text-slate-300">{label}</p>
                  <p className="mt-1 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
