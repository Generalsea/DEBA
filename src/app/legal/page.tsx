import Link from 'next/link'
import { ArrowRight, FileText, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react'

const sections = [
  {
    id: 'terms',
    icon: FileText,
    title: 'شروط الاستخدام',
    body: [
      'DEBA منصة سوق إلكتروني لعرض وشراء المنتجات بين المستخدمين، ويظل المستخدم مسؤولًا عن دقة البيانات التي يضيفها إلى الإعلان أو الحساب.',
      'الطلبات ذات السعر الثابت تُنشأ داخل DEBA برقم مرجعي وحالة تشغيلية يمكن تتبعها من صفحة الطلب.',
      'لا يُعد ظهور الإعلان وحده ضمانًا لجودة المنتج أو ملاءمته؛ وتوضح صفحة المنتج البيانات التي قدّمها البائع وحالة الإعلان.',
      'يحظر استخدام المنصة في أي نشاط مخالف للقانون أو لإدخال بيانات مضللة أو انتحال هوية الغير.',
    ],
  },
  {
    id: 'privacy',
    icon: LockKeyhole,
    title: 'الخصوصية والبيانات',
    body: [
      'تفصل DEBA بين بيانات الملف العام وبيانات الاتصال الخاصة المستخدمة لتشغيل الطلبات والتسليم.',
      'تعتمد عمليات الدفع الإلكتروني على مزود دفع خارجي؛ ولا تُدخل بيانات البطاقة الخام إلى جداول DEBA الخاصة بالطلبات والمدفوعات.',
      'تُستخدم سجلات التشغيل والتدقيق لحماية الحسابات والطلبات ومراجعة الأخطاء والعمليات الحساسة.',
      'يمكن للمستخدم التحكم في بعض أنواع الإشعارات من إعدادات الحساب. ستظل إشعارات الأمان والتشغيل الأساسية خاضعة لضرورات تشغيل الخدمة.',
    ],
  },
  {
    id: 'refunds',
    icon: RotateCcw,
    title: 'الطلبات والاسترداد',
    body: [
      'حالة الطلب وحالة الدفع وحالة الشحن كيانات منفصلة، ويُستخدم سجل زمني لتوثيق التحولات المهمة.',
      'الطلب المدفوع لا يُلغى مباشرة من واجهة المستخدم؛ يجب أن يمر عبر مسار استرداد مناسب ثم تُثبت النتيجة النهائية من إشعار مزود الدفع.',
      'طلبات الاسترداد تُسجل بمرجعية مستقلة ويمكن أن تكون كاملة أو جزئية بحسب الرصيد المتاح ومسار مزود الدفع.',
      'أي شروط تجارية أو مدد قانونية إلزامية مرتبطة بفئة منتج أو بصفة البائع يجب استكمالها في النسخة القانونية المعتمدة قبل الإطلاق التجاري.',
    ],
  },
]

export default function LegalPage() {
  return (
    <main className="deba-legal-page" dir="rtl">
      <div className="deba-legal-shell">
        <Link href="/" className="deba-legal-back">
          <ArrowRight size={15} />
          العودة إلى السوق
        </Link>

        <header className="deba-legal-hero">
          <div className="deba-legal-hero-icon">
            <ShieldCheck size={26} />
          </div>
          <span>DEBA LEGAL CENTER</span>
          <h1>السياسات والخصوصية والتشغيل</h1>
          <p>
            مركز موحد للسياسات التشغيلية التي تحكم الحسابات والطلبات والدفع
            والاسترداد داخل DEBA.
          </p>
        </header>

        <div className="deba-legal-grid">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <section key={section.id} id={section.id} className="deba-legal-card">
                <div className="deba-legal-card-head">
                  <div>
                    <span>{section.id.toUpperCase()}</span>
                    <h2>{section.title}</h2>
                  </div>
                  <Icon size={20} />
                </div>
                <div className="deba-legal-copy">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <section className="deba-legal-note">
          <strong>ملاحظة إطلاق</strong>
          <p>
            هذه الصفحة تصف آليات تشغيل DEBA الحالية ولا تستبدل المستندات
            القانونية النهائية للكيان المشغّل. يجب اعتماد بيانات الكيان
            القانوني، وسائل التواصل، وشروط التجارة والإرجاع النهائية قبل
            الإطلاق التجاري.
          </p>
        </section>
      </div>
    </main>
  )
}
