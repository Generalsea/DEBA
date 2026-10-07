'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '@/lib/auth/egyptian-phone'

type AccountType = 'buyer' | 'seller'
type Step = 'phone' | 'otp' | 'legacy-login' | 'legacy-phone' | 'legacy-otp'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [accountType, setAccountType] = useState<AccountType>('buyer')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [nextPath, setNextPath] = useState('/')
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [resendAfter, setResendAfter] = useState(0)
  const otpRef = useRef<HTMLInputElement | null>(null)
  const legacyOtpRef = useRef<HTMLInputElement | null>(null)
  const supabase = createClient()
  const [legacyEmail, setLegacyEmail] = useState('')
  const [legacyPassword, setLegacyPassword] = useState('')
  const [legacyPhone, setLegacyPhone] = useState('')
  const [legacyOtp, setLegacyOtp] = useState('')
  const [legacyResendAfter, setLegacyResendAfter] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedNext = params.get('next')
    if (
      requestedNext &&
      requestedNext.startsWith('/') &&
      !requestedNext.startsWith('//')
    ) {
      setNextPath(requestedNext)
    }
  }, [])

  useEffect(() => {
    if (!['otp', 'legacy-otp'].includes(step)) return
    const value = step === 'otp' ? resendAfter : legacyResendAfter
    if (value <= 0) return

    const timer = window.setInterval(() => {
      if (step === 'otp') {
        setResendAfter((current) => Math.max(0, current - 1))
      } else {
        setLegacyResendAfter((current) => Math.max(0, current - 1))
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [step, resendAfter, legacyResendAfter])

  useEffect(() => {
    if (step === 'otp') {
      window.setTimeout(() => otpRef.current?.focus(), 80)
    }
    if (step === 'legacy-otp') {
      window.setTimeout(() => legacyOtpRef.current?.focus(), 80)
    }
  }, [step])

  function clearNotice() {
    setMessage(null)
    setSuccess(null)
  }

  async function sendCode() {
    clearNotice()

    const normalized = normalizeEgyptianPhone(phone)
    if (!normalized || !isValidEgyptianPhone(normalized)) {
      setMessage('أدخل رقم هاتف مصري صحيح يبدأ بـ +20.')
      return
    }

    setIsPending(true)

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalized,
          accountType,
        }),
      })

      const data = await response.json() as { error?: string; sent?: boolean }

      if (!response.ok || !data.sent) {
        setMessage(data.error || 'تعذر إرسال رمز التحقق الآن.')
        return
      }

      setPhone(normalized)
      setOtp('')
      setStep('otp')
      setResendAfter(60)
      setSuccess('أرسلنا رمز التحقق إلى WhatsApp على هذا الرقم.')
    } catch (error) {
      console.error('DEBA OTP send client error', error)
      setMessage('تعذر الاتصال بخدمة التحقق الآن. حاول مرة أخرى.')
    } finally {
      setIsPending(false)
    }
  }

  async function verifyCode() {
    clearNotice()

    if (!/^\d{6}$/.test(otp)) {
      setMessage('أدخل رمز التحقق المكوّن من 6 أرقام.')
      return
    }

    setIsPending(true)

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          token: otp,
        }),
      })

      const data = await response.json() as {
        error?: string
        authenticated?: boolean
        phoneVerified?: boolean
      }

      if (!response.ok || !data.authenticated || !data.phoneVerified) {
        setMessage(data.error || 'تعذر التحقق من الرمز.')
        return
      }

      setSuccess('تم توثيق هاتفك وتسجيل دخولك إلى DEBA.')
      router.replace(nextPath)
      router.refresh()
    } catch (error) {
      console.error('DEBA OTP verification client error', error)
      setMessage('تعذر التحقق من الرمز الآن. حاول مرة أخرى.')
    } finally {
      setIsPending(false)
    }
  }


  function openLegacyLogin() {
    clearNotice()
    setLegacyPassword('')
    setStep('legacy-login')
  }

  function backToPhoneLogin() {
    clearNotice()
    setLegacyPassword('')
    setLegacyOtp('')
    setLegacyResendAfter(0)
    setStep('phone')
  }

  async function signInLegacyAccount() {
    clearNotice()

    const email = legacyEmail.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('أدخل بريد الحساب القديم بصورة صحيحة.')
      return
    }

    if (!legacyPassword) {
      setMessage('أدخل كلمة مرور الحساب القديم.')
      return
    }

    setIsPending(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: legacyPassword,
      })

      if (error || !data.user) {
        console.error('DEBA legacy account sign-in failed', error)
        setMessage('تعذر تسجيل الدخول بالحساب القديم. راجع بيانات الدخول وحاول مرة أخرى.')
        return
      }

      if (data.user.phone) {
        setLegacyPassword('')
        setSuccess('تم تسجيل الدخول. حسابك مرتبط بالفعل بهاتف موثّق.')
        router.replace(nextPath)
        router.refresh()
        return
      }

      setLegacyPassword('')
      setStep('legacy-phone')
      setLegacyOtp('')
      setLegacyResendAfter(0)
      setSuccess('تم الدخول بحسابك القديم. الخطوة الأخيرة هي ربط هاتف مصري موثّق عبر WhatsApp.')
    } catch (error) {
      console.error('DEBA legacy account sign-in client error', error)
      setMessage('تعذر تسجيل الدخول بالحساب القديم الآن.')
    } finally {
      setIsPending(false)
    }
  }

  async function sendLegacyCode() {
    clearNotice()

    const normalized = normalizeEgyptianPhone(legacyPhone)
    if (!normalized || !isValidEgyptianPhone(normalized)) {
      setMessage('أدخل رقم هاتف مصري صحيح يبدأ بـ +20.')
      return
    }

    setIsPending(true)

    try {
      const response = await fetch('/api/auth/legacy-phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      })

      const data = await response.json() as { error?: string; sent?: boolean }
      if (!response.ok || !data.sent) {
        setMessage(data.error || 'تعذر إرسال رمز WhatsApp لربط الحساب.')
        return
      }

      setLegacyPhone(normalized)
      setLegacyOtp('')
      setStep('legacy-otp')
      setLegacyResendAfter(60)
      setSuccess('أرسلنا رمز التحقق إلى WhatsApp. لن يتم استخدام SMS لهذا المسار.')
    } catch (error) {
      console.error('DEBA legacy WhatsApp send client error', error)
      setMessage('تعذر الاتصال بخدمة التحقق الآن.')
    } finally {
      setIsPending(false)
    }
  }

  async function verifyLegacyCode() {
    clearNotice()

    if (!/^\d{6}$/.test(legacyOtp)) {
      setMessage('أدخل رمز التحقق المكوّن من 6 أرقام.')
      return
    }

    setIsPending(true)

    try {
      const response = await fetch('/api/auth/legacy-phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: legacyPhone,
          token: legacyOtp,
        }),
      })

      const data = await response.json() as {
        error?: string
        ok?: boolean
        phoneVerified?: boolean
      }

      if (!response.ok || !data.ok || !data.phoneVerified) {
        setMessage(data.error || 'تعذر إكمال ربط الهاتف.')
        return
      }

      await supabase.auth.refreshSession()
      setLegacyOtp('')
      setSuccess('تم ربط هاتفك الموثّق بحسابك القديم. مرحبًا بك من جديد في DEBA.')
      router.replace(nextPath)
      router.refresh()
    } catch (error) {
      console.error('DEBA legacy WhatsApp verification client error', error)
      setMessage('تعذر إكمال ربط الهاتف الآن.')
    } finally {
      setIsPending(false)
    }
  }

  function onLegacyOtpChange(value: string) {
    setMessage(null)
    setSuccess(null)
    setLegacyOtp(value.replace(/[^0-9]/g, '').slice(0, 6))
  }

  function changeNumber() {
    setStep('phone')
    setOtp('')
    setResendAfter(0)
    clearNotice()
  }

  function changeLegacyPhone() {
    setStep('legacy-phone')
    setLegacyOtp('')
    setLegacyResendAfter(0)
    clearNotice()
  }

  async function resendLegacy() {
    if (legacyResendAfter > 0 || isPending) return
    await sendLegacyCode()
  }

  async function resend() {
    if (resendAfter > 0 || isPending) return
    await sendCode()
  }

  function onOtpChange(value: string) {
    setMessage(null)
    setSuccess(null)
    setOtp(value.replace(/[^0-9]/g, '').slice(0, 6))
  }

  return (
    <main className="auth-page deba-phone-auth-page" dir="rtl">
      <div className="bg-decoration" aria-hidden="true">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>

      <div className="auth-container">
        <aside className="brand-side">
          <div>
            <Link href="/" className="brand-logo" aria-label="DEBA">
              <span className="brand-logo-icon">D</span>
              <span className="brand-logo-text">
                <strong>DEBA</strong>
                <small>CLASSIFIEDS MARKETPLACE</small>
              </span>
            </Link>

            <h1 className="brand-title">صفقة أوضح تبدأ بهوية موثوقة.</h1>
            <p className="brand-subtitle">
              DEBA يساعدك على اكتشاف الإعلانات، فهم السعر، التواصل مع البائع، واتخاذ قرار أفضل.
              يبدأ الوصول الموثوق من هاتف مصري موثّق.
            </p>
          </div>

          <div className="brand-values">
            <div className="value-card">
              <div className="value-number">01</div>
              <div className="value-content">
                <h3>هاتف موثّق</h3>
                <p>تأكيد ملكية الرقم قبل إجراءات السوق الحساسة.</p>
              </div>
            </div>
            <div className="value-card">
              <div className="value-number">02</div>
              <div className="value-content">
                <h3>تواصل آمن</h3>
                <p>المحادثات والعروض مرتبطة بحساب حقيقي.</p>
              </div>
            </div>
            <div className="value-card">
              <div className="value-number">03</div>
              <div className="value-content">
                <h3>قرار أفضل</h3>
                <p>بيانات أوضح قبل التواصل والاتفاق.</p>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <div className="brand-footer-logo">DEBA</div>
            <div className="brand-footer-text">مصمم في مصر 🇪🇬 للسوق المحلي والعالمي</div>
          </div>
        </aside>

        <section className="form-side">
          <div className="form-container deba-phone-auth-card">
            <div className="mobile-brand">
              <Link href="/" className="brand-logo" aria-label="DEBA">
                <span className="brand-logo-icon">D</span>
                <span className="brand-logo-text">
                  <strong>DEBA</strong>
                </span>
              </Link>
            </div>

            <div className="form-header">
              <Link href="/" className="form-back">
                <ArrowRight size={15} aria-hidden="true" />
                <span>الرئيسية</span>
              </Link>

              <div className="deba-auth-kicker">
                <ShieldCheck size={15} aria-hidden="true" />
                <span>IDENTITY & TRUST</span>
              </div>

              <h2 className="form-title">
                {step === 'phone'
                  ? 'دخول أو إنشاء حساب'
                  : step === 'otp'
                    ? 'تحقق من هاتفك'
                    : step === 'legacy-login'
                      ? 'دخول حساب قديم'
                      : step === 'legacy-phone'
                        ? 'ربط هاتف بحسابك القديم'
                        : 'تأكيد ربط الهاتف'}
              </h2>

              <p className="form-subtitle">
                {step === 'phone'
                  ? 'استخدم رقم هاتفك المصري للدخول أو إنشاء حساب جديد.'
                  : step === 'otp'
                    ? 'أدخل الرمز المرسل عبر WhatsApp لإكمال التحقق.'
                    : step === 'legacy-login'
                      ? 'هذا المسار مخصص للحسابات القديمة التي أُنشئت قبل اعتماد الهاتف كهوية أساسية.'
                      : step === 'legacy-phone'
                        ? 'تم التحقق من حسابك القديم. الآن اربط به رقم هاتف مصري تملكه عبر WhatsApp.'
                        : 'أدخل رمز WhatsApp لإثبات ملكية الهاتف وربطه بالحساب نفسه.'}
              </p>
            </div>

            {step === 'phone' || step === 'otp' ? (
              <div className="deba-auth-progress" aria-label="خطوات التحقق">
                <div className={step === 'phone' ? 'is-active' : 'is-complete'}>
                  <span>1</span>
                  <div>
                    <strong>رقم الهاتف</strong>
                    <small>+20 فقط</small>
                  </div>
                </div>
                <div className="deba-auth-progress-line" />
                <div className={step === 'otp' ? 'is-active' : ''}>
                  <span>2</span>
                  <div>
                    <strong>رمز WhatsApp</strong>
                    <small>6 أرقام</small>
                  </div>
                </div>
              </div>
            ) : step === 'legacy-login' ? (
              <div className="deba-auth-progress" aria-label="استعادة الحساب القديم">
                <div className="is-active">
                  <span>1</span>
                  <div>
                    <strong>الحساب القديم</strong>
                    <small>تسجيل آمن</small>
                  </div>
                </div>
                <div className="deba-auth-progress-line" />
                <div>
                  <span>2</span>
                  <div>
                    <strong>ربط الهاتف</strong>
                    <small>WhatsApp</small>
                  </div>
                </div>
              </div>
            ) : (
              <div className="deba-auth-progress" aria-label="ربط الهاتف بالحساب القديم">
                <div className="is-complete">
                  <span>1</span>
                  <div>
                    <strong>الحساب</strong>
                    <small>تم الدخول</small>
                  </div>
                </div>
                <div className="deba-auth-progress-line" />
                <div className={step === 'legacy-otp' ? 'is-active' : ''}>
                  <span>2</span>
                  <div>
                    <strong>WhatsApp</strong>
                    <small>توثيق الهاتف</small>
                  </div>
                </div>
              </div>
            )}

            {message ? (
              <div className="error-message" role="alert">
                <span aria-hidden="true">!</span>
                <span>{message}</span>
              </div>
            ) : null}

            {success ? (
              <div className="success-message" role="status">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{success}</span>
              </div>
            ) : null}

            {step === 'phone' ? (
              <form
                className="login-form deba-phone-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendCode()
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="phoneNumber">
                    رقم الهاتف المصري
                  </label>

                  <div className="deba-phone-input">
                    <span className="deba-phone-prefix" aria-hidden="true">+20</span>
                    <input
                      id="phoneNumber"
                      data-testid="phone-input"
                      type="tel"
                      value={phone.replace(/^\+20/, '')}
                      onChange={(event) =>
                        setPhone(
                          event.target.value.replace(/[^0-9]/g, '').slice(0, 10),
                        )
                      }
                      placeholder="10XXXXXXXX"
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={10}
                      disabled={isPending}
                      required
                      aria-describedby="phone-help"
                    />
                  </div>

                  <small id="phone-help" className="deba-auth-help">
                    نقبل أرقام المحمول المصرية فقط: 010، 011، 012، 015.
                  </small>
                </div>

                <div className="form-group">
                  <span className="form-label">نوع الاستخدام</span>
                  <div className="account-type-options" role="radiogroup" aria-label="نوع الاستخدام">
                    <button
                      type="button"
                      className={'account-type-option ' + (accountType === 'buyer' ? 'active' : '')}
                      role="radio"
                      aria-checked={accountType === 'buyer'}
                      onClick={() => setAccountType('buyer')}
                      disabled={isPending}
                    >
                      <strong>مشتري</strong>
                      <span>أبحث وأتواصل وأقارن الإعلانات.</span>
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
                      <span>أنشر إعلاناتي وأستقبل اهتمامًا حقيقيًا.</span>
                    </button>
                  </div>
                </div>

                <div className="deba-auth-trust-note">
                  <MessageCircle size={17} aria-hidden="true" />
                  <div>
                    <strong>رمز التحقق عبر WhatsApp</strong>
                    <span>
                      لا نعرض رقم الهاتف للآخرين. التحقق يستخدم فقط لتأكيد ملكية الحساب وتعزيز الثقة.
                    </span>
                  </div>
                </div>

                <button
                  data-testid="otp-send"
                  type="submit"
                  className="submit-btn"
                  disabled={isPending}
                >
                  {isPending ? (
                    <div className="btn-loader" aria-label="جارٍ إرسال الرمز" />
                  ) : (
                    <>
                      <span>إرسال رمز WhatsApp</span>
                      <span className="arrow">←</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="forgot-link"
                  onClick={openLegacyLogin}
                  disabled={isPending}
                >
                  لدي حساب قديم في DEBA
                </button>
              </form>
            ) : step === 'otp' ? (
              <form
                className="login-form deba-otp-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void verifyCode()
                }}
              >
                <div className="deba-otp-summary">
                  <span>سيتم التحقق من:</span>
                  <strong dir="ltr">{phone}</strong>
                  <button type="button" onClick={changeNumber} disabled={isPending}>
                    تغيير الرقم
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="otpCode">
                    رمز التحقق
                  </label>
                  <input
                    ref={otpRef}
                    id="otpCode"
                    data-testid="otp-input"
                    className="form-input deba-otp-input"
                    type="text"
                    value={otp}
                    onChange={(event) => onOtpChange(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    spellCheck={false}
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    disabled={isPending}
                    required
                    aria-label="رمز التحقق من WhatsApp"
                    dir="ltr"
                  />
                  <small className="deba-auth-help">
                    الصق الرمز المكوّن من 6 أرقام أو استخدم الملء التلقائي عندما يدعمه جهازك.
                  </small>
                </div>

                <button
                  data-testid="otp-verify"
                  type="submit"
                  className="submit-btn"
                  disabled={isPending || otp.length !== 6}
                >
                  {isPending ? (
                    <div className="btn-loader" aria-label="جارٍ التحقق" />
                  ) : (
                    <>
                      <span>تأكيد والدخول إلى DEBA</span>
                      <span className="arrow">←</span>
                    </>
                  )}
                </button>

                <div className="deba-otp-footer">
                  <span>
                    {resendAfter > 0
                      ? 'إعادة الإرسال متاحة خلال ' + resendAfter + ' ثانية'
                      : 'لم يصلك الرمز؟'}
                  </span>

                  <button
                    type="button"
                    onClick={() => void resend()}
                    disabled={resendAfter > 0 || isPending}
                    className="forgot-link"
                  >
                    إعادة إرسال الرمز
                  </button>
                </div>
              </form>
            ) : step === 'legacy-login' ? (
              <form
                className="login-form deba-phone-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void signInLegacyAccount()
                }}
              >
                <div className="deba-auth-trust-note">
                  <Mail size={17} aria-hidden="true" />
                  <div>
                    <strong>استعادة آمنة للحساب القديم</strong>
                    <span>
                      لن تحصل على صلاحيات السوق الحساسة حتى يكتمل ربط هاتف مصري موثّق.
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="legacyEmail">
                    بريد الحساب القديم
                  </label>
                  <input
                    id="legacyEmail"
                    data-testid="legacy-email"
                    className="form-input"
                    type="email"
                    value={legacyEmail}
                    onChange={(event) => setLegacyEmail(event.target.value)}
                    autoComplete="username"
                    inputMode="email"
                    disabled={isPending}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="legacyPassword">
                    كلمة المرور
                  </label>
                  <input
                    id="legacyPassword"
                    data-testid="legacy-password"
                    className="form-input"
                    type="password"
                    value={legacyPassword}
                    onChange={(event) => setLegacyPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={isPending}
                    required
                  />
                </div>

                <button
                  data-testid="legacy-login-submit"
                  type="submit"
                  className="submit-btn"
                  disabled={isPending}
                >
                  {isPending ? (
                    <div className="btn-loader" aria-label="جارٍ تسجيل الدخول" />
                  ) : (
                    <>
                      <span>تسجيل الدخول للحساب القديم</span>
                      <span className="arrow">←</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="forgot-link"
                  onClick={backToPhoneLogin}
                  disabled={isPending}
                >
                  العودة لدخول الهاتف
                </button>
              </form>
            ) : step === 'legacy-phone' ? (
              <form
                className="login-form deba-phone-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendLegacyCode()
                }}
              >
                <div className="deba-auth-trust-note">
                  <MessageCircle size={17} aria-hidden="true" />
                  <div>
                    <strong>اربط هاتفك بحسابك نفسه</strong>
                    <span>
                      سنستخدم WhatsApp لإثبات ملكية الرقم ثم نثبته على حسابك القديم. لا يتم إنشاء حساب جديد.
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="legacyPhoneNumber">
                    رقم الهاتف المصري
                  </label>
                  <div className="deba-phone-input">
                    <span className="deba-phone-prefix" aria-hidden="true">+20</span>
                    <input
                      id="legacyPhoneNumber"
                      data-testid="legacy-phone-input"
                      type="tel"
                      value={legacyPhone.replace(/^\+20/, '')}
                      onChange={(event) =>
                        setLegacyPhone(
                          event.target.value.replace(/[^0-9]/g, '').slice(0, 10),
                        )
                      }
                      placeholder="10XXXXXXXX"
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={10}
                      disabled={isPending}
                      required
                    />
                  </div>
                  <small className="deba-auth-help">
                    نقبل أرقام المحمول المصرية فقط: 010، 011، 012، 015.
                  </small>
                </div>

                <button
                  data-testid="legacy-phone-send"
                  type="submit"
                  className="submit-btn"
                  disabled={isPending}
                >
                  {isPending ? (
                    <div className="btn-loader" aria-label="جارٍ إرسال الرمز" />
                  ) : (
                    <>
                      <span>إرسال رمز WhatsApp للربط</span>
                      <span className="arrow">←</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => {
                    setLegacyPhone('')
                    setLegacyOtp('')
                    setStep('legacy-login')
                    clearNotice()
                  }}
                  disabled={isPending}
                >
                  تغيير الحساب
                </button>
              </form>
            ) : (
              <form
                className="login-form deba-otp-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void verifyLegacyCode()
                }}
              >
                <div className="deba-otp-summary">
                  <span>سيتم ربط الرقم بالحساب الحالي:</span>
                  <strong dir="ltr">{legacyPhone}</strong>
                  <button type="button" onClick={changeLegacyPhone} disabled={isPending}>
                    تغيير الرقم
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="legacyOtpCode">
                    رمز WhatsApp
                  </label>
                  <input
                    ref={legacyOtpRef}
                    id="legacyOtpCode"
                    data-testid="legacy-otp-input"
                    className="form-input deba-otp-input"
                    type="text"
                    value={legacyOtp}
                    onChange={(event) => onLegacyOtpChange(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    spellCheck={false}
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    disabled={isPending}
                    required
                    aria-label="رمز WhatsApp لربط الهاتف"
                    dir="ltr"
                  />
                  <small className="deba-auth-help">
                    أدخل الرمز الذي وصلك على WhatsApp. لا يوجد SMS fallback لهذا المسار.
                  </small>
                </div>

                <button
                  data-testid="legacy-otp-verify"
                  type="submit"
                  className="submit-btn"
                  disabled={isPending || legacyOtp.length !== 6}
                >
                  {isPending ? (
                    <div className="btn-loader" aria-label="جارٍ التحقق" />
                  ) : (
                    <>
                      <span>تأكيد ربط الهاتف</span>
                      <span className="arrow">←</span>
                    </>
                  )}
                </button>

                <div className="deba-otp-footer">
                  <span>
                    {legacyResendAfter > 0
                      ? 'إعادة الإرسال متاحة خلال ' + legacyResendAfter + ' ثانية'
                      : 'لم يصلك الرمز؟'}
                  </span>

                  <button
                    type="button"
                    onClick={() => void resendLegacy()}
                    disabled={legacyResendAfter > 0 || isPending}
                    className="forgot-link"
                  >
                    إعادة إرسال الرمز
                  </button>
                </div>
              </form>
            )}

            <div className="deba-auth-policy">
              <ShieldCheck size={15} aria-hidden="true" />
              <p>
                لا تتم مشاركة رقمك علنًا. ولا تُمنح إجراءات السوق الحساسة لحساب غير موثّق بالهاتف.
              </p>
            </div>

            <p className="terms-text">
              بالمتابعة، أنت توافق على <Link href="/legal">شروط الاستخدام</Link> و<Link href="/legal">سياسات DEBA</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
