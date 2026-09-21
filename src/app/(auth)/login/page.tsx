'use client'

import {
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type AuthMode = 'login' | 'register'

function mapAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولاً.'
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

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'auth') {
      setMessage({
        type: 'error',
        text: 'تعذر التحقق من جلسة المصادقة. أعد المحاولة.',
      })
    }
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = displayName.trim()

    if (!cleanEmail) {
      setMessage({ type: 'error', text: 'أدخل بريدك الإلكتروني.' })
      return
    }

    if (password.length < 8) {
      setMessage({
        type: 'error',
        text: 'كلمة المرور يجب ألا تقل عن 8 أحرف.',
      })
      return
    }

    if (mode === 'register' && cleanName.length < 2) {
      setMessage({
        type: 'error',
        text: 'أدخل اسمًا ظاهرًا لا يقل عن حرفين.',
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
            error instanceof Error
              ? error.message.includes('Missing NEXT_PUBLIC_SUPABASE_')
                ? 'إعدادات Supabase غير مكتملة في Vercel.'
                : error.message
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

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanName,
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

    startTransition(async () => {
      let supabase: ReturnType<typeof createClient>
      try {
        supabase = createClient()
      } catch (error) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'إعدادات المصادقة غير متاحة حاليًا.',
        })
        return
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback?next=/',
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
    <main className="auth-page">
      <section className="auth-shell">
        <aside className="auth-brand">
          <div className="brand">
            <span className="brand-mark">D</span>
            <span>DEBA</span>
          </div>

          <div>
            <span className="kicker">سوق التبادل المصري</span>
            <h1>كل شيء له قيمة عندما يصل إلى من يحتاجه.</h1>
            <p>
              سوق مصمم للبيع والتبادل والتبرع، بتجربة هادئة، واضحة وموثوقة.
            </p>
          </div>

          <div className="trust-grid">
            <div>
              <b>01</b>
              <strong>ثقة</strong>
              <span>تجربة حساب موثوقة</span>
            </div>
            <div>
              <b>02</b>
              <strong>قيمة</strong>
              <span>استخدام أفضل لما تملك</span>
            </div>
            <div>
              <b>03</b>
              <strong>أثر</strong>
              <span>مساحة أكبر للتبرع</span>
            </div>
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="mobile-brand brand">
            <span className="brand-mark">D</span>
            <span>DEBA</span>
          </div>

          <div className="heading">
            <span className="kicker">مرحبًا بك</span>
            <h2>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h2>
            <p>
              {mode === 'login'
                ? 'أكمل رحلتك داخل DEBA من حيث توقفت.'
                : 'ابدأ حسابك وكن جزءًا من منظومة التبادل.'}
            </p>
          </div>

          <div className="mode-switch" role="tablist">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login')
                setMessage(null)
              }}
            >
              الدخول
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register')
                setMessage(null)
              }}
            >
              حساب جديد
            </button>
          </div>

          <button
            type="button"
            className="google-button"
            onClick={signInWithGoogle}
            disabled={isPending}
          >
            <span className="google-icon">G</span>
            المتابعة باستخدام Google
          </button>

          <div className="divider">
            <span />
            <small>أو</small>
            <span />
          </div>

          <form onSubmit={submit} className="form">
            {mode === 'register' && (
              <label>
                <span>الاسم الظاهر</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="مثال: طلعت موسى"
                  autoComplete="name"
                  maxLength={80}
                  disabled={isPending}
                />
              </label>
            )}

            <label>
              <span>البريد الإلكتروني</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                disabled={isPending}
              />
            </label>

            <label>
              <span>كلمة المرور</span>
              <div className="password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  minLength={8}
                  maxLength={128}
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            </label>

            {mode === 'login' && (
              <div className="aux">
                <span>تأكد من بياناتك قبل المتابعة.</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setMessage(null)
                  }}
                >
                  إنشاء حساب
                </button>
              </div>
            )}

            {message && (
              <div className={'message ' + message.type}>
                <span>{message.text}</span>
              </div>
            )}

            <button type="submit" className="submit" disabled={isPending}>
              <span>
                {isPending
                  ? 'جارٍ المعالجة…'
                  : mode === 'login'
                    ? 'دخول إلى DEBA'
                    : 'إنشاء الحساب'}
              </span>
              <b>←</b>
            </button>
          </form>

          <p className="legal">
            بالمتابعة، أنت توافق على شروط الاستخدام وسياسات DEBA.
          </p>
        </section>
      </section>
    </main>
  )
}
