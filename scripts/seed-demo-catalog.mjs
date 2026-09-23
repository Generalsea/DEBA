import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'

try {
  loadEnvFile('.env.local')
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !serviceKey) {
  throw new Error(
    'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  )
}

const APPLY = process.argv.includes('--apply')
const RESET = process.argv.includes('--reset-demo')
const BUCKET = 'deba-product-media'
const DEMO_PREFIX = 'catalog-demo-v2/'

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Category = {
  id: string
  slug: string
  name_ar: string
}

type AttributeDefinition = {
  key: string
  label_ar: string
  data_type: string
  unit: string | null
  is_required: boolean
  sort_order: number
}

type ProductSeed = {
  categorySlug: string
  title: string
  price: number
  condition: string
  city: string
  governorate: string
  district: string
  deliveryMethod: 'pickup' | 'seller_delivery' | 'platform_delivery' | 'both'
}

const CITY_POOL = [
  ['مدينة نصر', 'القاهرة', 'مدينة نصر'],
  ['المعادي', 'القاهرة', 'المعادي'],
  ['6 أكتوبر', 'الجيزة', '6 أكتوبر'],
  ['الدقي', 'الجيزة', 'الدقي'],
  ['سيدي جابر', 'الإسكندرية', 'سيدي جابر'],
  ['سموحة', 'الإسكندرية', 'سموحة'],
  ['المنصورة', 'الدقهلية', 'المنصورة'],
  ['طنطا', 'الغربية', 'طنطا'],
  ['الغردقة', 'البحر الأحمر', 'الغردقة'],
  ['الزقازيق', 'الشرقية', 'الزقازيق'],
]

const CATEGORY_FIXTURES: Array<{
  slug: string
  basePrice: number
  titles: string[]
}> = [
  {
    slug: 'electronics',
    basePrice: 5500,
    titles: [
      'هاتف Samsung Galaxy A55 5G بحالة ممتازة',
      'هاتف iPhone 12 128GB بحالة جيدة',
      'لابتوب Lenovo IdeaPad للعمل والدراسة',
      'شاشة Samsung 27 بوصة FHD',
      'سماعات Sony لاسلكية عازلة للضوضاء',
      'ساعة Apple Watch Series تجريبية',
      'جهاز PlayStation 5 مع يد إضافية',
      'تابلت Samsung Galaxy للاستخدام اليومي',
      'كاميرا Canon رقمية مع عدسة أساسية',
    ],
  },
  {
    slug: 'home-appliances',
    basePrice: 4200,
    titles: [
      'غسالة LG أوتوماتيك بحالة ممتازة',
      'ثلاجة Samsung موفرة للطاقة',
      'ميكروويف Sharp سعة كبيرة',
      'تكييف Gree سبليت بحالة جيدة',
      'خلاط Philips متعدد السرعات',
      'مكنسة كهربائية Bosch للاستخدام المنزلي',
      'بوتاجاز فريش خمس شعلات',
      'غسالة أطباق Beko للاستخدام اليومي',
      'قلاية هوائية Philips سعة كبيرة',
    ],
  },
  {
    slug: 'furniture-home',
    basePrice: 3200,
    titles: [
      'أريكة مودرن ثلاثية بتصميم أنيق',
      'طقم سفرة خشبي لأربعة أفراد',
      'سرير غرفة نوم بحالة ممتازة',
      'مكتب عمل خشبي عملي',
      'كرسي مكتب مريح قابل للتعديل',
      'وحدة تلفزيون مودرن',
      'خزانة ملابس واسعة',
      'طاولة قهوة دائرية',
      'مكتبة منزلية خشبية متعددة الأرفف',
    ],
  },
  {
    slug: 'fashion',
    basePrice: 750,
    titles: [
      'جاكيت شتوي رجالي بحالة ممتازة',
      'حذاء رياضي Nike أصلي',
      'حقيبة جلد نسائية أنيقة',
      'قميص رجالي رسمي مقاس M',
      'فستان سهرة بحالة ممتازة',
      'حذاء أطفال عملي للاستخدام اليومي',
      'ساعة يد كلاسيكية بإطار معدني',
      'نظارة شمسية أصلية',
      'معطف شتوي طويل بحالة جيدة',
    ],
  },
  {
    slug: 'books-education',
    basePrice: 300,
    titles: [
      'مجموعة كتب هندسية مرجعية',
      'موسوعة علوم للأطفال',
      'كتب تعلم البرمجة للمبتدئين',
      'مجموعة كتب إدارة الأعمال',
      'روايات عربية متنوعة بحالة ممتازة',
      'كتب اللغة الإنجليزية للمستويات المختلفة',
      'مراجع جامعية للهندسة المدنية',
      'مجموعة كتب التصميم والجرافيك',
      'كتب تحضير الاختبارات والمذاكرة',
    ],
  },
  {
    slug: 'toys-hobbies',
    basePrice: 650,
    titles: [
      'مجموعة ألعاب تركيب LEGO',
      'سيارة تحكم عن بعد سريعة',
      'طاولة شطرنج خشبية',
      'مجموعة رسم وألوان متكاملة',
      'مجسمات تجميع لهواة التفاصيل',
      'ألعاب تعليمية للأطفال',
      'طائرة ورقية احترافية',
      'مجموعة بازل كبيرة',
      'مضمار سيارات للأطفال',
    ],
  },
  {
    slug: 'vehicles-parts',
    basePrice: 8500,
    titles: [
      'Hyundai Elantra 2018 بحالة جيدة',
      'طقم جنوط سيارة مقاس 16 بوصة',
      'بطارية سيارة أصلية بحالة جيدة',
      'شاشة سيارة Android',
      'كشافات أمامية LED للسيارات',
      'كاوتش سيارة بحالة ممتازة',
      'مرآة جانبية أصلية لسيارة سيدان',
      'كرسي أطفال للسيارة',
      'عدة صيانة سيارات متعددة الاستخدام',
    ],
  },
  {
    slug: 'tools-equipment',
    basePrice: 1100,
    titles: [
      'شنيور لاسلكي 18V',
      'طقم مفاتيح ولقم احترافي',
      'صاروخ تجليخ صناعي',
      'سلم ألومنيوم متعدد الاستخدام',
      'منشار كهربائي صغير',
      'ضاغط هواء محمول',
      'مولد كهرباء صغير',
      'عدة سباكة منزلية متكاملة',
      'جهاز قياس متعدد رقمي',
    ],
  },
  {
    slug: 'collectibles-antiques',
    basePrice: 950,
    titles: [
      'راديو Vintage خشبي',
      'ساعة مكتب قديمة للعرض',
      'طابع مصري قديم ضمن مجموعة',
      'مجموعة عملات تذكارية',
      'لوحة فنية مطبوعة بإطار خشبي',
      'كاميرا فيلم كلاسيكية',
      'قطعة ديكور نحاسية قديمة',
      'مجموعة بطاقات تذكارية',
      'مجسم ديكوري محدود الإصدار',
    ],
  },
  {
    slug: 'baby-kids',
    basePrice: 900,
    titles: [
      'عربة أطفال قابلة للطي',
      'كرسي طعام للأطفال',
      'سرير أطفال خشبي صغير',
      'مقعد سيارة للأطفال',
      'دراجة أطفال بعجلات مساعدة',
      'طاولة أنشطة تعليمية للأطفال',
      'حفاضات قماش قابلة لإعادة الاستخدام',
      'حقيبة حضانة متعددة الجيوب',
      'مجموعة ألعاب مونتيسوري',
    ],
  },
  {
    slug: 'sports-fitness',
    basePrice: 1200,
    titles: [
      'دراجة City Bike للاستخدام اليومي',
      'مشاية كهربائية منزلية',
      'مجموعة أوزان منزلية',
      'مضرب تنس احترافي',
      'معدات يوغا كاملة',
      'كرة قدم أصلية',
      'خوذة دراجات رياضية',
      'حقيبة جيم كبيرة',
      'جهاز مقاومة وتمارين منزلي',
    ],
  },
  {
    slug: 'other',
    basePrice: 500,
    titles: [
      'مكتب عمل عملي للاستخدام المنزلي',
      'مصباح مكتبي حديث',
      'منظم تخزين متعدد الأدراج',
      'مرآة حائط كبيرة',
      'ستارة منزلية جاهزة',
      'صندوق تخزين خشبي',
      'مروحة مكتب صغيرة',
      'رف حائط عملي',
      'أداة منزلية متعددة الاستخدام',
    ],
  },
]

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 68) || 'deba-demo-product'
  )
}

