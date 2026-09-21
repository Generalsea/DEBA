'use client'

import { useMemo, useState } from 'react'
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  HelpCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

type JsonObject = Record<string, unknown>

export type ProductAttributeDefinition = {
  key: string
  label_ar: string
  label_en: string | null
  data_type: string
  unit: string | null
  is_required: boolean
  help_text_ar: string | null
  sort_order: number
}

type ProductDetailTabsProps = {
  metadata: JsonObject | null
  description: string | null
  conditionDetails: string | null
  conditionLabel: string
  categoryName: string
  location: string
  deliveryLabel: string
  quantity: number
  publishedDate: string
  detailsSchemaVersion: number
  detailsLastCompletedAt: string | null
  definitions: ProductAttributeDefinition[]
}

const TABS = [
  { id: 'overview', label: 'الوصف والبيانات', icon: FileCheck2 },
  { id: 'specs', label: 'المواصفات الدقيقة', icon: ClipboardCheck },
  { id: 'condition', label: 'الحالة والتاريخ', icon: Wrench },
  { id: 'policies', label: 'الشحن والإرجاع والضمان', icon: Truck },
  { id: 'safety', label: 'الأصالة والسلامة', icon: ShieldCheck },
  { id: 'reviews', label: 'التقييمات', icon: BadgeCheck },
  { id: 'faq', label: 'أسئلة شائعة', icon: HelpCircle },
] as const

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function booleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (typeof value === 'number') return formatNumber(value)
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const items = value.map(formatValue).filter(Boolean)
    return items.length ? items.join('، ') : null
  }
  return null
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <header className="deba-detail-panel-head">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </header>
  )
}

function DataRow({
  label,
  value,
  unit,
}: {
  label: string
  value: unknown
  unit?: string | null
}) {
  const formatted = formatValue(value)
  return (
    <div className="deba-detail-data-row">
      <span>{label}</span>
      <strong>
        {formatted || 'لم يحدد البائع'}
        {formatted && unit ? ' ' + unit : ''}
      </strong>
    </div>
  )
}

function PolicyCard({
  icon: Icon,
  title,
  status,
  body,
  tone = 'neutral',
}: {
  icon: LucideIcon
  title: string
  status?: string
  body?: string | null
  tone?: 'positive' | 'neutral' | 'warning'
}) {
  return (
    <article className={'deba-detail-policy-card tone-' + tone}>
      <div className="deba-detail-policy-icon">
        <Icon size={20} />
      </div>
      <div className="deba-detail-policy-copy">
        <h3>{title}</h3>
        {status && <b>{status}</b>}
        <p>{body || 'لم يحدد البائع تفاصيل إضافية لهذه السياسة.'}</p>
      </div>
    </article>
  )
}

