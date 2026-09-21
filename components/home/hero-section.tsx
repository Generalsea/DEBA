import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-[2.25rem] bg-deba-radial px-6 py-10 text-white shadow-glass sm:px-10 sm:py-14 lg:px-16 lg:py-16">
      <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative grid items-end gap-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(110,231,183,.12)]" />
            سوق وتبرع في تجربة واحدة
          </div>

          <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            الأشياء الجيدة لا تنتهي…
            <span className="mt-2 block text-emerald-200">
              هي فقط تحتاج صاحباً جديداً.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
            اكتشف منتجات مميزة، قدّم عرضك لحظياً، أو حوّل ما لا تحتاجه إلى أثر
            حقيقي عبر مسار التبرع الشفاف في ديبا.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="rounded-full bg-white px-6 py-3.5 font-bold text-ink-900 shadow-soft transition hover:-translate-y-0.5"
            >
              اكتشف السوق
            </Link>
            <Link
              href="/donate"
              className="rounded-full border border-white/20 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur-xl transition hover:bg-white/15"
            >
              تبرّع الآن
            </Link>
          </div>
        </div>

        <div className="glass rounded-3xl p-5 text-ink-900 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">نبض ديبا الآن</p>
              <p className="mt-1 text-2xl font-black">+1,240 حركة اليوم</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-700">
              حي
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              ["بيع وشراء", "4.8K"],
              ["تبرعات موثقة", "1.3K"],
              ["عروض لحظية", "320"],
              ["أثر مستمر", "92%"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-black/5 bg-white/70 p-4"
              >
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-black text-ink-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