function svgForProduct(
  title: string,
  category: string,
  accent: string,
  index: number,
) {
  const x = 800 + index * 22

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcfcfb"/><stop offset="1" stop-color="#e9edf1"/></linearGradient></defs>',
    '<rect width="1600" height="1200" rx="48" fill="url(#bg)"/>',
    '<circle cx="1310" cy="210" r="170" fill="' + accent + '" opacity=".10"/>',
    '<rect x="' + (x - 270) + '" y="245" width="540" height="500" rx="48" fill="' + accent + '" opacity=".13"/>',
    '<rect x="' + (x - 185) + '" y="330" width="370" height="330" rx="38" fill="#fff" stroke="' + accent + '" stroke-width="18"/>',
    '<circle cx="' + x + '" cy="495" r="92" fill="' + accent + '" opacity=".58"/>',
    '<circle cx="' + x + '" cy="495" r="45" fill="#fff" opacity=".88"/>',
    '<text x="120" y="115" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#004E89">',
    category,
    '</text>',
    '<text x="120" y="1095" font-family="Arial,sans-serif" font-size="46" font-weight="800" fill="#1f2937">',
    title,
    '</text>',
    '<text x="1480" y="1095" text-anchor="end" font-family="Arial,sans-serif" font-size="26" fill="#6b7280">',
    'DEBA • DEMO MEDIA',
    '</text>',
    '</svg>',
  ].join('')
}

