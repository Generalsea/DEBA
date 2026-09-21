import Link from "next/link";
import { DonationCard } from "@/components/home/donation-card";
import { HeroSection } from "@/components/home/hero-section";
import { LiveOffer } from "@/components/home/live-offer";
import { ProductCard } from "@/components/home/product-card";
import { ThemeToggle } from "@/components/theme-toggle";

const products = [
  {
    title: "MacBook Air M1",
    price: "27,500 ج.م",
    condition: "ممتاز",
    city: "القاهرة",
    accent: "slate" as const,
  },
  {
    title: "كرسي مكتبي فاخر",
    price: "3,900 ج.م",
    condition: "جيد جداً",
    city: "الجيزة",
    accent: "sand" as const,
  },
  {
    title: "موتور كهربائي",
    price: "8,250 ج.م",
    condition: "ممتاز",
    city: "الإسكندرية",
    accent: "mint" as const,
  },
];

export function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(246,243,237,.82)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(15,23,32,.78)]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0 text-2xl font-black tracking-[-.04em]">
            <span className="gradient-text">DEBA</span>
            <span className="mr-2 text-sm text-slate-500">ديبا</span>
          </Link>

          <div className="hidden flex-1 md:block">
            <div className="mx-auto max-w-xl rounded-full border border-black/5 bg-white/80 px-5 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="ابحث عن منتج، تبرع، أو فئة..."
                aria-label="بحث"
              />
            </div>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <ThemeToggle />
          </div>

          <nav className="hidden items-center gap-4 text-sm font-bold lg:flex">
            <Link href="/marketplace" className="text-slate-600 transition hover:text-emerald-700">
              السوق
            </Link>
            <Link href="/donate" className="text-slate-600 transition hover:text-emerald-700">
              التبرعات
            </Link>
            <Link href="/sell" className="text-slate-600 transition hover:text-emerald-700">
              بع شيئاً
            </Link>
            <Link href="/auth/login" className="rounded-full bg-ink-900 px-4 py-2.5 text-white">
              دخول
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <HeroSection />

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-700">مختارات ذكية</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  أشياء تستحق فرصة جديدة
                </h2>
              </div>
              <Link
                href="/marketplace"
                className="text-sm font-bold text-slate-500 hover:text-emerald-700"
              >
                كل المنتجات ←
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.title} {...product} />
              ))}
            </div>
          </div>

          <LiveOffer
            productName="Sony WH-1000XM5"
            currentOffer="6,900 ج.م"
            sellerResponseMinutes={7}
          />
        </section>

        <section className="mt-12">
          <div className="mb-5">
            <p className="text-sm font-bold text-emerald-700">أثر يمكن رؤيته</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">
              تبرعات تتقدم أمامك لحظة بلحظة
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <DonationCard
              title="مستلزمات دراسية"
              beneficiary="مبادرة تعليمية — القاهرة"
              progress={82}
            />
            <DonationCard
              title="أجهزة لذوي الهمم"
              beneficiary="جمعية رعاية — الجيزة"
              progress={66}
            />
            <DonationCard
              title="أثاث منزلي"
              beneficiary="أسر مستحقة — الإسكندرية"
              progress={91}
            />
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] bg-ink-900 px-6 py-10 text-white sm:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-bold text-emerald-300">DEBA Trust Layer</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                تجربة واحدة للبيع، الشراء، والتبرع — بثقة أعلى.
              </h2>
              <p className="mt-3 max-w-2xl leading-8 text-slate-300">
                تقييم الحالة، تتبع التفاوض، وتأكيد الاستلام والتبرع مصممة حول رحلة
                المستخدم بدل تشتيته بين أدوات منفصلة.
              </p>
            </div>

            <Link
              href="/marketplace"
              className="rounded-full bg-emerald-400 px-6 py-3.5 font-black text-ink-900"
            >
              ابدأ الاستكشاف
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