export default function ProductDetailTabs({
  metadata,
  description,
  conditionDetails,
  conditionLabel,
  categoryName,
  location,
  deliveryLabel,
  quantity,
  publishedDate,
  detailsSchemaVersion,
  detailsLastCompletedAt,
  definitions,
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('overview')
  const root = metadata || {}
  const specifications = asObject(root.specifications)
  const identification = asObject(root.identification)
  const commerce = asObject(root.commerce)
  const declaration = asObject(commerce.declaration)
  const returns = asObject(commerce.returns)
  const warranty = asObject(commerce.warranty)
  const authenticity = asObject(commerce.authenticity)
  const shipping = asObject(commerce.shipping)
  const inspection = asObject(commerce.inspection)

  const legacyDetails = useMemo(() => {
    const excluded = new Set([
      'specifications',
      'commerce',
      'identification',
      'faq',
      'questions',
      'fixture',
      'demo_catalog',
      'image_source',
    ])
    return Object.entries(root)
      .filter(([key, value]) => !excluded.has(key) && formatValue(value))
      .map(([key, value]) => ({ key, value: formatValue(value) }))
  }, [root])

  const presentSpecs = definitions.filter((definition) => formatValue(specifications[definition.key]))
  const isStructured = detailsSchemaVersion === 1 && Boolean(detailsLastCompletedAt)

  return (
    <section className="deba-detail-tabs-shell">
      <div className="deba-detail-contract-banner">
        <div>
          <span>DEBA PRODUCT DATA CONTRACT</span>
          <strong>
            {isStructured
              ? 'هذا الإعلان اجتاز عقد بيانات المنتج المنظم.'
              : 'هذا الإعلان من جيل بيانات أقدم؛ ستظهر فقط المعلومات التي قدمها البائع.'}
          </strong>
        </div>
        <div className={isStructured ? 'is-complete' : 'is-legacy'}>
          {isStructured ? <CheckCircle2 size={16} /> : <PackageCheck size={16} />}
          {isStructured ? 'تفاصيل منظمة' : 'بيانات قديمة'}
        </div>
      </div>

      <div className="deba-detail-tabs-nav" role="tablist" aria-label="تفاصيل المنتج">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? 'is-active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div className="deba-detail-tab-panel" role="tabpanel">
        {activeTab === 'overview' && (
          <div className="deba-detail-panel-grid">
            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading
                eyebrow="DESCRIPTION"
                title="الوصف الكامل"
                description="الوصف جزء من سجل المنتج وليس مجرد نص تسويقي؛ لذلك يظهر كما أدخله البائع."
              />
              <p className="deba-detail-long-text">
                {description || 'لم يضف البائع وصفًا تفصيليًا لهذه السلعة بعد.'}
              </p>
            </section>

            <section className="deba-detail-panel-card">
              <SectionHeading title="البيانات الأساسية" />
              <div className="deba-detail-data-list">
                <DataRow label="الفئة" value={categoryName} />
                <DataRow label="الحالة" value={conditionLabel} />
                <DataRow label="الموقع" value={location} />
                <DataRow label="طريقة الاستلام" value={deliveryLabel} />
                <DataRow label="الكمية" value={quantity} unit="وحدة" />
                <DataRow label="تاريخ النشر" value={publishedDate} />
              </div>
            </section>

            <section className="deba-detail-panel-card">
              <SectionHeading title="ما الذي يقر به هذا الإعلان؟" />
              <div className="deba-detail-check-list">
                <div>
                  <CheckCircle2 size={17} />
                  <span>السعر الحالي هو السعر الثابت المعروض للشراء.</span>
                </div>
                <div>
                  <CheckCircle2 size={17} />
                  <span>البيانات المعروضة مصدرها سجل المنتج في DEBA.</span>
                </div>
                <div>
                  <CheckCircle2 size={17} />
                  <span>أي بيان لم يقدمه البائع لا يتم اختلاقه أو عرضه كحقيقة.</span>
                </div>
              </div>
            </section>

            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading
                eyebrow="PRODUCT IDENTITY"
                title="هوية المنتج ومصدره"
                description="هذه البيانات تساعد على إزالة الالتباس بين المنتجات المتشابهة، مع عدم تحويل إدخال البائع إلى شهادة رسمية."
              />
              <div className="deba-detail-data-list deba-detail-two-column">
                <DataRow label="بلد المنشأ / المصدر" value={identification.origin} />
                <DataRow label="تاريخ الشراء الأصلي" value={identification.purchase_date} />
                <DataRow label="باركود / GTIN" value={identification.barcode} />
                <DataRow label="إصدار عقد البيانات" value={textValue(declaration.version)} />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="deba-detail-panel-grid">
            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading
                eyebrow="CATEGORY SPECIFICATIONS"
                title="المواصفات المطلوبة لهذه الفئة"
                description="هذه الحقول تُعرّفها DEBA على مستوى الفئة ويمكن توسيعها لاحقًا من لوحة الإدارة."
              />
              {definitions.length ? (
                <div className="deba-detail-spec-table">
                  {definitions.map((definition) => (
                    <div key={definition.key}>
                      <div>
                        <strong>{definition.label_ar}</strong>
                        <small>{definition.help_text_ar || definition.label_en || definition.key}</small>
                      </div>
                      <b>
                        {formatValue(specifications[definition.key]) || 'لم يحدد البائع'}
                        {formatValue(specifications[definition.key]) && definition.unit
                          ? ' ' + definition.unit
                          : ''}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="deba-detail-empty-state">لا توجد مواصفات ديناميكية معرفة لهذه الفئة بعد.</div>
              )}
            </section>

            <section className="deba-detail-panel-card">
              <SectionHeading title="حقائق إضافية مسجلة" />
              {legacyDetails.length ? (
                <div className="deba-detail-data-list">
                  {legacyDetails.map((item) => (
                    <DataRow key={item.key} label={item.key} value={item.value} />
                  ))}
                </div>
              ) : (
                <div className="deba-detail-empty-state">لا توجد حقائق إضافية في السجل.</div>
              )}
            </section>

            <section className="deba-detail-panel-card">
              <SectionHeading title="حالة اكتمال المواصفات" />
              <div className="deba-detail-completeness">
                <div className={isStructured ? 'is-complete' : ''}>
                  {isStructured ? <CheckCircle2 size={18} /> : <PackageCheck size={18} />}
                  <strong>
                    {isStructured
                      ? 'مكتمل وفق عقد الإدراج المنظم'
                      : presentSpecs.length + ' من ' + definitions.length + ' حقولًا معروضة حاليًا'}
                  </strong>
                </div>
                <p>
                  لا تُحسب الحقول غير الموجودة كبيانات افتراضية. هذا مهم للشفافية، وسيصبح
                  النشر الجديد مرتبطًا بالتحقق الآلي من هذه المتطلبات.
                </p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'condition' && (
          <div className="deba-detail-panel-grid">
            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading
                eyebrow="CONDITION"
                title="الحالة كما أعلنها البائع"
                description="تعريف الحالة يظل منفصلًا عن المواصفات الفنية حتى لا تختلط جودة الاستخدام مع مواصفات المصنع."
              />
              <div className="deba-detail-condition-hero">
                <div className="deba-detail-condition-grade">{conditionLabel}</div>
                <p>{conditionDetails || 'لم يقدم البائع وصفًا تفصيليًا للحالة.'}</p>
              </div>
            </section>

            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading title="سجل الاستخدام والقطعة" />
              <div className="deba-detail-data-list deba-detail-two-column">
                <DataRow label="مدة الاستخدام" value={root.usage_duration} />
                <DataRow label="حالة الإصلاح" value={root.repair_status} />
                <DataRow label="صحة البطارية" value={root.battery_health} />
                <DataRow label="الملحقات" value={root.accessories} />
                <DataRow label="الفاتورة" value={root.invoice} />
                <DataRow label="الكرتونة" value={root.box} />
                <DataRow label="المعاينة" value={root.inspection_location_note} />
                <DataRow label="ملاحظات البائع" value={root.seller_notes} />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'policies' && (
          <div className="deba-detail-panel-grid">
            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading
                eyebrow="COMMERCE POLICIES"
                title="الشحن والإرجاع والضمان"
                description="لا تُعرض سياسة غير مسجلة؛ كل بطاقة هنا مبنية على بيانات التجارة الخاصة بالمنتج."
              />
              <div className="deba-detail-policy-grid">
                <PolicyCard
                  icon={Truck}
                  title="الشحن والتوصيل"
                  status={textValue(shipping.cost_type) || 'غير محدد'}
                  body={textValue(shipping.details)}
                  tone="positive"
                />
                <PolicyCard
                  icon={PackageCheck}
                  title="الإرجاع"
                  status={
                    booleanValue(returns.eligible) === true
                      ? 'مسموح — ' + (numberValue(returns.window_days) ?? 0) + ' يوم'
                      : booleanValue(returns.eligible) === false
                        ? 'غير مسموح'
                        : 'لم يحدد'
                  }
                  body={textValue(returns.conditions)}
                  tone={booleanValue(returns.eligible) ? 'positive' : 'neutral'}
                />
                <PolicyCard
                  icon={Wrench}
                  title="الضمان"
                  status={
                    textValue(warranty.type)
                      ? (textValue(warranty.type) === 'none' ? 'بدون ضمان' : textValue(warranty.type)!)
                        + (numberValue(warranty.duration_days) !== null
                          ? ' — ' + numberValue(warranty.duration_days) + ' يوم'
                          : '')
                      : 'لم يحدد'
                  }
                  body={textValue(warranty.details)}
                  tone={textValue(warranty.type) && textValue(warranty.type) !== 'none' ? 'positive' : 'neutral'}
                />
                <PolicyCard
                  icon={ClipboardCheck}
                  title="المعاينة قبل الشراء"
                  status={
                    booleanValue(inspection.available) === true
                      ? 'متاحة'
                      : booleanValue(inspection.available) === false
                        ? 'غير متاحة'
                        : 'لم يحدد'
                  }
                  body={textValue(inspection.details)}
                  tone={booleanValue(inspection.available) === true ? 'positive' : 'neutral'}
                />
              </div>
            </section>

            <section className="deba-detail-panel-card">
              <SectionHeading title="إقرار البائع التجاري" />
              <div className="deba-detail-declaration">
                <ShieldCheck size={19} />
                <p>
                  {textValue(commerce.seller_declaration) ||
                    'لم يسجل البائع إقرارًا تجاريًا في البيانات المنظمة لهذا الإعلان.'}
                </p>
              </div>
            </section>

            <section className="deba-detail-panel-card">
              <SectionHeading title="ملاحظة الدفع" />
              <div className="deba-detail-note">
                <PackageCheck size={18} />
                <p>
                  النسخة الحالية من DEBA تسجل طلب الشراء بالسعر الثابت، لكن بوابة الدفع
                  الإلكتروني الفعلية لم تُربط بعد؛ لذلك لا نعرض وسائل دفع غير مفعلة.
                </p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="deba-detail-panel-grid">
            <section className="deba-detail-panel-card deba-detail-panel-wide">
              <SectionHeading
                eyebrow="AUTHENTICITY & SAFETY"
                title="الأصالة، المستندات، والمعاينة"
                description="التوثيق الحقيقي سيصدر لاحقًا من أنظمة التحقق والمراجعة؛ لا يتم اعتبار إقرار البائع شهادة منصة."
              />
              <div className="deba-detail-safety-grid">
                <div>
                  <ShieldCheck size={20} />
                  <strong>إقرار الأصالة</strong>
                  <p>{textValue(authenticity.declaration) || 'لم يسجل البائع إقرار الأصالة.'}</p>
                </div>
                <div>
                  <FileCheck2 size={20} />
                  <strong>إثباتات ومستندات</strong>
                  <p>
                    {textValue(root.invoice) ||
                      'لم يذكر البائع توافر فاتورة أو مستند في البيانات الحالية.'}
                  </p>
                </div>
                <div>
                  <ClipboardCheck size={20} />
                  <strong>المعاينة</strong>
                  <p>{textValue(inspection.details) || textValue(root.inspection_location_note) || 'لم يحدد البائع ترتيبات المعاينة.'}</p>
                </div>
                <div>
                  <BadgeCheck size={20} />
                  <strong>توثيق DEBA</strong>
                  <p>
                    {isStructured
                      ? 'اجتاز الإعلان فحص اكتمال البيانات المطلوبة للنشر المنظم.'
                      : 'هذا الإعلان ليس ضمن عقد البيانات المنظم بعد.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="deba-detail-empty-panel">
            <BadgeCheck size={26} />
            <h2>لا توجد تقييمات مسجلة بعد</h2>
            <p>
              لا تحتوي قاعدة بيانات DEBA الحالية على سجل تقييمات مكتمل لهذا المنتج، لذلك
              لن نعرض أرقام نجوم أو مبيعات تجريبية.
            </p>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="deba-detail-faq-list">
            {Array.isArray(root.faq) && root.faq.length > 0 ? (
              root.faq.map((item, index) => {
                const question = asObject(item)
                return (
                  <details key={index}>
                    <summary>
                      {textValue(question.question) || 'سؤال'}
                      <span>+</span>
                    </summary>
                    <p>{textValue(question.answer) || 'لم تسجل إجابة لهذا السؤال بعد.'}</p>
                  </details>
                )
              })
            ) : (
              <div className="deba-detail-empty-panel">
                <HelpCircle size={26} />
                <h2>الأسئلة الشائعة ستُبنى من أسئلة حقيقية</h2>
                <p>
                  لا توجد أسئلة منشورة لهذا المنتج حاليًا. عندما نضيف نظام أسئلة وأجوبة،
                  سيظهر هنا المحتوى الفعلي بدل الأسئلة التجريبية.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
