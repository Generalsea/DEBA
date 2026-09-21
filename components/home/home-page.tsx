import Link from "next/link";
import { HeroSection } from "@/components/home/hero-section";
import { LiveOffer } from "@/components/home/live-offer";
import {
  ProductGrid,
  type ProductCardData,
} from "@/components/home/ProductGrid";
import { ThemeToggle } from "@/components/theme-toggle";

const products: ProductCardData[] = [
  {
    id: "demo-1",
    title: "MacBook Air M1 — 8GB / 256GB",
    price: 27500,
    currency: "EGP",
    condition: "like_new",
    city: "القاهرة",
    category: "إلكترونيات",
    listingType: "sale",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=90",
    isNegotiable: true,
    sellerName: "Ahmed",
    sellerVerified: true,
  },
  {
    id: "demo-2",
    title: "كرسي مكتبي مريح — ظهر شبكي",
    price: 3900,
    currency: "EGP",
    condition: "excellent",
    city: "الجيزة",
    category: "أثاث",
    listingType: "sale",
    imageUrl: "https://images.unsplash.com/photo-1505843490701-5be4f4f6b8c3?auto=format&fit=crop&w=1200&q=90",
    isNegotiable: true,
    sellerName: "Mona",
    sellerVerified: true,
  },
  {
    id: "demo-3",
    title: "جهاز عرض منزلي Full HD",
    price: 8250,
    currency: "EGP",
    condition: "good",
    city: "الإسكندرية",
    category: "إلكترونيات",
    listingType: "sale",
    imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=90",
    isNegotiable: true,
    sellerName: "Omar",
    sellerVerified: false,
  },
  {
    id: "demo-4",
    title: "مجموعة كتب مدرسية ومرجعيات",
    price: 0,
    currency: "EGP",
    condition: "good",
    city: "القاهرة",
    category: "كتب وتعليم",
    listingType: "donation",
    imageUrl: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=90",
    sellerName: "DEBA Community",
    sellerVerified: true,
  },
  {
    id: "demo-5",
    title: "طقم أدوات مطبخ — استخدام خفيف",
    price: 1600,
    currency: "EGP",
    condition: "excellent",
    city: "المنصورة",
    category: "أجهزة منزلية",
    listingType: "sale",
    imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=90",
    isNegotiable: false,
    sellerName: "Salma",
    sellerVerified: true,
  },
  {
    id: "demo-6",
    title: "معدات رياضية منزلية",
    price: 0,
    currency: "EGP",
    condition: "good",
    city: "بورسعيد",
    category: "رياضة",
    listingType: "donation",
    imageUrl: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=90",
    sellerName: "DEBA Community",
    sellerVerified: true,
  },
  {
    id: "demo-7",
    title: "هاتف Samsung Galaxy — 128GB",
    price: 11900,
    currency: "EGP",
    condition: "excellent",
    city: "القاهرة",
    category: "إلكترونيات",
    listingType: "sale",
    imageUrl: "https://images.unsplash.com/photo-1610945265078-0e34e5519bbf?auto=format&fit=crop&w=1200&q=90",
    isNegotiable: true,
    sellerName: "Khaled",
    sellerVerified: true,
  },
  {
    id: "demo-8",
    title: "طاولة جانبية خشب طبيعي",
    price: 2200,
    currency: "EGP",
    condition: "excellent",
    city: "الإسماعيلية",
    category: "أثاث",
    listingType: "sale",
    imageUrl: "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=1200&q=90",
    isNegotiable: true,
    sellerName: "Youssef",
    sellerVerified: false,
  },
];

export function HomePage() {
  return (
    <main className="min-h-screen bg-deba-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0 text-2xl font-black tracking-[-.04em]">
            <span className="text-deba-navy dark:text-white">DEBA</span>
            <span className="mr-2 text-sm font-extrabold text-deba-royal">ديبا</span>
          </Link>

          <div className="hidden flex-1 md:block">
            <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 shadow-sm focus-within:border-blue-300 focus-within:bg-white dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-700">
              <span className="text-slate-400" aria-hidden="true">⌕</span>
              <input
                className="w-full bg-transparent text-sm font-semibold outline-none"
                placeholder="ابحث عن منتج، فئة، أو تبرع..."
                aria-label="بحث"
              />
            </div>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <ThemeToggle />
          </div>

          <nav className="hidden items-center gap-4 text-sm font-extrabold lg:flex">
            <Link href="/marketplace" className="text-slate-600 transition hover:text-deba-royal dark:text-slate-300">
              السوق
            </Link>
            <Link href="/donate" className="text-slate-600 transition hover:text-deba-royal dark:text-slate-300">
              التبرعات
            </Link>
            <Link href="/sell" className="text-slate-600 transition hover:text-deba-royal dark:text-slate-300">
              بع شيئًا
            </Link>
            <Link href="/auth/login" className="rounded-full bg-deba-orange px-5 py-2.5 text-white shadow-deba-orange transition hover:bg-deba-orange-dark">
              دخول
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <HeroSection />

        <div className="mt-8">
          <ProductGrid
            products={products}
            donationRibbon={[
              {
                id: "d1",
                title: "كتب دراسية",
                beneficiary: "طلاب من أسر مستحقة",
                progress: 82,
              },
              {
                id: "d2",
                title: "أجهزة منزلية",
                beneficiary: "أسر في الجيزة",
                progress: 66,
              },
              {
                id: "d3",
                title: "معدات رياضية",
                beneficiary: "مراكز شباب مجتمعية",
                progress: 91,
              },
            ]}
            onMakeOffer={(product) => {
              console.log("make-offer", product.id);
            }}
            onPrimaryAction={(product) => {
              console.log("primary-action", product.id);
            }}
          />
        </div>

        <section className="mt-10">
          <LiveOffer
            productName="Sony WH-1000XM5"
            currentOffer="6,900 ج.م"
            sellerResponseMinutes={7}
          />
        </section>

        <section className="mt-10 mb-8 rounded-[2rem] bg-deba-navy px-6 py-10 text-white shadow-deba-card sm:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-black text-emerald-300">DEBA TRUST</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                اشترِ بثقة. تفاوض بوضوح. وتبرّع بأثر يمكن رؤيته.
              </h2>
              <p className="mt-3 max-w-2xl leading-8 text-slate-300">
                طبقة الثقة في ديبا مصممة حول حالة المنتج، موثوقية البائع، وسجل التبرع
                من الطلب حتى تأكيد الاستلام.
              </p>
            </div>

            <Link
              href="/marketplace"
              className="rounded-full bg-deba-orange px-6 py-3.5 font-black text-white shadow-deba-orange"
            >
              استكشف الآن
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
