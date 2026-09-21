import Link from "next/link";

const content = {
  marketplace: {
    title: "سوق ديبا",
    eyebrow: "Marketplace",
    text: "تصفّح المنتجات المنشورة، اعرض سعرك، واحفظ ما يناسبك في تجربة سوق سريعة.",
    action: "تصفّح المنتجات",
  },
  donate: {
    title: "مسار التبرع",
    eyebrow: "Donation Engine",
    text: "حوّل الأشياء غير المستخدمة إلى أثر يمكن تتبعه من الطلب وحتى تأكيد الاستلام.",
    action: "ابدأ التبرع",
  },
  sell: {
    title: "أضف منتجاً",
    eyebrow: "Sell",
    text: "أنشئ إعلاناً واضحاً مع تقييم حالة وبيانات جاهزة لطبقة DEBA AI.",
    action: "إنشاء إعلان",
  },
} as const;

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const current = content[section as keyof typeof content] ?? {
    title: "DEBA",
    eyebrow: "DEBA",
    text: "واجهة ديبا الرئيسية للتجارة والتبرعات وإعادة الاستخدام.",
    action: "العودة للرئيسية",
  };

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-emerald-700">
          ← العودة للرئيسية
        </Link>

        <section className="mt-8 rounded-[2rem] bg-deba-radial p-8 text-white shadow-glass sm:p-12">
          <p className="text-sm font-bold text-emerald-200">{current.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
            {current.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            {current.text}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-white px-6 py-3.5 font-bold text-ink-900"
          >
            {current.action}
          </Link>
        </section>
      </div>
    </main>
  );
}
