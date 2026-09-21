'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, ShieldCheck, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const BUCKET = 'deba-product-media'

export type SellCategory = {
  id: string
  name_ar: string
  slug: string
}

export type SellAttributeDefinition = {
  id: string
  category_id: string
  key: string
  label_ar: string
  label_en: string | null
  data_type: 'text' | 'number' | 'boolean' | string
  unit: string | null
  is_required: boolean
  help_text_ar: string | null
  sort_order: number
}

type Props = {
  categories: SellCategory[]
  definitions: SellAttributeDefinition[]
}

type Notice = {
  type: 'success' | 'error'
  message: string
} | null

const CONDITIONS = [
  ['new', 'جديد'],
  ['like_new', 'كالجديد'],
  ['excellent', 'ممتاز'],
  ['good', 'جيد'],
  ['fair', 'مقبول'],
  ['poor', 'يحتاج عناية'],
  ['for_parts', 'للقطع / الإصلاح'],
] as const

const DELIVERY = [
  ['pickup', 'استلام من البائع'],
  ['seller_delivery', 'توصيل عبر البائع'],
  ['platform_delivery', 'توصيل عبر DEBA'],
  ['both', 'استلام أو توصيل'],
] as const

const WARRANTY_TYPES = [
  ['none', 'بدون ضمان'],
  ['seller', 'ضمان من البائع'],
  ['manufacturer', 'ضمان الشركة المصنعة'],
] as const

const SHIPPING_COST_TYPES = [
  ['free', 'شحن مجاني'],
  ['buyer_pays', 'المشتري يتحمل الشحن'],
  ['included', 'الشحن مشمول في السعر'],
] as const

function slugifyTitle(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)

  return (base || 'deba-product') + '-' + crypto.randomUUID().slice(0, 8)
}

function requiredText(value: string, min: number) {
  return value.trim().length >= min
}

function getFriendlyError(message: string) {
  if (message.includes('PRODUCT_DETAILS_INCOMPLETE')) {
    const raw = message.split('PRODUCT_DETAILS_INCOMPLETE:')[1]?.trim()
    if (raw) {
      return 'لم يكتمل عقد بيانات المنتج بعد. راجع الحقول الإلزامية والصور قبل النشر.'
    }
    return 'بيانات المنتج غير مكتملة للنشر.'
  }

  return message
}