function specificationValue(definition: AttributeDefinition, product: ProductSeed) {
  const key = definition.key.toLowerCase()

  if (definition.data_type === 'boolean') return 'true'
  if (definition.data_type === 'number') return '1'

  const values: Record<string, string> = {
    brand: 'DEBA Demo',
    model: product.title,
    model_number: 'DEBA-DEMO-01',
    color: 'متنوع',
    ram: '8 GB',
    storage_capacity: '128GB',
    release_year: '2025',
    screen_size: '6.1',
    weight: '1',
    material: 'متعدد',
    size: 'متعدد المقاسات',
    capacity: 'متوسطة',
    fuel_type: 'متعدد',
  }

  return values[key] || 'بيانات تجريبية موثقة'
}

async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id,slug,name_ar')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data || []) as Category[]
}

async function loadDefinitions() {
  const { data, error } = await supabase
    .from('category_attribute_definitions')
    .select('category_id,key,label_ar,data_type,unit,is_required,sort_order')
    .eq('is_required', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as Array<AttributeDefinition & { category_id: string }>
}

async function ensureProduct(seed: ProductSeed, category: Category, definitions: AttributeDefinition[]) {
  const slug = slugify(seed.title)
  const cityText = seed.city
  const description =
    'إعلان تجريبي لمنصة DEBA لاختبار تجربة اكتشاف المنتجات والبحث والفلاتر وتفاصيل الإعلان. ' +
    'هذه البيانات منشأة خصيصًا لبيئة العرض وليست عرضًا تجاريًا حقيقيًا. ' +
    'تم تجهيز بيانات الحالة والموقع والاستلام والمواصفات الأساسية لتجربة واجهة السوق بصورة واقعية، ' +
    'مع توضيح أن السعر والبيانات الوصفية والصور الحالية هي بيانات Demo قابلة للاستبدال لاحقًا ببيانات حقيقية.'

  const specifications: Record<string, string> = {}
  for (const definition of definitions) {
    specifications[definition.key] = specificationValue(definition, seed)
  }

  const metadata = {
    demo_fixture: true,
    fixture_version: 2,
    specifications,
    identification: {
      origin: 'مصر',
      purchase_date: '2025-01-15',
      barcode: null,
    },
    commerce: {
      seller_declaration:
        'هذا إعلان تجريبي لاختبار تجربة DEBA، والبيانات الوصفية والصور في هذا السجل مخصصة للعرض والتطوير وليست إثباتًا تجاريًا.',
      returns: {
        eligible: true,
        window_days: 7,
        conditions:
          'الإرجاع التجريبي خلال 7 أيام مع المحافظة على حالة المنتج كما تم عرضه في الإعلان.',
      },
      warranty: {
        type: 'seller',
        duration_days: 7,
        details:
          'ضمان تجريبي لأغراض اختبار دورة ما بعد البيع ولا يمثل ضمانًا تجاريًا فعليًا.',
      },
      authenticity: {
        declaration:
          'البيانات والصور في هذا السجل Demo لغرض اختبار المنتج ولا تعد إقرارًا بأصالة سلعة تجارية فعلية.',
      },
      shipping: {
        cost_type: 'buyer_pays',
        details:
          'الشحن في بيئة الاختبار يوضح تجربة اختيار طريقة الاستلام ولا يحجز شركة شحن فعلية.',
      },
      inspection: {
        available: true,
        details: 'المعاينة التجريبية متاحة حسب ترتيبات الاختبار.',
      },
      declaration: {
        accepted: true,
        version: '1.0',
        accepted_at: new Date().toISOString(),
      },
    },
  }

  const { data: existing } = await supabase
    .from('products')
    .select('id,slug')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return { id: existing.id, slug: existing.slug, created: false }

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      owner_id: null,
      category_id: category.id,
      title: seed.title,
      slug,
      description,
      listing_type: 'sale',
      status: 'draft',
      moderation_status: 'pending',
      condition_grade: seed.condition,
      condition_details:
        'حالة تجريبية موصوفة لاختبار بطاقات المنتجات وتجربة عرض تفاصيل الحالة في DEBA.',
      price: seed.price,
      currency: 'EGP',
      is_negotiable: false,
      minimum_offer_amount: null,
      quantity: 1,
      city: cityText,
      governorate: seed.governorate,
      district: seed.district,
      delivery_method: seed.deliveryMethod,
      metadata,
      details_schema_version: 1,
    })
    .select('id,slug')
    .single()

  if (productError || !product) throw productError || new Error('Failed to create product.')

  const accents = ['#FF6B35', '#004E89', '#2F855A', '#7C3AED', '#9A6B4F']
  for (let index = 1; index <= 3; index += 1) {
    const storagePath =
      DEMO_PREFIX +
      product.id +
      '/' +
      index +
      '.svg'
    const body = svgForProduct(seed.title, category.name_ar, accents[(index - 1) % accents.length], index)

    const upload = await supabase.storage.from(BUCKET).upload(
      storagePath,
      new Blob([body], { type: 'image/svg+xml' }),
      {
        contentType: 'image/svg+xml',
        cacheControl: '31536000',
        upsert: true,
      },
    )

    if (upload.error) throw upload.error

    const { error: imageError } = await supabase.from('product_images').insert({
      product_id: product.id,
      storage_path: storagePath,
      alt_text: seed.title + ' — صورة تجريبية ' + index,
      sort_order: index - 1,
      is_primary: index === 1,
      width: 1600,
      height: 1200,
    })

    if (imageError) throw imageError
  }

  const { error: publishError } = await supabase
    .from('products')
    .update({
      status: 'published',
      moderation_status: 'approved',
      published_at: new Date().toISOString(),
      details_last_completed_at: new Date().toISOString(),
    })
    .eq('id', product.id)

  if (publishError) throw publishError

  return { id: product.id, slug: product.slug, created: true }
}

