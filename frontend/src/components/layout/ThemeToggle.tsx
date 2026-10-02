import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

function readTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, setTheme] = useState(readTheme)

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0b0d16' : '#f3f5fb')
    try {
      localStorage.setItem('theme', next)
    } catch {
      // private mode: the theme just won't be remembered
    }
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="nav-item w-full"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      {withLabel && <span className="text-sm font-medium">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  )
}