export default function ProductListingForm({ categories, definitions }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [conditionGrade, setConditionGrade] = useState('')
  const [conditionDetails, setConditionDetails] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [governorate, setGovernorate] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [origin, setOrigin] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [barcode, setBarcode] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  const [specifications, setSpecifications] = useState<Record<string, string>>({})
  const [usageDuration, setUsageDuration] = useState('')
  const [repairStatus, setRepairStatus] = useState('')
  const [batteryHealth, setBatteryHealth] = useState('')
  const [accessories, setAccessories] = useState('')
  const [invoice, setInvoice] = useState('')
  const [box, setBox] = useState('')
  const [sellerNotes, setSellerNotes] = useState('')
  const [returnEligible, setReturnEligible] = useState('true')
  const [returnWindowDays, setReturnWindowDays] = useState('7')
  const [returnConditions, setReturnConditions] = useState('')
  const [warrantyType, setWarrantyType] = useState('none')
  const [warrantyDurationDays, setWarrantyDurationDays] = useState('0')
  const [warrantyDetails, setWarrantyDetails] = useState('')
  const [authenticityDeclaration, setAuthenticityDeclaration] = useState('')
  const [shippingCostType, setShippingCostType] = useState('buyer_pays')
  const [shippingDetails, setShippingDetails] = useState('')
  const [inspectionAvailable, setInspectionAvailable] = useState('true')
  const [inspectionDetails, setInspectionDetails] = useState('')
  const [sellerDeclaration, setSellerDeclaration] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [notice, setNotice] = useState<Notice>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentDefinitions = useMemo(
    () =>
      definitions
        .filter((definition) => definition.category_id === categoryId && definition.is_required)
        .sort((left, right) => left.sort_order - right.sort_order),
    [categoryId, definitions],
  )

  useEffect(() => {
    setSpecifications((current) => {
      const next: Record<string, string> = {}
      for (const definition of currentDefinitions) {
        next[definition.key] = current[definition.key] || ''
      }
      return next
    })
  }, [currentDefinitions])

  const previewUrls = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  )

  useEffect(() => {
    return () => {
      for (const item of previewUrls) URL.revokeObjectURL(item.url)
    }
  }, [previewUrls])

  function setSpec(key: string, value: string) {
    setSpecifications((current) => ({ ...current, [key]: value }))
  }

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const incoming = Array.from(selected)
    const valid = incoming.filter((file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024)
    const merged = [...files, ...valid].slice(0, 8)
    setFiles(merged)
    if (valid.length !== incoming.length) {
      setNotice({ type: 'error', message: 'يسمح بصور فقط وبحد أقصى 10MB للصورة الواحدة.' })
    } else {
      setNotice(null)
    }
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    if (!categoryId) return setNotice({ type: 'error', message: 'اختر الفئة الرئيسية للسلعة.' })
    if (!requiredText(title, 10) || title.trim().length > 120) {
      return setNotice({ type: 'error', message: 'عنوان السلعة يجب أن يكون بين 10 و120 حرفًا.' })
    }
    if (!requiredText(description, 200)) {
      return setNotice({ type: 'error', message: 'الوصف التفصيلي يجب ألا يقل عن 200 حرف.' })
    }
    if (!conditionGrade) return setNotice({ type: 'error', message: 'حدد حالة السلعة بدقة.' })
    if (!requiredText(conditionDetails, 30)) {
      return setNotice({ type: 'error', message: 'أضف وصفًا تفصيليًا للحالة لا يقل عن 30 حرفًا.' })
    }
    if (!price || Number(price) <= 0) return setNotice({ type: 'error', message: 'أدخل سعرًا ثابتًا أكبر من صفر.' })
    if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return setNotice({ type: 'error', message: 'الكمية يجب أن تكون رقمًا صحيحًا لا يقل عن 1.' })
    }
    if (!governorate.trim() || !city.trim() || !district.trim()) {
      return setNotice({ type: 'error', message: 'المحافظة والمدينة والحي مطلوبة.' })
    }
    if (!requiredText(origin, 2)) {
      return setNotice({ type: 'error', message: 'حدد بلد المنشأ أو اكتب بوضوح أن المنشأ غير معروف.' })
    }
    if (files.length < 3) {
      return setNotice({ type: 'error', message: 'يجب رفع 3 صور حقيقية على الأقل، مع صورة رئيسية.' })
    }
    for (const definition of currentDefinitions) {
      if (!specifications[definition.key]?.trim()) {
        return setNotice({ type: 'error', message: 'أكمل الحقل الإلزامي: ' + definition.label_ar })
      }
    }
    if (!requiredText(returnConditions, 20)) {
      return setNotice({ type: 'error', message: 'حدد شروط الإرجاع بالتفصيل، حتى لو كان الإرجاع غير مسموح.' })
    }
    if (!requiredText(warrantyDetails, 20)) {
      return setNotice({ type: 'error', message: 'حدد تفاصيل الضمان أو اكتب بوضوح أنه لا يوجد ضمان.' })
    }
    if (!requiredText(authenticityDeclaration, 30)) {
      return setNotice({ type: 'error', message: 'أضف إقرارًا واضحًا عن أصالة السلعة ومصدر المعلومات المتاحة.' })
    }
    if (!requiredText(shippingDetails, 20)) {
      return setNotice({ type: 'error', message: 'حدد تفاصيل الشحن ورسومه بوضوح.' })
    }
    if (!requiredText(inspectionDetails, 15)) {
      return setNotice({ type: 'error', message: 'حدد ترتيبات المعاينة، أو اذكر بوضوح أنها غير متاحة.' })
    }
    if (!sellerDeclaration) {
      return setNotice({ type: 'error', message: 'يجب الموافقة على إقرار مسؤولية البائع عن دقة البيانات.' })
    }

    setIsSubmitting(true)

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('يجب تسجيل الدخول بحساب بائع قبل نشر السلعة.')
      }

      const metadata = {
        specifications,
        usage_duration: usageDuration.trim() || null,
        repair_status: repairStatus.trim() || null,
        battery_health: batteryHealth.trim() || null,
        accessories: accessories.trim() || null,
        invoice: invoice.trim() || null,
        box: box.trim() || null,
        seller_notes: sellerNotes.trim() || null,
        identification: {
          origin: origin.trim(),
          purchase_date: purchaseDate || null,
          barcode: barcode.trim() || null,
        },
        commerce: {
          seller_declaration:
            'أقر بأن المعلومات المكتوبة في هذا الإعلان تصف السلعة كما هي لدى البائع، وأتحمل مسؤولية دقتها وعدم إخفاء العيوب الجوهرية المعروفة لي.',
          returns: {
            eligible: returnEligible === 'true',
            window_days: Number(returnWindowDays || 0),
            conditions: returnConditions.trim(),
          },
          warranty: {
            type: warrantyType,
            duration_days: Number(warrantyDurationDays || 0),
            details: warrantyDetails.trim(),
          },
          authenticity: {
            declaration: authenticityDeclaration.trim(),
          },
          shipping: {
            cost_type: shippingCostType,
            details: shippingDetails.trim(),
          },
          inspection: {
            available: inspectionAvailable === 'true',
            details: inspectionDetails.trim(),
          },
          declaration: {
            accepted: true,
            version: '1.0',
            accepted_at: new Date().toISOString(),
          },
        },
      }

      const slug = slugifyTitle(title)

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          owner_id: userData.user.id,
          category_id: categoryId,
          title: title.trim(),
          slug,
          description: description.trim(),
          listing_type: 'sale',
          status: 'draft',
          moderation_status: 'pending',
          condition_grade: conditionGrade,
          condition_details: conditionDetails.trim(),
          price: Number(price),
          currency: 'EGP',
          is_negotiable: false,
          minimum_offer_amount: null,
          quantity: Number(quantity),
          city: city.trim(),
          governorate: governorate.trim(),
          district: district.trim(),
          delivery_method: deliveryMethod,
          metadata,
          details_schema_version: 1,
        })
        .select('id,slug')
        .single()

      if (productError || !product) {
        throw new Error(productError?.message || 'تعذر إنشاء مسودة السلعة.')
      }

      const uploadedPaths: string[] = []

      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index]
          const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
          const storagePath = userData.user.id + '/' + product.id + '/' + crypto.randomUUID() + '.' + extension

          const uploadResult = await supabase.storage.from(BUCKET).upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          })

          if (uploadResult.error) {
            throw new Error('تعذر رفع إحدى صور المنتج: ' + uploadResult.error.message)
          }

          uploadedPaths.push(storagePath)

          const { error: imageError } = await supabase.from('product_images').insert({
            product_id: product.id,
            storage_path: storagePath,
            alt_text: title.trim() + ' — صورة ' + (index + 1),
            sort_order: index,
            is_primary: index === 0,
          })

          if (imageError) {
            throw new Error('تعذر تسجيل صورة المنتج: ' + imageError.message)
          }
        }
      } catch (uploadError) {
        for (const storagePath of uploadedPaths) {
          await supabase.storage.from(BUCKET).remove([storagePath])
        }
        await supabase.from('products').delete().eq('id', product.id)
        throw uploadError
      }

      const { error: publishError } = await supabase
        .from('products')
        .update({ status: 'published' })
        .eq('id', product.id)

      if (publishError) {
        setNotice({
          type: 'error',
          message:
            'تم تجهيز الإعلان كمسودة، لكن فشل النشر النهائي. ' + getFriendlyError(publishError.message),
        })
        setIsSubmitting(false)
        return
      }

      setNotice({ type: 'success', message: 'تم إنشاء الإعلان وإرساله للمراجعة بنجاح.' })
      router.push('/sell?submitted=1')
      router.refresh()
    } catch (error) {
      setNotice({
        type: 'error',
        message: getFriendlyError(error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="deba-sell-form" onSubmit={submit} noValidate>
      <div className="deba-sell-intro">
        <div>
          <span>DEBA LISTING CONTRACT</span>
          <h1>إضافة سلعة بتفاصيل تجارية كاملة</h1>
          <p>
            DEBA لا يطلب من البائع عنوانًا وسعرًا فقط. قبل النشر تُراجع البيانات الأساسية،
            مواصفات الفئة، الصور، الإرجاع، الضمان، الأصالة، الشحن، والمعاينة.
          </p>
        </div>
        <div className="deba-sell-contract-badge">
          <ShieldCheck size={20} />
          <strong>عقد بيانات 1.0</strong>
          <small>النشر يحتاج اكتمال جميع المتطلبات.</small>
        </div>
      </div>

      {notice && (
        <div className={'deba-sell-notice ' + (notice.type === 'error' ? 'is-error' : 'is-success')}>
          {notice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.message}</span>
        </div>
      )}

      <section className="deba-sell-section">
        <div className="deba-sell-section-head">
          <span>01</span>
          <div>
            <h2>هوية السلعة والسعر</h2>
            <p>البيانات التي يعتمد عليها البحث والعرض والطلب.</p>
          </div>
        </div>
        <div className="deba-sell-grid">
          <label className="is-wide">
            <span>عنوان السلعة *</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: iPhone 13 Pro 256GB — Sierra Blue" maxLength={120} />
            <small>{title.trim().length}/120 — الحد الأدنى 10 أحرف.</small>
          </label>
          <label>
            <span>الفئة الرئيسية *</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">اختر الفئة</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name_ar}</option>
              ))}
            </select>
          </label>
          <label>
            <span>السعر الثابت (جنيه) *</span>
            <input type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="18500" />
          </label>
          <label>
            <span>الكمية *</span>
            <input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="deba-sell-section">
        <div className="deba-sell-section-head">
          <span>02</span>
          <div>
            <h2>الوصف والحالة</h2>
            <p>وصف واقعي ومفصل، وليس نصًا تسويقيًا مختصرًا.</p>
          </div>
        </div>
        <div className="deba-sell-grid">
          <label className="is-wide">
            <span>الوصف التفصيلي *</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={200} placeholder="اكتب مواصفات السلعة، الاستخدام، نقاط القوة، العيوب، وما سيستلمه المشتري بالتفصيل..." />
            <small>{description.trim().length} حرف — الحد الأدنى 200.</small>
          </label>
          <label>
            <span>الحالة *</span>
            <select value={conditionGrade} onChange={(event) => setConditionGrade(event.target.value)}>
              <option value="">اختر الحالة</option>
              {CONDITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>مدة الاستخدام (إن وجدت)</span>
            <input value={usageDuration} onChange={(event) => setUsageDuration(event.target.value)} placeholder="مثال: 8 أشهر" />
          </label>
          <label className="is-wide">
            <span>تفاصيل الحالة والعيوب *</span>
            <textarea value={conditionDetails} onChange={(event) => setConditionDetails(event.target.value)} minLength={30} placeholder="اذكر الخدوش، الإصلاحات، الأعطال، التعديلات، الاستبدالات وكل ما قد يغير قرار الشراء." />
          </label>
          <label>
            <span>حالة الإصلاح</span>
            <input value={repairStatus} onChange={(event) => setRepairStatus(event.target.value)} placeholder="لم يتم الإصلاح / تم استبدال..." />
          </label>
          <label>
            <span>صحة البطارية (للأجهزة)</span>
            <input value={batteryHealth} onChange={(event) => setBatteryHealth(event.target.value)} placeholder="مثال: 94%" />
          </label>
          <label className="is-wide">
            <span>الملحقات والمحتويات</span>
            <textarea value={accessories} onChange={(event) => setAccessories(event.target.value)} placeholder="اذكر كل ما يدخل في البيع بالتفصيل." />
          </label>
          <label>
            <span>الفاتورة / إثبات الشراء</span>
            <input value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="متوفرة / غير متوفرة / ..."/>
          </label>
          <label>
            <span>الكرتونة والتغليف</span>
            <input value={box} onChange={(event) => setBox(event.target.value)} placeholder="أصلية / بديلة / غير متوفرة"/>
          </label>
          <label className="is-wide">
            <span>ملاحظات البائع</span>
            <textarea value={sellerNotes} onChange={(event) => setSellerNotes(event.target.value)} placeholder="أي معلومة إضافية قد يحتاجها المشتري." />
          </label>
        </div>
      </section>

      <section className="deba-sell-section">
        <div className="deba-sell-section-head">
          <span>03</span>
          <div>
            <h2>مواصفات الفئة</h2>
            <p>حقول ديناميكية تُدار من قاعدة بيانات DEBA ويمكن توسيعها من لوحة السياسات.</p>
          </div>
        </div>
        {categoryId ? (
          currentDefinitions.length ? (
            <div className="deba-sell-spec-grid">
              {currentDefinitions.map((definition) => (
                <label key={definition.id}>
                  <span>{definition.label_ar} *</span>
                  <input
                    type={definition.data_type === 'number' ? 'number' : 'text'}
                    value={specifications[definition.key] || ''}
                    onChange={(event) => setSpec(definition.key, event.target.value)}
                    placeholder={definition.help_text_ar || definition.label_en || definition.key}
                  />
                  {definition.unit && <small>الوحدة: {definition.unit}</small>}
                </label>
              ))}
            </div>
          ) : (
            <div className="deba-sell-muted">لا توجد حقول فئوية معرفة لهذه الفئة بعد.</div>
          )
        ) : (
          <div className="deba-sell-muted">اختر الفئة أولًا لإظهار مواصفاتها الإلزامية.</div>
        )}
      </section>

      <section className="deba-sell-section">
        <div className="deba-sell-section-head">
          <span>04</span>
          <div>
            <h2>الموقع والاستلام والشحن</h2>
            <p>بيانات واضحة حتى يعرف المشتري أين وكيف سيستلم السلعة.</p>
          </div>
        </div>
        <div className="deba-sell-grid">
          <label>
            <span>المحافظة *</span>
            <input value={governorate} onChange={(event) => setGovernorate(event.target.value)} placeholder="القاهرة" />
          </label>
          <label>
            <span>المدينة *</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="المعادي" />
          </label>
          <label>
            <span>الحي / المنطقة *</span>
            <input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="المعادي الجديدة" />
          </label>
          <label>
            <span>بلد المنشأ / المصدر *</span>
            <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="مثال: مصر / الصين / غير معروف" />
            <small>اكتب الحقيقة المتاحة لديك؛ لا تستخدم ادعاء منشأ غير موثق.</small>
          </label>
          <label>
            <span>تاريخ الشراء الأصلي (إن وجد)</span>
            <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          </label>
          <label>
            <span>باركود / GTIN (إن وجد)</span>
            <input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="للمنتجات التي تحمل باركودًا تجاريًا" />
          </label>
                    <label>
            <span>طريقة الاستلام *</span>
            <select value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value)}>
              {DELIVERY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>تكلفة الشحن *</span>
            <select value={shippingCostType} onChange={(event) => setShippingCostType(event.target.value)}>
              {SHIPPING_COST_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="is-wide">
            <span>تفاصيل الشحن والرسوم *</span>
            <textarea value={shippingDetails} onChange={(event) => setShippingDetails(event.target.value)} minLength={20} placeholder="المحافظات المتاحة، شركة الشحن إن وجدت، الرسوم، المواعيد، والتغليف..." />
          </label>
          <label>
            <span>المعاينة قبل الشراء *</span>
            <select value={inspectionAvailable} onChange={(event) => setInspectionAvailable(event.target.value)}>
              <option value="true">متاحة</option>
              <option value="false">غير متاحة</option>
            </select>
          </label>
          <label>
            <span>تفاصيل المعاينة *</span>
            <input value={inspectionDetails} onChange={(event) => setInspectionDetails(event.target.value)} placeholder="المكان وشروط المعاينة..." />
          </label>
        </div>
      </section>

      <section className="deba-sell-section">
        <div className="deba-sell-section-head">
          <span>05</span>
          <div>
            <h2>الإرجاع والضمان والأصالة</h2>
            <p>لا توجد قيمة افتراضية: البائع يجب أن يحدد الموقف صراحة.</p>
          </div>
        </div>
        <div className="deba-sell-grid">
          <label>
            <span>هل الإرجاع مسموح؟ *</span>
            <select value={returnEligible} onChange={(event) => setReturnEligible(event.target.value)}>
              <option value="true">نعم</option>
              <option value="false">لا</option>
            </select>
          </label>
          <label>
            <span>مدة الإرجاع بالأيام *</span>
            <input type="number" min="0" step="1" value={returnWindowDays} onChange={(event) => setReturnWindowDays(event.target.value)} />
          </label>
          <label className="is-wide">
            <span>شروط الإرجاع *</span>
            <textarea value={returnConditions} onChange={(event) => setReturnConditions(event.target.value)} minLength={20} placeholder="اذكر المدة، حالة المنتج، الاستثناءات، ومن يتحمل الشحن..." />
          </label>
          <label>
            <span>نوع الضمان *</span>
            <select value={warrantyType} onChange={(event) => setWarrantyType(event.target.value)}>
              {WARRANTY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>مدة الضمان بالأيام *</span>
            <input type="number" min="0" step="1" value={warrantyDurationDays} onChange={(event) => setWarrantyDurationDays(event.target.value)} />
          </label>
          <label className="is-wide">
            <span>تفاصيل الضمان *</span>
            <textarea value={warrantyDetails} onChange={(event) => setWarrantyDetails(event.target.value)} minLength={20} placeholder="إن لم يوجد ضمان، اكتب ذلك صراحة مع أي استثناءات." />
          </label>
          <label className="is-wide">
            <span>إقرار الأصالة ومصدر المعلومات *</span>
            <textarea value={authenticityDeclaration} onChange={(event) => setAuthenticityDeclaration(event.target.value)} minLength={30} placeholder="أعلن ما تعرفه عن الأصالة والمصدر والمستندات المتاحة دون ادعاء توثيق من DEBA." />
          </label>
        </div>
      </section>

      <section className="deba-sell-section">
        <div className="deba-sell-section-head">
          <span>06</span>
          <div>
            <h2>الصور والإقرار النهائي</h2>
            <p>الصور جزء من تعريف السلعة، وليست عنصرًا تجميليًا.</p>
          </div>
        </div>

        <div className="deba-upload-zone">
          <input
            id="deba-product-images"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
          />
          <label htmlFor="deba-product-images">
            <ImagePlus size={26} />
            <strong>أضف 3 صور على الأقل</strong>
            <span>حتى 8 صور — الصورة الأولى هي الصورة الرئيسية — الحد الأقصى 10MB للصورة.</span>
            <b><Upload size={15} /> اختيار الصور</b>
          </label>
        </div>

        {previewUrls.length > 0 && (
          <div className="deba-upload-previews">
            {previewUrls.map((preview, index) => (
              <div key={preview.url}>
                <img src={preview.url} alt={title || 'معاينة صورة المنتج'} />
                {index === 0 && <span>الرئيسية</span>}
                <button type="button" onClick={() => removeFile(index)} aria-label="حذف الصورة">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="deba-sell-declaration">
          <input type="checkbox" checked={sellerDeclaration} onChange={(event) => setSellerDeclaration(event.target.checked)} />
          <span>
            أقر بأن المعلومات المدخلة تصف السلعة كما هي، وأنني أفصحت عن العيوب الجوهرية المعروفة
            لدي، ولن أقدم أي ادعاء توثيق أو ضمان غير موجود فعليًا. *
          </span>
        </label>

        <button className="deba-sell-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle size={19} className="deba-spin" /> : <ShieldCheck size={19} />}
          <span>{isSubmitting ? 'جاري فحص البيانات ورفع الصور...' : 'نشر الإعلان للمراجعة'}</span>
        </button>

        <p className="deba-sell-footnote">
          عند الإرسال يصبح الإعلان <strong>pending moderation</strong>؛ ظهوره العام مرتبط بحالة الموافقة في DEBA.
        </p>
      </section>
    </form>
  )
}