async function main() {
  const categories = await loadCategories()
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))

  const definitions = await loadDefinitions()
  const definitionsByCategory = new Map<string, AttributeDefinition[]>()

  for (const definition of definitions as Array<AttributeDefinition & { category_id: string }>) {
    const current = definitionsByCategory.get(definition.category_id) || []
    current.push(definition)
    definitionsByCategory.set(definition.category_id, current)
  }

  const seeds: ProductSeed[] = []
  for (let categoryIndex = 0; categoryIndex < CATEGORY_FIXTURES.length; categoryIndex += 1) {
    const fixture = CATEGORY_FIXTURES[categoryIndex]
    for (let index = 0; index < fixture.titles.length; index += 1) {
      const city = CITY_POOL[(categoryIndex * 3 + index) % CITY_POOL.length]
      seeds.push({
        categorySlug: fixture.slug,
        title: fixture.titles[index] + ' — تجربة DEBA',
        price: fixture.basePrice + index * Math.max(50, Math.round(fixture.basePrice * 0.11)),
        condition: index % 4 === 0 ? 'new' : index % 4 === 1 ? 'like_new' : index % 4 === 2 ? 'excellent' : 'good',
        city: city[0],
        governorate: city[1],
        district: city[2],
        deliveryMethod: index % 3 === 0 ? 'both' : index % 3 === 1 ? 'pickup' : 'seller_delivery',
      })
    }
  }

  const uniqueSeeds = seeds.slice(0, 108)
  console.log('Prepared demo catalog:', uniqueSeeds.length, 'products.')

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to insert products and upload demo media.')
    return
  }

  if (RESET) {
    const { data: demoProducts, error } = await supabase
      .from('products')
      .select('id')
      .eq('metadata->>demo_fixture', 'true')

    if (error) throw error

    for (const product of demoProducts || []) {
      await supabase
        .from('product_images')
        .delete()
        .eq('product_id', product.id)

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([DEMO_PREFIX + product.id + '/1.svg', DEMO_PREFIX + product.id + '/2.svg', DEMO_PREFIX + product.id + '/3.svg'])

      if (storageError) console.warn('Storage cleanup warning:', storageError.message)

      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)

      if (deleteError) throw deleteError
    }

    console.log('Reset existing DEBA demo catalog.')
  }

  let created = 0
  let reused = 0

  for (const seed of uniqueSeeds) {
    const category = categoryBySlug.get(seed.categorySlug)
    if (!category) {
      console.warn('Skipping missing category:', seed.categorySlug)
      continue
    }

    const categoryDefinitions = definitionsByCategory.get(category.id) || []
    const result = await ensureProduct(seed, category, categoryDefinitions)
    if (result.created) {
      created += 1
      console.log('Created:', result.slug)
    } else {
      reused += 1
      console.log('Reused:', result.slug)
    }
  }

  console.log(JSON.stringify({ created, reused, total: created + reused }, null, 2))
}

main().catch((error) => {
  console.error('DEBA demo catalog seeding failed:', error)
  process.exitCode = 1
})
