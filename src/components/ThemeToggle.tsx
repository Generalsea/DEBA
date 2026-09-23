'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './ThemeToggle.module.css'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.dataset.theme
    if (current === 'light' || current === 'dark') return current
  }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }

  return 'dark'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getInitialTheme())
  }, [])

  const toggle = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme

    try {
      window.localStorage.setItem('deba-theme', nextTheme)
    } catch {
      // Theme persistence is best-effort.
    }

    setTheme(nextTheme)
  }

  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={isLight ? 'التبديل إلى الواجهة المظلمة' : 'التبديل إلى الواجهة الفاتحة'}
      title={isLight ? 'واجهة مظلمة' : 'واجهة فاتحة'}
    >
      {isLight ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      <span className={styles.label}>{isLight ? 'داكن' : 'فاتح'}</span>
    </button>
  )
}
