'use client'

import {
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type AuthMode = 'login' | 'register'
type AccountType = 'buyer' | 'seller'
type FieldErrors = Record<string, string>

function mapAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولًا.'
  }

  if (normalized.includes('user already registered')) {
    return 'هذا البريد الإلكتروني مسجل بالفعل.'
  }

  if (normalized.includes('password should be at least')) {
    return 'كلمة المرور يجب ألا تقل عن 8 أحرف.'
  }

  if (normalized.includes('rate limit')) {
    return 'تم تجاوز حد المحاولات مؤقتًا. حاول لاحقًا.'
  }

  return 'تعذر إكمال العملية الآن. حاول مرة أخرى.'
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidEgyptianPhone(value: string) {
  return /^01\d{9}$/.test(value.replace(/\s/g, ''))
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [accountType, setAccountType] = useState<AccountType>('buyer')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('error') === 'auth') {
      setMessage({
        type: 'error',
        text: 'تعذر التحقق من جلسة المصادقة. أعد المحاولة.',
      })
    }
  }, [])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setMessage(null)
    setFieldErrors({})
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setFieldErrors({})

    const cleanEmail = email.trim().toLowerCase()
    const cleanFirstName = firstName.trim()
    const cleanLastName = lastName.trim()
    const cleanPhone = phone.replace(/\s/g, '')

    const errors: FieldErrors = {}

    if (!isValidEmail(cleanEmail)) {
      errors.email = 'يرجى إدخال بريد إلكتروني صحيح.'
    }

    if (password.length < 8) {
      errors.password = 'كلمة المرور يجب ألا تقل عن 8 أحرف.'
    }

    if (mode === 'register') {
      if (cleanFirstName.length < 2) {
        errors.firstName = 'أدخل الاسم الأول.'
      }

      if (cleanLastName.length < 2) {
        errors.lastName = 'أدخل الاسم الأخير.'
      }

      if (!isValidEgyptianPhone(cleanPhone)) {
        errors.phone = 'أدخل رقم هاتف مصري صحيح يبدأ بـ 01.'
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setMessage({
        type: 'error',
        text: 'راجع البيانات المظللة ثم حاول مرة أخرى.',
      })
      return
    }

    startTransition(async () => {
      let supabase: ReturnType<typeof createClient>

      try {
        supabase = createClient()
      } catch (error) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error &&
            error.message.includes('Missing NEXT_PUBLIC_SUPABASE_')
              ? 'إعدادات Supabase غير مكتملة في Vercel.'
              : 'إعدادات المصادقة غير متاحة حاليًا.',
        })
        return
      }

      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (error) {
          setMessage({
            type: 'error',
            text: mapAuthError(error.message),
          })
          return
        }

        if (data.session) {
          router.replace('/')
          router.refresh()
        }

        return
      }

      const displayName = `${cleanFirstName} ${cleanLastName}`.trim()

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: displayName,
            first_name: cleanFirstName,
            last_name: cleanLastName,
            phone: cleanPhone,
            account_type: accountType,
          },
          emailRedirectTo:
            window.location.origin + '/auth/callback?next=/',
        },
      })

      if (error) {
        setMessage({
          type: 'error',
          text: mapAuthError(error.message),
        })
        return
      }

      if (data.session) {
        router.replace('/')
        router.refresh()
        return
      }

      setMessage({
        type: 'success',
        text: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب.',
      })
      setPassword('')
    })
  }

  const signInWithGoogle = () => {
    setMessage(null)
    setFieldErrors({})

    startTransition(async () => {
      let supabase: ReturnType<typeof createClient>

      try {
        supabase = createClient()
      } catch {
        setMessage({
          type: 'error',
          text: 'إعدادات المصادقة غير متاحة حاليًا.',
        })
        return
      }

      const oauthAccountType = mode === 'register' ? accountType : ''
      const callback = new URL('/auth/callback', window.location.origin)
      callback.searchParams.set('next', '/')
      if (oauthAccountType) callback.searchParams.set('account_type', oauthAccountType)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback.toString(),
          queryParams: {
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        setMessage({
          type: 'error',
          text: mapAuthError(error.message),
        })
        return
      }

      if (data.url) {
        window.location.assign(data.url)
      }
    })
  }

  return (
    <main className="auth-page" dir="rtl">
      <div className="bg-decoration" aria-hidden="true">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>

      <div className="auth-container">
        <aside className="brand-side">
          <div className="brand-header">
            <div className="brand-logo">
              <div className="brand-logo-icon">🛍️</div>
              <div className="brand-logo-text">DEBA</div>
            </div>

            <h1 className="brand-title">سوق التبادل المصري</h1>
            <p className="brand-subtitle">
              كل شيء له قيمة عندما يصل إلى من يحتاجه.
              <br />
              سوق مصمم للبيع والشراء والتبادل، بتجربة هادئة، واضحة وموثوقة.
            </p>
          </div>

          <div className="brand-values">
            <div className="value-card">
              <div className="value-number">01</div>
              <div className="value-content">
                <h3>ثقة</h3>
                <p>تجربة حساب موثوقة</p>
              </div>
            </div>

            <div className="value-card">
              <div className="value-number">02</div>
              <div className="value-content">
                <h3>قيمة</h3>
                <p>استخدام أفضل لما تملك</p>
              </div>
            </div>

            <div className="value-card">
              <div className="value-number">03</div>
              <div className="value-content">
                <h3>أثر</h3>
                <p>مساحة أكبر للبيع والشراء</p>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <div className="brand-footer-logo">DEBA</div>
            <div className="brand-footer-text">صُنع في مصر 🇪🇬</div>
          </div>
        </aside>

        <section className="form-side">
          <div className="form-container">
            <div className="mobile-brand">
              <div className="brand-logo">
                <div className="brand-logo-icon">🛍️</div>
                <div className="brand-logo-text">DEBA</div>
              </div>
            </div>

            <div className="form-header">
              <Link href="/" className="form-back">
                <span>←</span>
                <span>العودة للرئيسية</span>
              </Link>

              <h2 className="form-title">
                {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
              </h2>
              <p className="form-subtitle">
                {mode === 'login'
                  ? 'أكمل رحلتك داخل DEBA من حيث توقفت.'
                  : 'ابدأ حسابك وكن جزءًا من منظومة التبادل.'}
              </p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="نوع الحساب">
              <button
                type="button"
                className={'auth-tab ' + (mode === 'login' ? 'active' : '')}
                aria-selected={mode === 'login'}
                role="tab"
                onClick={() => switchMode('login')}
              >
                الدخول
              </button>
              <button
                type="button"
                className={'auth-tab ' + (mode === 'register' ? 'active' : '')}
                aria-selected={mode === 'register'}
                role="tab"
                onClick={() => switchMode('register')}
              >
                حساب جديد
              </button>
            </div>

            {message && (
              <div
                className={message.type === 'success' ? 'success-message' : 'error-message'}
                role={message.type === 'error' ? 'alert' : 'status'}
              >
                <span aria-hidden="true">{message.type === 'success' ? '✓' : '⚠'}</span>
                <span>{message.text}</span>
              </div>
            )}

            <form className={mode === 'login' ? 'login-form' : 'login-form hidden'} onSubmit={submit}>
              <button
                type="button"
                className="google-btn"
                onClick={signInWithGoogle}
                disabled={isPending}
              >
                <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                المتابعة باستخدام Google
              </button>

              <div className="divider" aria-hidden="true">
                أو
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="loginEmail">البريد الإلكتروني</label>
                <div className="form-input-wrapper">
                  <input
                    id="loginEmail"
                    type="email"
                    className={'form-input ' + (fieldErrors.email ? 'error' : '')}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    disabled={isPending}
                    required
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                </div>
                {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="loginPassword">كلمة المرور</label>
                <div className="form-input-wrapper">
                  <input
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    className={'form-input ' + (fieldErrors.password ? 'error' : '')}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    minLength={8}
                    maxLength={128}
                    disabled={isPending}
                    required
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
                {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    disabled={isPending}
                  />
                  <span>تذكرني</span>
                </label>
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() =>
                    setMessage({
                      type: 'error',
                      text: 'استعادة كلمة المرور تحتاج إعداد رابط الاستعادة داخل Supabase.',
                    })
                  }
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button type="submit" className="submit-btn" disabled={isPending}>
                {isPending ? (
                  <div className="btn-loader" aria-label="جارٍ المعالجة" />
                ) : (
                  <>
                    <span>دخول إلى DEBA</span>
                    <span className="arrow">←</span>
                  </>
                )}
              </button>

              <p className="terms-text">
                بالمتابعة، أنت توافق على <a href="#">شروط الاستخدام</a> و<a href="#">سياسات DEBA</a>.
              </p>
            </form>

            <form className={mode === 'register' ? 'register-form' : 'register-form hidden'} onSubmit={submit}>
              <button
                type="button"
                className="google-btn"
                onClick={signInWithGoogle}
                disabled={isPending}
              >
                <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                المتابعة باستخدام Google
              </button>

              <div className="divider" aria-hidden="true">
                أو
              </div>

              <div className="name-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">الاسم الأول</label>
                  <input
                    id="firstName"
                    type="text"
                    className={'form-input ' + (fieldErrors.firstName ? 'error' : '')}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="محمد"
                    autoComplete="given-name"
                    maxLength={60}
                    disabled={isPending}
                    required
                    aria-invalid={Boolean(fieldErrors.firstName)}
                  />
                  {fieldErrors.firstName && <div className="field-error">{fieldErrors.firstName}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">الاسم الأخير</label>
                  <input
                    id="lastName"
                    type="text"
                    className={'form-input ' + (fieldErrors.lastName ? 'error' : '')}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="أحمد"
                    autoComplete="family-name"
                    maxLength={60}
                    disabled={isPending}
                    required
                    aria-invalid={Boolean(fieldErrors.lastName)}
                  />
                  {fieldErrors.lastName && <div className="field-error">{fieldErrors.lastName}</div>}
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">أنت هنا من أجل</span>
                <div className="account-type-options" role="radiogroup" aria-label="نوع الحساب">
                  <button
                    type="button"
                    className={'account-type-option ' + (accountType === 'buyer' ? 'active' : '')}
                    role="radio"
                    aria-checked={accountType === 'buyer'}
                    onClick={() => setAccountType('buyer')}
                    disabled={isPending}
                  >
                    <strong>مشتري</strong>
                    <span>تصفح المنتجات وشراء ما تحتاجه.</span>
                  </button>
                  <button
                    type="button"
                    className={'account-type-option ' + (accountType === 'seller' ? 'active' : '')}
                    role="radio"
                    aria-checked={accountType === 'seller'}
                    onClick={() => setAccountType('seller')}
                    disabled={isPending}
                  >
                    <strong>بائع</strong>
                    <span>اعرض سلعك للبيع داخل DEBA.</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="registerEmail">البريد الإلكتروني</label>
                <input
                  id="registerEmail"
                  type="email"
                  className={'form-input ' + (fieldErrors.email ? 'error' : '')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={254}
                  disabled={isPending}
                  required
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">رقم الهاتف</label>
                <input
                  id="phone"
                  type="tel"
                  className={'form-input ' + (fieldErrors.phone ? 'error' : '')}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={11}
                  disabled={isPending}
                  required
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="registerPassword">كلمة المرور</label>
                <div className="form-input-wrapper">
                  <input
                    id="registerPassword"
                    type={showPassword ? 'text' : 'password'}
                    className={'form-input ' + (fieldErrors.password ? 'error' : '')}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    disabled={isPending}
                    required
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
                {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
              </div>

              <div className="form-options" style={{ justifyContent: 'flex-start' }}>
                <label className="remember-me">
                  <input type="checkbox" required disabled={isPending} />
                  <span>
                    أوافق على <a href="#" className="forgot-link">الشروط والأحكام</a>
                  </span>
                </label>
              </div>

              <button type="submit" className="submit-btn" disabled={isPending}>
                {isPending ? (
                  <div className="btn-loader" aria-label="جارٍ المعالجة" />
                ) : (
                  <>
                    <span>إنشاء حساب</span>
                    <span className="arrow">←</span>
                  </>
                )}
              </button>

              <p className="terms-text">
                بالمتابعة، أنت توافق على <a href="#">شروط الاستخدام</a> و<a href="#">سياسات DEBA</a>.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
